"""Source-sensitive importer tests; biological source files remain locally ignored."""
from __future__ import annotations

import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

from openpyxl import Workbook, load_workbook

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / 'scripts'))
import import_cook2019 as importer  # noqa: E402
from import_cook2019 import (  # noqa: E402
    CHEMICAL_SHEET, GAP_SHEET, ImportValidationError, SI4_SHA256, SI5_SHA256,
    build_subset, import_snapshot, main, numeric_weight, read_matrix, read_neurons,
    source_ref, utc_timestamp, write_json_files,
)


def matrix_fixture(title, names, extra_targets=()):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = title
    row_map = {name: i for i, name in enumerate(names, 4)}
    col_map = {name: i for i, name in enumerate([*names, *extra_targets], 4)}
    for name, row in row_map.items():
        sheet.cell(row, 3, name)
    for name, column in col_map.items():
        sheet.cell(3, column, name)
    return sheet, row_map, col_map


def set_weight(sheet, rows, columns, a, b, value):
    sheet.cell(rows[a], columns[b]).value = value


def fixture(order=None, absent=()):
    """`absent` names are neurons without a chemical source row that stay chemical targets."""
    names = [*(order or ['AVAR', 'AVER', 'A', 'B', 'C', 'Z']), *absent]
    chemical, cr, cc = matrix_fixture(CHEMICAL_SHEET, [n for n in names if n not in absent],
                                      [*absent, 'MUSCLE'])
    for a, b, value in [('AVAR', 'A', 5), ('A', 'AVAR', 1), ('AVER', 'B', 6),
                        ('AVER', 'C', 6), ('AVAR', 'AVER', 7), ('AVER', 'AVAR', 2),
                        ('A', 'A', 9), ('A', 'MUSCLE', 4), ('Z', 'A', 8)]:
        set_weight(chemical, cr, cc, a, b, value)
    for target in absent:
        set_weight(chemical, cr, cc, 'AVAR', target, 5)
        set_weight(chemical, cr, cc, 'AVER', target, 2)
    gap, gr, gc = matrix_fixture(GAP_SHEET, names)
    for target in absent:
        for seed, value in (('AVAR', 1), ('AVER', 4)):
            set_weight(gap, gr, gc, seed, target, value)
            set_weight(gap, gr, gc, target, seed, value)
    for a, b, value in [('AVAR', 'B', 3), ('AVER', 'C', 3), ('AVER', 'A', 1), ('A', 'Z', 4)]:
        set_weight(gap, gr, gc, a, b, value)
        set_weight(gap, gr, gc, b, a, value)
    set_weight(gap, gr, gc, 'A', 'A', 2)
    cell_lists = Workbook()
    pharynx = cell_lists.active
    pharynx.title = 'pharynx'
    pharynx.append(['bm', 'basement membrane'])
    shared = cell_lists.create_sheet('sex-shared')
    shared.append([None, 'cell type', 'cell category', 'notes, sensilla, modality'])
    for name in names:
        shared.append([name, 'interneuron', 'IN'])
    shared.append(['MUSCLE', 'muscle', 'endorgan'])
    specific = cell_lists.create_sheet('hermaphrodite specific')
    specific.append(['vm2aL ', 'sex muscle', 'endorgan'])  # Real SI4 has an excluded trailing-space name.
    return chemical, gap, cell_lists


def payload(chemical, gap, lists, limit=5, count=6, absent=frozenset()):
    return build_subset(read_matrix(chemical), read_matrix(gap), read_neurons(lists, count), [],
                        limit=limit, absent_sources=absent)


class ImporterFixtureTests(unittest.TestCase):
    def test_direction_raw_weight_and_coordinates(self):
        chemical, gap, lists = fixture()
        data = payload(chemical, gap, lists)
        edges = {(e['source'], e['target']): e for e in data['chemicalEdges']}
        self.assertEqual(edges['AVAR', 'AVER']['rawWeight'], 7)
        self.assertEqual(edges['AVER', 'AVAR']['rawWeight'], 2)
        self.assertEqual(edges['AVAR', 'AVER']['sourceRef'], source_ref(CHEMICAL_SHEET, 4, 5))
        self.assertEqual(edges['A', 'A']['rawWeight'], 9)
        self.assertEqual(data['neurons'][0]['sourceRef'], source_ref('sex-shared', 2, 1))

    def test_deterministic_separate_ranking_and_limit(self):
        original = payload(*fixture(), limit=4)
        permuted = payload(*fixture(['Z', 'C', 'B', 'A', 'AVER', 'AVAR']), limit=4)
        self.assertEqual(original['selection']['neuronIds'], ['AVAR', 'AVER', 'B', 'C'])
        self.assertEqual(original['selection']['neuronIds'], permuted['selection']['neuronIds'])
        self.assertEqual(original['selection']['ranking'], permuted['selection']['ranking'])
        self.assertEqual([r['gapSeedWeight'] for r in original['selection']['ranking']], [3, 3, 1])
        self.assertEqual(json.dumps(original, sort_keys=True), json.dumps(payload(*fixture(), limit=4), sort_keys=True))

    def test_physical_gap_once_and_diagonal_separately_preserved(self):
        data = payload(*fixture())
        self.assertEqual(len(data['gapEdges']), 3)
        self.assertTrue(all(e['a'] < e['b'] for e in data['gapEdges']))
        self.assertTrue(all(e['sourceRef'] != e['reciprocalSourceRef'] for e in data['gapEdges']))
        self.assertEqual(data['selection']['excludedGapSelfEntries'], [
            {'neuronId': 'A', 'rawWeight': 2, 'sourceRef': source_ref(GAP_SHEET, 6, 6), 'selected': True}])

    def test_all_external_cell_types_counted_and_aggregate_matches_per_neuron(self):
        data = payload(*fixture())
        totals = data['selection']['omittedExternal']
        self.assertEqual(totals, {'chemicalIncomingCount': 1, 'chemicalOutgoingCount': 1,
                                 'gapCount': 1, 'chemicalIncomingWeight': 8,
                                 'chemicalOutgoingWeight': 4, 'gapWeight': 4})
        for key, total in totals.items():
            self.assertEqual(total, sum(r[key] for r in data['selection']['omittedByNeuron']))

    def test_asymmetry_fails_without_silent_symmetrization(self):
        chemical, gap, lists = fixture()
        gap['G4'] = 4
        with self.assertRaisesRegex(ImportValidationError, 'Asymmetric'):
            payload(chemical, gap, lists)

    def test_missing_header_and_duplicate_header_fail(self):
        for value in [None, 'AVAR']:
            with self.subTest(value=value):
                chemical, gap, lists = fixture()
                chemical['E3'] = value
                with self.assertRaises(ImportValidationError):
                    payload(chemical, gap, lists)

    def test_missing_seed_and_mismatched_cell_ids_fail(self):
        chemical, gap, lists = fixture()
        neurons = read_neurons(lists, 6)
        neurons.pop('AVAR')
        with self.assertRaisesRegex(ImportValidationError, 'Missing seed'):
            build_subset(read_matrix(chemical), read_matrix(gap), neurons, [], absent_sources=frozenset())
        chemical, gap, lists = fixture()
        chemical['C9'] = 'Z_typo'
        with self.assertRaisesRegex(ImportValidationError, 'mismatch'):
            payload(chemical, gap, lists)

    def test_missing_neuron_type_and_unexpected_si4_headers_fail(self):
        for cell, value in [('B2', None), ('B1', 'unexpected')]:
            with self.subTest(cell=cell):
                chemical, gap, lists = fixture()
                lists['sex-shared'][cell] = value
                with self.assertRaises(ImportValidationError):
                    payload(chemical, gap, lists)

    def test_authored_blank_is_no_recorded_edge_but_invalid_numbers_fail(self):
        self.assertEqual(numeric_weight(None, 'fixture!A1'), 0)
        for value in [-1, float('nan'), float('inf'), '-2', True, '=SUM(A1)']:
            with self.subTest(value=value), self.assertRaises(ImportValidationError):
                numeric_weight(value, 'fixture!A1')

    def test_pinned_hash_rejects_modified_input_before_workbook_parse(self):
        with tempfile.TemporaryDirectory() as directory:
            wrong = Path(directory) / 'wrong.xlsx'
            wrong.write_bytes(b'not the pinned source')
            with self.assertRaisesRegex(ImportValidationError, 'Pinned SHA-256 mismatch'):
                import_snapshot(wrong, wrong, '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z')

    def test_known_absent_chemical_source_is_never_invented(self):
        # X is a chemical target and a gap partner of both seeds but has no chemical source row,
        # like CANL/CANR in the real workbook.
        absent = frozenset({'X'})
        chemical, gap, lists = fixture(absent=absent)
        data = payload(chemical, gap, lists, limit=5, count=7, absent=absent)
        ranking = {r['neuronId']: r for r in data['selection']['ranking']}
        self.assertEqual((ranking['X']['chemicalSeedWeight'], ranking['X']['gapSeedWeight']), (7, 5))
        self.assertEqual(data['selection']['neuronIds'], ['AVAR', 'AVER', 'X', 'B', 'C'])
        self.assertNotIn('X', {e['source'] for e in data['chemicalEdges']})
        self.assertEqual({(e['source'], e['target']): e['rawWeight'] for e in data['chemicalEdges']
                          if e['target'] == 'X'}, {('AVAR', 'X'): 5, ('AVER', 'X'): 2})
        self.assertEqual(data['selection']['sourceValidation']['expectedMissingChemicalSources'], ['X'])
        self.assertEqual(data['selection']['sourceValidation']['chemicalSourceCount'], 6)

    def test_absent_source_exception_is_exact_not_a_blanket_allowance(self):
        absent = frozenset({'X'})
        chemical, gap, lists = fixture(absent=absent)
        with self.assertRaisesRegex(ImportValidationError, r"mismatch.*missing=\['X'\]"):
            payload(chemical, gap, lists, count=7)  # the exception was not declared
        chemical, gap, lists = fixture()
        with self.assertRaisesRegex(ImportValidationError, r"mismatch.*unexpected=\['Z'\]"):
            payload(chemical, gap, lists, absent=frozenset({'Z'}))  # declared absent, but a row exists
        chemical, _, _ = fixture()  # no X target column: an absent source must still be a target
        _, gap, lists = fixture(absent=absent)
        with self.assertRaisesRegex(ImportValidationError, 'Missing chemical target neurons'):
            payload(chemical, gap, lists, count=7, absent=absent)

    def test_utc_timestamp_accepts_only_explicit_utc(self):
        self.assertEqual(utc_timestamp('2026-10-03T02:46:04.246507Z'), '2026-10-03T02:46:04.246507Z')
        self.assertEqual(utc_timestamp('2026-10-03T02:46:04+00:00'), '2026-10-03T02:46:04Z')
        for value in ['2026-10-03T02:46:04', '2026-10-03T05:46:04+03:00', '2026-10-03T02:46:04-05:00',
                      'yesterday', '']:
            with self.subTest(value=value), self.assertRaises(ImportValidationError):
                utc_timestamp(value)

    def test_cli_help(self):
        script = PROJECT_ROOT / 'scripts/import_cook2019.py'
        result = subprocess.run([sys.executable, str(script), '--help'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn('--si5-downloaded-at', result.stdout)
        self.assertIn('--acquisition-output', result.stdout)


class WriteAndCliTests(unittest.TestCase):
    """Output guarantees, using synthetic data in temp directories only."""

    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.si5, self.si4 = self.root / 'si5.xlsx', self.root / 'si4.xlsx'
        self.si5.write_bytes(b'not the pinned SI5')
        self.si4.write_bytes(b'not the pinned SI4')
        self.output = self.root / 'out' / 'dataset.json'
        self.acquisition = self.root / 'meta' / 'acquisition.json'
        self.dataset = payload(*fixture())
        self.acquisition_value = {'schemaVersion': 1, 'note': 'ağ \u2013 ölçüm',
                                  'counts': {'neurons': 5, 'chemicalEdges': 8, 'gapEdges': 3}}

    def run_cli(self, **overrides):
        options = {'--si5': self.si5, '--si4': self.si4, '--output': self.output,
                   '--acquisition-output': self.acquisition,
                   '--si5-downloaded-at': '2026-10-03T00:00:00Z',
                   '--si4-downloaded-at': '2026-10-03T00:00:00Z', **overrides}
        argv = [str(part) for pair in options.items() for part in pair]
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            try:
                code = main(argv)
            except SystemExit as exit_:
                code = exit_.code
        return code, stdout.getvalue(), stderr.getvalue()

    def fake_import(self):
        return mock.patch.object(importer, 'import_snapshot',
                                 return_value=(self.dataset, self.acquisition_value))

    def test_write_json_files_writes_complete_files_and_no_temp_leftovers(self):
        first, second = self.root / 'a' / 'first.json', self.root / 'a' / 'second.json'
        write_json_files([(first, {'a': 1}), (second, {'ad': 'ağ'})])
        self.assertEqual(first.read_text(encoding='utf-8'), '{\n  "a": 1\n}\n')
        self.assertEqual(json.loads(second.read_text(encoding='utf-8')), {'ad': 'ağ'})
        self.assertIn('ağ', second.read_text(encoding='utf-8'))
        self.assertEqual(sorted(path.name for path in first.parent.iterdir()), ['first.json', 'second.json'])

    def test_replacement_is_atomic_for_a_reader_that_already_opened_the_target(self):
        target = self.root / 'target.json'
        target.write_text('{"old": true}\n', encoding='utf-8')
        with target.open(encoding='utf-8') as reader:
            write_json_files([(target, {'new': True})])
            self.assertEqual(reader.read(), '{"old": true}\n')  # never truncated in place
        self.assertEqual(json.loads(target.read_text(encoding='utf-8')), {'new': True})

    def test_failed_staging_of_second_file_leaves_first_target_untouched(self):
        first = self.root / 'first.json'
        first.write_text('{"old": true}\n', encoding='utf-8')
        (self.root / 'blocker').write_text('a file, not a directory', encoding='utf-8')
        with self.assertRaises(OSError):
            write_json_files([(first, {'new': True}), (self.root / 'blocker' / 'second.json', {})])
        self.assertEqual(first.read_text(encoding='utf-8'), '{"old": true}\n')
        self.assertEqual(sorted(path.name for path in self.root.iterdir()),
                         ['blocker', 'first.json', 'si4.xlsx', 'si5.xlsx'])

    def test_unserialisable_value_is_rejected_before_any_target_changes(self):
        first = self.root / 'first.json'
        first.write_text('{"old": true}\n', encoding='utf-8')
        with self.assertRaises(ValueError):
            write_json_files([(first, {'new': True}), (self.root / 'second.json', {'bad': float('nan')})])
        self.assertEqual(first.read_text(encoding='utf-8'), '{"old": true}\n')
        self.assertFalse((self.root / 'second.json').exists())

    def test_cli_writes_both_outputs_creating_directories(self):
        with self.fake_import():
            code, out, err = self.run_cli()
        self.assertEqual((code, err), (0, ''))
        self.assertEqual(json.loads(self.output.read_text(encoding='utf-8')), self.dataset)
        self.assertEqual(json.loads(self.acquisition.read_text(encoding='utf-8')), self.acquisition_value)
        summary = json.loads(out)
        self.assertEqual((summary['neurons'], summary['chemicalEdges'], summary['gapEdges']), (5, 8, 3))
        self.assertEqual([path.name for path in self.output.parent.iterdir()], ['dataset.json'])
        self.assertEqual([path.name for path in self.acquisition.parent.iterdir()], ['acquisition.json'])

    def test_cli_validation_failure_writes_nothing_and_keeps_previous_outputs(self):
        code, _, err = self.run_cli()  # the real validation rejects the unpinned source bytes
        self.assertEqual(code, 1)
        self.assertIn('Pinned SHA-256 mismatch', err)
        self.assertFalse(self.output.parent.exists())
        self.assertFalse(self.acquisition.parent.exists())
        for path in (self.output, self.acquisition):
            path.parent.mkdir(parents=True)
            path.write_text('{"previous": true}\n', encoding='utf-8')
        self.assertEqual(self.run_cli()[0], 1)
        for path in (self.output, self.acquisition):
            self.assertEqual(path.read_text(encoding='utf-8'), '{"previous": true}\n')

    def test_cli_write_failure_keeps_previous_dataset_consistent_with_acquisition(self):
        self.output.parent.mkdir(parents=True)
        self.output.write_text('{"previous": true}\n', encoding='utf-8')
        (self.root / 'meta').write_text('a file where the acquisition directory belongs', encoding='utf-8')
        with self.fake_import():
            code, out, err = self.run_cli()
        self.assertEqual((code, out), (1, ''))
        self.assertIn('Import failed', err)
        self.assertEqual(self.output.read_text(encoding='utf-8'), '{"previous": true}\n')
        self.assertEqual([path.name for path in self.output.parent.iterdir()], ['dataset.json'])

    def test_cli_path_guards_fail_before_importing_or_touching_sources(self):
        aliased_si5 = self.root / 'out' / '..' / 'si5.xlsx'
        cases = {
            'same output': {'--acquisition-output': self.output},
            'dataset over SI5': {'--output': self.si5},
            'dataset over SI5 through an alias': {'--output': aliased_si5},
            'acquisition over SI4': {'--acquisition-output': self.si4},
        }
        for label, overrides in cases.items():
            with self.subTest(label), self.fake_import() as fake:
                (self.root / 'out').mkdir(exist_ok=True)
                code, out, err = self.run_cli(**overrides)
                self.assertEqual((code, out), (2, ''))
                self.assertRegex(err, 'must differ|must not overwrite')
                fake.assert_not_called()
                self.assertEqual(self.si5.read_bytes(), b'not the pinned SI5')
                self.assertEqual(self.si4.read_bytes(), b'not the pinned SI4')
                self.assertFalse(self.acquisition.parent.exists())


DATA_ROOT = Path(os.environ.get('CIRCUITIARY_DATA_DIR', str(PROJECT_ROOT / 'data/raw')))
SI5_PATH = DATA_ROOT / 'cook2019-si5-corrected-july2020.xlsx'
SI4_PATH = DATA_ROOT / 'cook2019-si4-cell-lists.xlsx'


@unittest.skipUnless(SI5_PATH.is_file() and SI4_PATH.is_file(), 'Actual local-only source snapshots unavailable')
class ActualPinnedSnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.acquisition = import_snapshot(SI5_PATH, SI4_PATH,
                                                  '2026-10-03T02:46:04.246507Z',
                                                  '2026-10-03T02:51:05.053918Z')

    def test_actual_source_direction_and_weights(self):
        edges = {(e['source'], e['target']): e for e in self.data['chemicalEdges']}
        self.assertEqual(edges['AVER', 'AVAR']['rawWeight'], 33)
        self.assertEqual(edges['AVER', 'AVAR']['sourceRef'], source_ref(CHEMICAL_SHEET, 176, 213))
        self.assertEqual(edges['AVAR', 'AVER']['rawWeight'], 3)
        self.assertEqual(edges['AVAR', 'AVER']['sourceRef'], source_ref(CHEMICAL_SHEET, 183, 206))

    def test_actual_snapshot_integrity_and_boundary_counts(self):
        self.assertEqual([s['sha256'] for s in self.data['dataset']['sources']], [SI5_SHA256, SI4_SHA256])
        self.assertEqual(self.acquisition['counts'], {'neurons': 30, 'chemicalEdges': 196, 'gapEdges': 50})
        self.assertEqual(self.data['selection']['omittedExternal'],
                         {'chemicalIncomingCount': 448, 'chemicalOutgoingCount': 471, 'gapCount': 336,
                          'chemicalIncomingWeight': 2346, 'chemicalOutgoingWeight': 2106, 'gapWeight': 3544})
        report = self.data['selection']['sourceValidation']
        self.assertEqual(report['expectedMissingChemicalSources'], ['CANL', 'CANR'])
        self.assertEqual(report['fullGapDiagonalCount'], 17)
        self.assertEqual(report['selectedGapDiagonalCount'], 0)
        self.assertEqual(report['chemicalSelfEdgeCount'], 5)

    def test_all_246_edges_and_50_reciprocals_match_original_cells(self):
        workbook = load_workbook(SI5_PATH, data_only=False)
        try:
            ids = self.data['selection']['neuronIds']
            chemical = workbook[CHEMICAL_SHEET]
            gap = workbook[GAP_SHEET]
            for edges, sheet, physical in ((self.data['chemicalEdges'], chemical, False),
                                           (self.data['gapEdges'], gap, True)):
                row_map = {sheet.cell(r, 3).value: r for r in range(4, sheet.max_row + 1)
                           if sheet.cell(r, 3).value is not None}
                column_map = {sheet.cell(3, c).value: c for c in range(4, sheet.max_column + 1)
                              if sheet.cell(3, c).value is not None}
                expected = {(a, b) for a in ids for b in ids
                            if (not physical or a < b)
                            and (sheet.cell(row_map[a], column_map[b]).value or 0) > 0}
                found = {(e['a'], e['b']) if physical else (e['source'], e['target']) for e in edges}
                self.assertEqual(found, expected)
                for edge in edges:
                    a, b = (edge['a'], edge['b']) if physical else (edge['source'], edge['target'])
                    self.assertEqual(edge['sourceRef'], source_ref(sheet.title, row_map[a], column_map[b]))
                    self.assertEqual(edge['rawWeight'], sheet[edge['sourceRef']['cell']].value)
                    if physical:
                        reciprocal = edge['reciprocalSourceRef']
                        self.assertEqual(reciprocal, source_ref(sheet.title, row_map[b], column_map[a]))
                        self.assertEqual(edge['rawWeight'], sheet[reciprocal['cell']].value)
        finally:
            workbook.close()

    def test_actual_import_twice_is_identical(self):
        repeated, acquisition = import_snapshot(SI5_PATH, SI4_PATH,
                                                '2026-10-03T02:46:04.246507Z',
                                                '2026-10-03T02:51:05.053918Z')
        self.assertEqual(self.data, repeated)
        self.assertEqual(self.acquisition, acquisition)


if __name__ == '__main__':
    unittest.main()
