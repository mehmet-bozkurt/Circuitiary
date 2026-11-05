#!/usr/bin/env python3
"""Import a pinned Cook 2019 SI5/SI4 snapshot for local education only.

No network access, sign inference, weight normalization or biological simulation.
Workbook-authored blank matrix entries mean no recorded edge, not a missing header.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import tempfile
from typing import Any

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

SI5_SHA256 = '1f4fdbf84746b69b49a8da0816f52787860ce349b638dce37924ba80f90c70c9'
SI4_SHA256 = 'f5c524407e196ba8045cfb86fb996d41730e4b899a7c24b0c525a4d2ad0a7376'
SI5_URL = 'https://wormwiring.org/si/SI%205%20Connectome%20adjacency%20matrices%2C%20corrected%20July%202020.xlsx'
SI4_URL = 'https://wormwiring.org/si/SI%204%20Cell%20lists.xlsx'
DOI = 'https://doi.org/10.1038/s41586-019-1352-7'
CHEMICAL_SHEET = 'hermaphrodite chemical'
GAP_SHEET = 'hermaphrodite gap jn symmetric'
SEEDS = ('AVAR', 'AVER')
KNOWN_ABSENT_CHEMICAL_SOURCES = frozenset({'CANL', 'CANR'})
NEURON_TYPES = frozenset({'sensory', 'interneuron', 'motorneuron', 'neuron'})
CELL_TYPES = NEURON_TYPES | frozenset({
    'muscle (myoepithelium)', 'marginal cell', 'epithelium', 'glial cell',
    'basement membrane', 'muscle', 'glial', 'excretory', 'head mesodermal cell',
    'hypodermis', 'intestine', 'sex muscle',
})
STAT_FIELDS = (
    'chemicalIncomingCount', 'chemicalOutgoingCount', 'gapCount',
    'chemicalIncomingWeight', 'chemicalOutgoingWeight', 'gapWeight',
)


class ImportValidationError(ValueError):
    """A source violates the explicit, versioned workbook contract."""


def source_ref(sheet: str, row: int, column: int) -> dict[str, Any]:
    return {'sheet': sheet, 'row': row, 'column': column,
            'cell': f'{get_column_letter(column)}{row}'}


def exact_label(value: Any, location: str) -> str:
    if not isinstance(value, str) or not value or value.strip() != value:
        raise ImportValidationError(f'Unexpected or missing cell label at {location}: {value!r}')
    return value


def numeric_weight(value: Any, location: str) -> int | float:
    if value is None:
        return 0  # Authored sparse matrix entry; structural absences never use this rule.
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ImportValidationError(f'Non-numeric weight at {location}: {value!r}')
    if not math.isfinite(value) or value < 0:
        raise ImportValidationError(f'Non-finite or negative weight at {location}: {value!r}')
    return int(value) if int(value) == value else value


@dataclass(frozen=True)
class Matrix:
    sheet: str
    rows: dict[str, int]
    columns: dict[str, int]
    positive: dict[tuple[str, str], int | float]
    blank_count: int

    def weight(self, source: str, target: str) -> int | float:
        if source not in self.rows or target not in self.columns:
            raise ImportValidationError(f'Missing matrix cell for {source} -> {target} in {self.sheet}')
        return self.positive.get((source, target), 0)

    def ref(self, source: str, target: str) -> dict[str, Any]:
        if source not in self.rows or target not in self.columns:
            raise ImportValidationError(f'Missing source coordinates for {source} -> {target}')
        return source_ref(self.sheet, self.rows[source], self.columns[target])


def read_matrix(sheet: Any) -> Matrix:
    """The inspected SI5 layout uses C4... row names and D3... column names."""
    if any(sheet.cell(3, c).value is not None for c in (1, 2, 3)):
        raise ImportValidationError(f'Unexpected row-3 prefix headers in {sheet.title}')
    last_column = max((c for c in range(4, sheet.max_column + 1)
                       if sheet.cell(3, c).value is not None), default=3)
    last_row = max((r for r in range(4, sheet.max_row + 1)
                    if sheet.cell(r, 3).value is not None), default=3)
    if last_column < 4 or last_row < 4:
        raise ImportValidationError(f'Missing matrix headers in {sheet.title}')
    rows: dict[str, int] = {}
    columns: dict[str, int] = {}
    for row in range(4, last_row + 1):
        label = exact_label(sheet.cell(row, 3).value, f'{sheet.title}!C{row}')
        if label in rows:
            raise ImportValidationError(f'Duplicate row label {label} in {sheet.title}')
        rows[label] = row
    for column in range(4, last_column + 1):
        location = f'{sheet.title}!{get_column_letter(column)}3'
        label = exact_label(sheet.cell(3, column).value, location)
        if label in columns:
            raise ImportValidationError(f'Duplicate column label {label} in {sheet.title}')
        columns[label] = column
    positive: dict[tuple[str, str], int | float] = {}
    blank_count = 0
    for source, row in rows.items():
        for target, column in columns.items():
            cell = sheet.cell(row, column)
            blank_count += cell.value is None
            value = numeric_weight(cell.value, f'{sheet.title}!{cell.coordinate}')
            if value > 0:
                positive[(source, target)] = value
    return Matrix(sheet.title, rows, columns, positive, blank_count)


def read_neurons(workbook: Any, expected_count: int = 302) -> dict[str, dict[str, Any]]:
    neurons: dict[str, dict[str, Any]] = {}
    for title, first_row in (('pharynx', 1), ('sex-shared', 2), ('hermaphrodite specific', 1)):
        if title not in workbook.sheetnames:
            raise ImportValidationError(f'Missing SI4 sheet: {title}')
        sheet = workbook[title]
        if title == 'sex-shared' and (sheet['B1'].value != 'cell type'
                                      or sheet['C1'].value != 'cell category'):
            raise ImportValidationError('Unexpected SI4 sex-shared headers')
        for row in range(first_row, sheet.max_row + 1):
            cell_type = exact_label(sheet.cell(row, 2).value, f'{title}!B{row}')
            name = sheet.cell(row, 1).value
            if not isinstance(name, str) or not name.strip():
                raise ImportValidationError(f'Missing SI4 cell name at {title}!A{row}')
            if cell_type not in CELL_TYPES:
                raise ImportValidationError(f'Unexpected SI4 cell type for {name}: {cell_type}')
            if cell_type in NEURON_TYPES:
                name = exact_label(name, f'{title}!A{row}')
                if name in neurons:
                    raise ImportValidationError(f'Duplicate SI4 neuron: {name}')
                neurons[name] = {'id': name, 'label': name, 'cellType': cell_type,
                                 'sourceRef': source_ref(title, row, 1)}
    if len(neurons) != expected_count:
        raise ImportValidationError(f'Expected {expected_count} SI4 neurons, got {len(neurons)}')
    return neurons


def validate_matrices(chemical: Matrix, gap: Matrix, neurons: dict[str, Any],
                      absent_sources: frozenset[str] = KNOWN_ABSENT_CHEMICAL_SOURCES) -> None:
    names = set(neurons)
    expected_sources = names - absent_sources
    if set(chemical.rows) != expected_sources:
        raise ImportValidationError('Chemical source labels mismatch SI4: '
                                    f'missing={sorted(expected_sources - set(chemical.rows))}, '
                                    f'unexpected={sorted(set(chemical.rows) - expected_sources)}')
    if not names <= set(chemical.columns):
        raise ImportValidationError(f'Missing chemical target neurons: {sorted(names - set(chemical.columns))}')
    if set(gap.rows) != set(gap.columns):
        raise ImportValidationError('Gap row and column cell sets differ')
    if not names <= set(gap.rows):
        raise ImportValidationError(f'Missing gap neurons: {sorted(names - set(gap.rows))}')
    for source, target in gap.positive:
        if gap.weight(source, target) != gap.weight(target, source):
            raise ImportValidationError(f'Asymmetric gap weights: {source} / {target}')


def empty_stats() -> dict[str, int | float]:
    return dict.fromkeys(STAT_FIELDS, 0)


def build_subset(chemical: Matrix, gap: Matrix, neurons: dict[str, Any],
                 sources: list[dict[str, Any]], limit: int = 30,
                 absent_sources: frozenset[str] = KNOWN_ABSENT_CHEMICAL_SOURCES) -> dict[str, Any]:
    if not 2 <= limit <= 30:
        raise ImportValidationError('Subset limit must be between 2 and 30')
    for seed in SEEDS:
        if seed not in neurons or seed not in chemical.rows or seed not in chemical.columns or seed not in gap.rows:
            raise ImportValidationError(f'Missing seed: {seed}')
    validate_matrices(chemical, gap, neurons, absent_sources)
    ranking = []
    for name in sorted(set(neurons) - set(SEEDS)):
        # A known absent source row is never manufactured as a source matrix cell.
        chemical_weight = sum(chemical.weight(seed, name) for seed in SEEDS)
        if name in chemical.rows:
            chemical_weight += sum(chemical.weight(name, seed) for seed in SEEDS)
        gap_weight = sum(gap.weight(name, seed) for seed in SEEDS)  # physical pair once
        if chemical_weight > 0 or gap_weight > 0:
            ranking.append({'neuronId': name, 'chemicalSeedWeight': chemical_weight,
                            'gapSeedWeight': gap_weight})
    ranking.sort(key=lambda r: (-r['chemicalSeedWeight'], -r['gapSeedWeight'], r['neuronId']))
    for rank, record in enumerate(ranking, 1):
        record.update(rank=rank, selected=rank <= limit - len(SEEDS))
    selected = list(SEEDS) + [r['neuronId'] for r in ranking if r['selected']]
    selected_set = set(selected)
    chemical_edges = [
        {'id': f'chemical:{a}->{b}', 'source': a, 'target': b, 'rawWeight': weight,
         'sourceRef': chemical.ref(a, b)}
        for (a, b), weight in sorted(chemical.positive.items())
        if a in selected_set and b in selected_set
    ]
    gap_edges = [
        {'id': f'gap:{a}--{b}', 'a': a, 'b': b, 'rawWeight': weight,
         'sourceRef': gap.ref(a, b), 'reciprocalSourceRef': gap.ref(b, a)}
        for (a, b), weight in sorted(gap.positive.items())
        if a < b and a in selected_set and b in selected_set
    ]
    diagonals = [
        {'neuronId': a, 'rawWeight': weight, 'sourceRef': gap.ref(a, b),
         'selected': a in selected_set}
        for (a, b), weight in sorted(gap.positive.items()) if a == b
    ]
    by_neuron = {name: empty_stats() for name in selected}
    for (a, b), weight in chemical.positive.items():
        if a in selected_set and b not in selected_set:
            by_neuron[a]['chemicalOutgoingCount'] += 1
            by_neuron[a]['chemicalOutgoingWeight'] += weight
        elif b in selected_set and a not in selected_set:
            by_neuron[b]['chemicalIncomingCount'] += 1
            by_neuron[b]['chemicalIncomingWeight'] += weight
    for (a, b), weight in gap.positive.items():
        if a < b and ((a in selected_set) != (b in selected_set)):
            inside = a if a in selected_set else b
            by_neuron[inside]['gapCount'] += 1
            by_neuron[inside]['gapWeight'] += weight
    totals = {field: sum(stats[field] for stats in by_neuron.values()) for field in STAT_FIELDS}
    return {
        'schemaVersion': 1,
        'dataset': {
            'id': 'cook2019-hermaphrodite-si5-july2020',
            'title': 'Cook 2019 adult hermaphrodite AVAR/AVER anatomical subset',
            'version': 'SI5 corrected July 2020; SI4 cell lists', 'doi': DOI,
            'sources': sources,
            'license': {'status': 'unverified-local-only',
                        'note': 'File-specific redistribution permission unverified; raw and derived data stay local and ignored.'},
            'anatomicalWeightUnit': 'serial EM sections of connectivity (number and size of synapses combined)',
            'orientation': 'chemical: source rows, target columns; gap: symmetric physical pairs once (a < b)',
            'provenanceNotes': [
                'Whole-animal graph assembled from multiple EM series/animals and extrapolated across some data gaps.',
                'SI5 weights are not synapse counts, conductances, measured functional strengths or signed weights.',
                'Workbook-authored blank matrix entries mean no recorded edge; missing headers or unexpected missing neurons fail.',
                'CANL and CANR occur as chemical targets but have no source rows in this pinned workbook; no source cells are invented.',
                'All positive gap diagonal records are preserved separately and excluded from gapEdges, without biological interpretation.',
                'excludedGapSelfEntries covers full source cells, including non-neuron cells; its neuronId field preserves the exact source label.',
                'This is an isolated induced subgraph: external chemical inputs and all external gap connections are omitted, not clamped.',
                'SI4 non-neuron labels are not normalized; only exact neuron-whitelist IDs are eligible for selection.',
                'No measured signs, receptors, time constants or calcium observation model are imported.',
            ],
        },
        'selection': {
            'algorithm': 'avar-aver-one-hop-v1: chemical seed sum desc, separate physical gap seed sum desc, exact ID asc; induced subset',
            'seeds': list(SEEDS), 'limit': limit, 'neuronIds': selected, 'ranking': ranking,
            'omittedExternal': totals,
            'omittedByNeuron': [{'neuronId': name, **by_neuron[name]} for name in selected],
            'excludedGapSelfEntries': diagonals,
            'sourceValidation': {
                'si4NeuronCount': len(neurons), 'chemicalSourceCount': len(chemical.rows),
                'chemicalTargetCount': len(chemical.columns), 'gapCellCount': len(gap.rows),
                'chemicalBlankEntryCount': chemical.blank_count, 'gapBlankEntryCount': gap.blank_count,
                'expectedMissingChemicalSources': sorted(absent_sources),
                'excludedChemicalTargetIds': sorted(set(chemical.columns) - set(neurons)),
                'excludedGapCellIds': sorted(set(gap.rows) - set(neurons)),
                'fullGapDiagonalCount': len(diagonals),
                'selectedGapDiagonalCount': sum(d['selected'] for d in diagonals),
                'chemicalSelfEdgeCount': sum(e['source'] == e['target'] for e in chemical_edges),
                'gapSymmetryVerified': True,
            },
        },
        'neurons': [neurons[name] for name in selected],
        'chemicalEdges': chemical_edges, 'gapEdges': gap_edges,
    }


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def utc_timestamp(value: str) -> str:
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as exc:
        raise ImportValidationError(f'Invalid download timestamp: {value}') from exc
    if parsed.tzinfo is None or parsed.utcoffset().total_seconds() != 0:
        raise ImportValidationError('Download timestamps must include UTC offset/Z')
    return parsed.isoformat().replace('+00:00', 'Z')


def import_snapshot(si5: Path, si4: Path, si5_downloaded_at: str,
                    si4_downloaded_at: str, limit: int = 30) -> tuple[dict[str, Any], dict[str, Any]]:
    sources = []
    for path, name, url, expected, timestamp in (
        (si5, 'Cook SI5 corrected July 2020', SI5_URL, SI5_SHA256, si5_downloaded_at),
        (si4, 'Cook SI4 cell lists', SI4_URL, SI4_SHA256, si4_downloaded_at),
    ):
        actual = sha256_file(path)
        if actual != expected:
            raise ImportValidationError(f'Pinned SHA-256 mismatch for {name}: {actual}')
        sources.append({'name': name, 'url': url, 'sha256': actual,
                        'downloadedAtUtc': utc_timestamp(timestamp),
                        'fileName': path.name, 'byteLength': path.stat().st_size})
    workbook5 = load_workbook(si5, data_only=False)
    workbook4 = load_workbook(si4, data_only=False)
    try:
        for name in (CHEMICAL_SHEET, GAP_SHEET, 'TITLE AND LEGEND'):
            if name not in workbook5.sheetnames:
                raise ImportValidationError(f'Missing SI5 sheet: {name}')
        legend = workbook5['TITLE AND LEGEND']
        if 'Corrections, July 2020' not in str(legend['A3'].value):
            raise ImportValidationError('Unexpected SI5 correction legend')
        chemical = read_matrix(workbook5[CHEMICAL_SHEET])
        gap = read_matrix(workbook5[GAP_SHEET])
        neurons = read_neurons(workbook4)
        dataset = build_subset(chemical, gap, neurons, sources, limit)
    finally:
        workbook5.close()
        workbook4.close()
    acquisition = {
        'schemaVersion': 1, 'datasetId': dataset['dataset']['id'], 'doi': DOI,
        'sources': sources, 'license': dataset['dataset']['license'],
        'timestampEvidence': 'UTC acquisition timestamps supplied explicitly; this local run uses file mtimes recorded immediately after download, not import time.',
        'importer': {'path': 'scripts/import_cook2019.py', 'version': 1,
                     'dependency': 'openpyxl==3.1.5'},
        'selection': dataset['selection'],
        'counts': {'neurons': len(dataset['neurons']), 'chemicalEdges': len(dataset['chemicalEdges']),
                   'gapEdges': len(dataset['gapEdges'])},
        'sourceCoordinates': {'indexBase': 1, 'neuronWorkbook': 'SI4', 'edgeWorkbook': 'SI5',
                              'rowHeaderColumn': 'C', 'columnHeaderRow': 3,
                              'firstMatrixCell': 'D4',
                              'chemicalSheet': CHEMICAL_SHEET, 'gapSheet': GAP_SHEET},
    }
    return dataset, acquisition


def write_json_files(items: list[tuple[Path, Any]]) -> None:
    """Write every JSON file beside its target first, then swap them in with os.replace.

    A serialisation, disk or permission failure while staging leaves all existing targets
    untouched, and a concurrent reader (the dev server) never sees a half-written file.
    Temp files are private (0600), which suits licence-unverified local data.
    """
    texts = [(path, json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
             for path, value in items]
    staged: list[tuple[Path, Path]] = []
    try:
        for path, text in texts:
            path.parent.mkdir(parents=True, exist_ok=True)
            descriptor, name = tempfile.mkstemp(dir=path.parent, prefix=f'.{path.name}.', suffix='.tmp')
            staged.append((Path(name), path))
            with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
                stream.write(text)
                stream.flush()
                os.fsync(stream.fileno())
        for temp, path in staged:
            os.replace(temp, path)
    finally:
        for temp, _ in staged:
            temp.unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--si5', type=Path, required=True, help='Pinned corrected July 2020 SI5 XLSX')
    parser.add_argument('--si4', type=Path, required=True, help='Pinned SI4 cell lists XLSX')
    parser.add_argument('--si5-downloaded-at', required=True, help='Recorded SI5 UTC acquisition timestamp')
    parser.add_argument('--si4-downloaded-at', required=True, help='Recorded SI4 UTC acquisition timestamp')
    parser.add_argument('--output', type=Path, default=Path('data/local/cook-subset.json'))
    parser.add_argument('--acquisition-output', type=Path, default=Path('data/local/acquisition.json'))
    parser.add_argument('--limit', type=int, default=30, help='Total neurons, including two seeds (2–30)')
    args = parser.parse_args(argv)
    if args.output.resolve() == args.acquisition_output.resolve():
        parser.error('Dataset and acquisition output paths must differ')
    if any(path.resolve() in {args.si5.resolve(), args.si4.resolve()}
           for path in (args.output, args.acquisition_output)):
        parser.error('Output paths must not overwrite source workbooks')
    try:
        dataset, acquisition = import_snapshot(args.si5, args.si4, args.si5_downloaded_at,
                                               args.si4_downloaded_at, args.limit)
        # Validation completes before either generated target is written.
        write_json_files([(args.output, dataset), (args.acquisition_output, acquisition)])
    except (ImportValidationError, OSError) as exc:
        print(f'Import failed: {exc}', file=sys.stderr)
        return 1
    print(json.dumps({'output': str(args.output), 'acquisition': str(args.acquisition_output),
                      **acquisition['counts'], 'omittedExternal': dataset['selection']['omittedExternal']},
                     ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
