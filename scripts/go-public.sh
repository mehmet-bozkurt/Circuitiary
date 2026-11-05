#!/usr/bin/env bash
# Circuitiary'yi herkese açar ve yayın ayarlarını yapar. Sahibin çalıştıracağı TEK komuttur.
#
#   scripts/go-public.sh              onay ister, sonra her şeyi yapar
#   scripts/go-public.sh --dry-run    yalnız denetler ve yazacağı komutları basar, GitHub'a hiçbir şey yazmaz
#   scripts/go-public.sh --yes        onay sorusunu atlar
#
# Ayrıntı ve elle kalan işler: docs/publishing.md
#
# macOS'un varsayılan bash 3.2'sinde de çalışır; bu yüzden ilişkisel dizi, mapfile
# ve ${var,,} kullanılmaz.
# -E (ERR tuzağını işlevlere/alt kabuklara taşıma) bilerek yok: `if x="$(gh ...)"` denetimlerinde sahte hata iletisi basar.
set -euo pipefail

REPO="mehmet-bozkurt/Circuitiary"
HOMEPAGE="https://mehmet-bozkurt.github.io/Circuitiary/"
DESCRIPTION="Interactive teaching notebook for small neuron circuits: parameterised rate model, 2D/3D views, lessons and a circuit builder (Turkish UI); optional C. elegans connectome subgraph from locally imported data · Sinir devrelerini kurarak öğrenmek için etkileşimli deney defteri"
TOPICS="neuroscience connectome c-elegans neural-circuits computational-neuroscience education interactive simulation vue typescript turkish"
TAG="v0.1.0"
PAGES_WORKFLOW="pages.yml"

YES=0
DRY=0
NO_RELEASE=0
RELEASE_ONLY=0
NO_WAIT=0

usage() {
  cat <<'EOF'
Kullanım: scripts/go-public.sh [seçenekler]

Seçenekler:
  --yes, -y        "yayınla" onay sorusunu atlar
  --dry-run        Ön denetimleri yapar, GitHub'a yazacağı komutları basar ama çalıştırmaz
  --no-release     v0.1.0 sürümünü oluşturmaz (önce Zenodo bağlantısı kurulacaksa; bkz. docs/publishing.md)
  --release-only   Yalnız v0.1.0 sürümünü oluşturur (--no-release sonrası ikinci çalıştırma)
  --no-wait        Sonda canlı sitenin açılmasını beklemez
  -h, --help       Bu yardımı gösterir

Her adım yeniden çalıştırılabilir: zaten yapılmış olan adım atlanır ya da aynı değere ayarlanır.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) YES=1 ;;
    --dry-run) DRY=1 ;;
    --no-release) NO_RELEASE=1 ;;
    --release-only) RELEASE_ONLY=1 ;;
    --no-wait) NO_WAIT=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Bilinmeyen seçenek: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [[ $NO_RELEASE -eq 1 && $RELEASE_ONLY -eq 1 ]]; then
  echo "--no-release ile --release-only birlikte kullanılamaz." >&2
  exit 2
fi

# ---------------------------------------------------------------- çıktı yardımcıları
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=""; RED=""; GREEN=""; YELLOW=""; RESET=""
fi
say()  { printf '%s\n' "$*"; }
info() { printf '   %s\n' "$*"; }
ok()   { printf '%s   tamam:%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s   uyarı:%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
err()  { printf '%s   hata:%s %s\n' "$RED" "$RESET" "$*" >&2; }
die()  { printf '%shata:%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

CURRENT_STEP="ön denetim"
TMP=""
cleanup() { [[ -n "$TMP" && -d "$TMP" ]] && rm -rf "$TMP"; return 0; }
trap cleanup EXIT
trap 'printf "%shata:%s beklenmeyen çıkış (adım: %s, satır %s)\n" "$RED" "$RESET" "$CURRENT_STEP" "$LINENO" >&2' ERR
TMP="$(mktemp -d "${TMPDIR:-/tmp}/circuitiary-go-public.XXXXXX")"

# GitHub'a yazan her komut buradan geçer; --dry-run'da yalnız basılır.
ghw() {
  if [[ $DRY -eq 1 ]]; then
    printf '   [kuru çalıştırma] gh'
    printf ' %q' "$@"
    printf '\n'
  else
    gh "$@"
  fi
}

# ---------------------------------------------------------------- ön denetimler (salt okunur)
command -v gh >/dev/null 2>&1 || die "gh (GitHub CLI) bulunamadı. https://cli.github.com adresinden kurun."
command -v git >/dev/null 2>&1 || die "git bulunamadı."

cd "$(dirname "${BASH_SOURCE[0]}")/.."
ROOT="$(git rev-parse --show-toplevel)" || die "Burası bir git deposu değil."
cd "$ROOT"
CURRENT_STEP="ön denetim"

say "${BOLD}Ön denetimler${RESET}"

origin_url="$(git remote get-url origin 2>/dev/null || true)"
case "$origin_url" in
  *"github.com/$REPO"*|*"github.com:$REPO"*) ;;
  *) die "origin uzak deposu $REPO değil (şu an: ${origin_url:-yok})." ;;
esac

branch="$(git branch --show-current)"
[[ "$branch" == "main" ]] || die "main dalında olmalısınız (şu an: ${branch:-ayrık HEAD})."

if [[ -n "$(git status --porcelain)" ]]; then
  git status --short >&2
  die "Çalışma ağacı temiz değil. Değişiklikleri commit edip push edin, sonra yeniden çalıştırın."
fi

git fetch origin main --quiet || die "git fetch origin main başarısız oldu."
head_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse origin/main)"
if [[ "$head_sha" != "$remote_sha" ]]; then
  die "HEAD ($head_sha) origin/main ($remote_sha) ile aynı değil. Önce git push (ya da git pull) yapın."
fi

# Geçmişte veri dosyası kalmamış olmalı: depo açılınca bütün geçmiş herkese açılır.
if [[ -n "$(git ls-files -- data)" ]]; then
  die "data/ altında izlenen dosya var; veri lisansı doğrulanmadığı için yayınlanamaz."
fi
if [[ -n "$(git rev-list --all --max-count=1 -- data/raw data/local)" ]]; then
  die "Git geçmişinde data/raw veya data/local izi var; depoyu açmadan önce geçmişi temizleyin."
fi

for f in LICENSE README.md SECURITY.md CONTRIBUTING.md CODE_OF_CONDUCT.md CITATION.cff; do
  [[ -f "$f" ]] || die "$f eksik; önce eklenmeli."
done

gh auth status >/dev/null 2>&1 || die "gh oturum açmamış. 'gh auth login' çalıştırın."
viewer="$(gh api user --jq .login)" || die "GitHub kullanıcısı okunamadı."
owner="$(gh repo view "$REPO" --json owner --jq .owner.login)" || die "$REPO okunamadı (yetki ya da ad hatası)."
permission="$(gh repo view "$REPO" --json viewerPermission --jq .viewerPermission)"
is_private="$(gh repo view "$REPO" --json isPrivate --jq .isPrivate)"
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
[[ "$(lower "$viewer")" == "$(lower "$owner")" ]] || die "gh '$viewer' olarak giriş yapmış, ama $REPO'nun sahibi '$owner'."
[[ "$permission" == "ADMIN" ]] || die "$REPO üzerinde yönetici yetkiniz yok (yetki: $permission)."

has_pages_workflow=0
if [[ -f ".github/workflows/$PAGES_WORKFLOW" ]]; then
  if grep -q 'workflow_dispatch' ".github/workflows/$PAGES_WORKFLOW"; then
    has_pages_workflow=1
  else
    warn ".github/workflows/$PAGES_WORKFLOW 'workflow_dispatch' içermiyor; elle tetiklenemez."
  fi
else
  warn ".github/workflows/$PAGES_WORKFLOW yok; Pages iş akışı tetiklenmeyecek."
fi
[[ -f docs/images/social-preview.png ]] || warn "docs/images/social-preview.png yok; sosyal önizleme görseli elle yüklenecek (bkz. docs/publishing.md)."

ok "çalışma ağacı temiz, HEAD = origin/main (${head_sha:0:7}), gh '$viewer' olarak giriş yapmış, depo sahibi bu hesap"
ok "git geçmişinde veri dosyası yok"
if [[ "$is_private" == "true" ]]; then info "Depo şu an ÖZEL."; else info "Depo zaten herkese açık."; fi

# ---------------------------------------------------------------- plan ve onay
say ""
say "${BOLD}Yapılacaklar${RESET} ($REPO)"
if [[ $RELEASE_ONLY -eq 1 ]]; then
  say "  - $TAG sürümünü oluşturmak (başka hiçbir şey değil)"
else
  say "  1. Depoyu HERKESE AÇMAK: kod, bütün commit geçmişi, issue'lar ve Actions geçmişi/logları herkese görünür olur."
  say "     Geri özel yapmak mümkündür, ama yıldızları ve izleyicileri siler; o sürede alınan kopyalar (fork) geri alınamaz."
  say "  2. Açıklama, ana sayfa ve konu etiketlerini ayarlamak; wiki ve projects kapalı, issues açık, birleşince dalı sil; Discussions açılır; etiketler oluşturulur"
  say "  3. Secret scanning + push protection, özel güvenlik bildirimi, Dependabot uyarıları ve otomatik güvenlik düzeltmeleri"
  say "  4. GitHub Pages'i (GitHub Actions kaynağıyla) açmak ve $PAGES_WORKFLOW iş akışını tetiklemek"
  if [[ $NO_RELEASE -eq 1 ]]; then
    say "  5. (--no-release) $TAG sürümü OLUŞTURULMAZ"
  else
    say "  5. $TAG sürümünü (Türkçe + İngilizce kısa notlarla) oluşturmak"
  fi
fi
say ""
say "Canlı adres: $HOMEPAGE"
[[ $DRY -eq 1 ]] && say "${YELLOW}Kuru çalıştırma: GitHub'a hiçbir şey yazılmayacak.${RESET}"
say ""

confirm() {
  [[ $YES -eq 1 || $DRY -eq 1 ]] && return 0
  [[ -t 0 ]] || die "Etkileşimli terminal yok; onay için --yes verin."
  local answer=""
  printf 'Devam etmek için "yayınla" yazıp Enter'"'"'a basın (iptal için başka bir şey): '
  read -r answer || answer=""
  answer="${answer//[[:space:]]/}"
  case "$answer" in
    yayınla|yayinla) return 0 ;;
    *) say "İptal edildi; hiçbir şey değişmedi."; exit 1 ;;
  esac
}
confirm

# ---------------------------------------------------------------- adım çalıştırıcı
FAILED_COUNT=0
FAILED_LIST=""
run_step() {
  local label="$1"; shift
  CURRENT_STEP="$label"
  say ""
  say "${BOLD}== $label${RESET}"
  if "$@"; then
    return 0
  fi
  err "ADIM BAŞARISIZ: $label"
  FAILED_COUNT=$((FAILED_COUNT + 1))
  FAILED_LIST="${FAILED_LIST}  - ${label}"$'\n'
  return 1
}
# Kritik adım: başarısız olursa devam etmenin anlamı yok.
critical() { run_step "$@" || { summary; exit 1; }; }
optional() { run_step "$@" || true; }

# ---------------------------------------------------------------- adımlar
# Not: bu işlevler `if` içinde çağrıldığından `set -e` içlerinde işlemez; her komuttan
# sonra açıkça `|| return 1` yazılır.

step_visibility() {
  if [[ "$is_private" != "true" ]]; then
    info "Depo zaten herkese açık; atlandı."
    return 0
  fi
  ghw repo edit "$REPO" --visibility public --accept-visibility-change-consequences || return 1
  if [[ $DRY -eq 0 ]]; then
    local now
    now="$(gh repo view "$REPO" --json isPrivate --jq .isPrivate)" || return 1
    [[ "$now" == "false" ]] || { err "GitHub depoyu hâlâ özel gösteriyor."; return 1; }
  fi
  ok "depo herkese açık"
}

step_settings() {
  local args=() t
  for t in $TOPICS; do args+=(--add-topic "$t"); done
  ghw repo edit "$REPO" \
    --description "$DESCRIPTION" \
    --homepage "$HOMEPAGE" \
    --enable-issues \
    --enable-wiki=false \
    --enable-projects=false \
    --delete-branch-on-merge \
    "${args[@]}" || return 1
  ok "açıklama, ana sayfa, konu etiketleri; wiki/projects kapalı; issues açık; birleşince dal silinir"
}

step_discussions() {
  # --enable-discussions bu gh sürümünde var ve geri alınabilir. Başarısız olursa yalnız uyarı:
  # soruların issue'da sorulması proje için yeterlidir.
  ghw repo edit "$REPO" --enable-discussions || return 1
  ok "Discussions açık"
}

mk_label() { ghw label create "$1" --repo "$REPO" --color "$2" --description "$3" --force; }
step_labels() {
  local failed=0
  mk_label "good first issue"       7057ff "İlk katkı için uygun küçük iş · small task for newcomers" || failed=1
  mk_label "help wanted"            008672 "Yardım aranıyor · extra attention is needed" || failed=1
  mk_label "bug"                    d73a4a "Bir şey çalışmıyor · something is not working" || failed=1
  mk_label "enhancement"            a2eeef "Yeni özellik ya da iyileştirme · new feature or improvement" || failed=1
  mk_label "documentation"          0075ca "Belge iyileştirmesi · documentation" || failed=1
  mk_label "question"               d876e3 "Soru · further information requested" || failed=1
  mk_label "scientific-correction"  fbca04 "Bilimsel düzeltme · a biological statement needs fixing or sourcing" || failed=1
  mk_label "translation"            c5def5 "Çeviri ve çok dillilik · translation and i18n" || failed=1
  mk_label "atlas"                  bfd4f2 "Tür atlası kayıtları · species atlas records" || failed=1
  mk_label "glossary"               bfd4f2 "Sözlük maddeleri · glossary terms" || failed=1
  mk_label "presets"                bfd4f2 "Devre kurucu önayarları · circuit builder presets" || failed=1
  mk_label "accessibility"          1d76db "Erişilebilirlik · accessibility" || failed=1
  [[ $failed -eq 0 ]] || return 1
  ok "etiketler oluşturuldu/güncellendi"
}

step_secret_scanning() {
  local payload="$TMP/security_and_analysis.json"
  cat > "$payload" <<'JSON'
{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}
JSON
  ghw api -X PATCH "repos/$REPO" --input "$payload" --silent || return 1
  ok "secret scanning ve push protection açık"
}

step_private_reporting() {
  ghw api -X PUT "repos/$REPO/private-vulnerability-reporting" --silent || return 1
  ok "özel güvenlik bildirimi açık"
}

step_vulnerability_alerts() {
  ghw api -X PUT "repos/$REPO/vulnerability-alerts" --silent || return 1
  ok "Dependabot uyarıları açık"
}

step_security_fixes() {
  ghw api -X PUT "repos/$REPO/automated-security-fixes" --silent || return 1
  ok "otomatik güvenlik düzeltmeleri açık"
}

step_pages() {
  local current out
  if [[ $DRY -eq 0 ]] && current="$(gh api "repos/$REPO/pages" --jq .build_type 2>/dev/null)"; then
    if [[ "$current" == "workflow" ]]; then
      info "Pages zaten GitHub Actions kaynağıyla açık; atlandı."
      return 0
    fi
    ghw api -X PUT "repos/$REPO/pages" -f build_type=workflow --silent || return 1
    ok "Pages kaynağı GitHub Actions olarak güncellendi"
    return 0
  fi
  if [[ $DRY -eq 1 ]]; then
    ghw api -X POST "repos/$REPO/pages" -f build_type=workflow --silent
    return 0
  fi
  if out="$(gh api -X POST "repos/$REPO/pages" -f build_type=workflow 2>&1)"; then
    ok "Pages açıldı (kaynak: GitHub Actions)"
    return 0
  fi
  if printf '%s' "$out" | grep -qiE 'already exists|already enabled|HTTP 409'; then
    info "Pages zaten var; kaynağı GitHub Actions'a ayarlanıyor."
    gh api -X PUT "repos/$REPO/pages" -f build_type=workflow --silent || return 1
    ok "Pages kaynağı GitHub Actions"
    return 0
  fi
  printf '%s\n' "$out" >&2
  return 1
}

step_pages_run() {
  if [[ $has_pages_workflow -ne 1 ]]; then
    warn "$PAGES_WORKFLOW yok ya da elle tetiklenemiyor; atlandı. Pages ilk uygun push'ta yayımlanır."
    return 0
  fi
  if [[ $DRY -eq 1 ]]; then
    ghw workflow run "$PAGES_WORKFLOW" --repo "$REPO" --ref main
    return 0
  fi
  local attempt
  for attempt in 1 2 3 4; do
    if gh workflow run "$PAGES_WORKFLOW" --repo "$REPO" --ref main; then
      ok "$PAGES_WORKFLOW tetiklendi (ilerleme: gh run list --repo $REPO --workflow $PAGES_WORKFLOW)"
      return 0
    fi
    info "Deneme $attempt başarısız (iş akışı yeni açılmış depoda görünmeyebilir); 8 sn sonra yeniden."
    sleep 8
  done
  return 1
}

write_release_notes() {
  local file="$1"
  cat > "$file" <<'NOTES'
## Circuitiary v0.1.0 · ilk herkese açık sürüm

Küçük sinir devrelerini **kurarak ve deneyerek öğrenmek** için etkileşimli, Türkçe arayüzlü bir deney defteri.

- Sekiz hücreli kurgusal öğretici devre ve (veriyi yerelde içe aktarırsanız) Cook ve ark. 2019 verisinden seçilen 30 nöronluk *C. elegans* altgrafı
- Parametreli sürekli etkinlik modeli, bağlantı ve zaman sabiti müdahaleleri, eşik taraması
- 2D ve 3D devre görünümleri, grafik için tablo karşılığı, klavye kısayolları
- Kılavuzlu deneyler, nöron dersi, devre okuma dersi, sözlük, tür atlası, devre kurucu
- Paylaşma bağlantısı, dışa aktarma, yazdırma, çevrimdışı kullanım
- Tema (sistem/açık/koyu), WCAG AA kontrast ve tam klavye kullanımı hedeflenir

**Sınır:** bu bir *parametreli öğretim modelidir*; ölçüm, davranış simülasyonu ya da biyolojik beyin emülasyonu değildir ([docs/scientific-scope.md](docs/scientific-scope.md)). Gerçek *C. elegans* verisi, yeniden dağıtım lisansı doğrulanmadığı için bu depoyla **dağıtılmaz**; gerçek veri modu, veriyi kendi makinenizde README'deki komutla içe aktarırsanız çalışır. Çevrimiçi demo yalnız sekiz hücreli devreyi ve dersleri içerir.

Kod ve özgün metinler MIT lisanslıdır. Katkı: [CONTRIBUTING.md](CONTRIBUTING.md) · Güvenlik: [SECURITY.md](SECURITY.md)

---

An interactive teaching notebook (Turkish UI) for learning small neuron circuits by building and probing them: an eight-cell illustrative circuit and, if you import the data locally, a 30-neuron *C. elegans* subgraph (Cook et al. 2019), a parameterised rate model with connection and time-constant interventions, 2D/3D views, guided lessons, glossary, species atlas, circuit builder, sharing/export/print and offline use.

**Scope:** a parameterised teaching model, not a measurement, a behaviour simulation or a brain emulation. The real *C. elegans* data is **not** distributed with this repository (its redistribution licence was never verified); real-data mode works only after you import the data yourself as described in the README. The online demo contains the eight-cell circuit and the lessons only. Code and original text are MIT-licensed.
NOTES
}

step_release() {
  if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
    info "$TAG sürümü zaten var; atlandı."
    return 0
  fi
  local notes="$TMP/release-notes.md"
  write_release_notes "$notes" || return 1
  ghw release create "$TAG" \
    --repo "$REPO" \
    --target "$head_sha" \
    --title "Circuitiary $TAG" \
    --notes-file "$notes" \
    --latest || return 1
  ok "$TAG sürümü oluşturuldu"
}

summary() {
  say ""
  if [[ $FAILED_COUNT -eq 0 ]]; then
    say "${GREEN}${BOLD}Bütün adımlar tamamlandı.${RESET}"
  else
    err "$FAILED_COUNT adım başarısız oldu:"
    printf '%s' "$FAILED_LIST" >&2
    say "Betik yeniden çalıştırılabilir: tamamlanmış adımlar atlanır ya da aynı değere ayarlanır."
  fi
}

# ---------------------------------------------------------------- yürütme
if [[ $RELEASE_ONLY -eq 1 ]]; then
  optional "Sürüm: $TAG" step_release
else
  critical "1/5 Depoyu herkese aç" step_visibility
  optional "2/5 Depo ayarları (açıklama, ana sayfa, konular, wiki/projects kapalı)" step_settings
  optional "2/5 Discussions" step_discussions
  optional "2/5 Etiketler" step_labels
  optional "3/5 Secret scanning + push protection" step_secret_scanning
  optional "3/5 Özel güvenlik bildirimi" step_private_reporting
  optional "3/5 Dependabot uyarıları" step_vulnerability_alerts
  optional "3/5 Otomatik güvenlik düzeltmeleri" step_security_fixes
  optional "4/5 GitHub Pages (GitHub Actions kaynağı)" step_pages
  optional "4/5 Pages iş akışını tetikle" step_pages_run
  if [[ $NO_RELEASE -eq 0 ]]; then
    optional "5/5 Sürüm: $TAG" step_release
  fi
fi

# ---------------------------------------------------------------- canlı site denetimi (hata saymaz)
if [[ $DRY -eq 0 && $RELEASE_ONLY -eq 0 && $NO_WAIT -eq 0 && $has_pages_workflow -eq 1 ]] && command -v curl >/dev/null 2>&1; then
  say ""
  say "${BOLD}== Canlı site denetimi${RESET} (en çok ~3 dk; --no-wait ile atlanır)"
  live=0
  for _ in $(seq 1 18); do
    code="$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 10 "$HOMEPAGE" || true)"
    if [[ "$code" == "200" ]]; then live=1; break; fi
    sleep 10
  done
  if [[ $live -eq 1 ]]; then ok "$HOMEPAGE açılıyor (HTTP 200)"; else warn "Site henüz açılmadı; Actions sekmesinde Pages iş akışının bitmesini bekleyin."; fi
fi

summary

# ---------------------------------------------------------------- bağlantılar ve elle kalanlar
say ""
say "${BOLD}Bağlantılar${RESET}"
say "  Depo:        https://github.com/$REPO"
say "  Canlı site:  $HOMEPAGE"
say "  Sürümler:    https://github.com/$REPO/releases"
say "  Actions:     https://github.com/$REPO/actions"
say "  Güvenlik:    https://github.com/$REPO/security"
say "  Ayarlar:     https://github.com/$REPO/settings"
say ""
say "${BOLD}Elle kalan işler${RESET} (ayrıntı: docs/publishing.md)"
say "  1. Sosyal önizleme: Settings > General > Social preview > docs/images/social-preview.png dosyasını yükleyin (API yok)."
say "  2. Zenodo (DOI): zenodo.org > GitHub > $REPO düğmesini açın; DOI yalnız bundan SONRA yayımlanan sürümlere verilir."
say "     v0.1.0 için DOI isterseniz: --no-release ile çalıştırın, Zenodo'yu bağlayın, sonra --release-only ile çalıştırın."
say "  3. Canlı siteyi ve README bağlantılarını telefondan ve koyu temada bir kez deneyin."
say "  4. Duyuru: docs/publishing.md içindeki planı izleyin (OpenWorm topluluğu, r/compmathneuro, Show HN, öğretmen grupları, awesome listeleri)."
say "  5. İlk haftada issue'lara hızlı ve nazik yanıt verin; 'good first issue' etiketli birkaç iş açın."

if [[ $FAILED_COUNT -ne 0 ]]; then exit 1; fi
exit 0
