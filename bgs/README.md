# BGS Geochronology, Lexicon & Rock Classification

A unified BGS build of the ICS chart UI (`CHART_SOURCE=bgs`) combining the **BGS Geochronological Chart**, the **BGS Lexicon of Named Rock Units**, and the **BGS Rock Classification Scheme (RCS)** into a single static site built directly from the published RDF/SKOS Turtle vocabularies.

Without `CHART_SOURCE=bgs`, the app builds the upstream ICS chart unchanged.

## Tabs & Views

| Tab / Route | What it provides |
|---|---|
| **Geochronological Chart** (`/?tab=geochron`) | Interactive ICS + BGS Geochronological Chart with regional columns, Quaternary & MIS panel, and direct links from any division `InfoBox` to Lexicon rock units of that age (`overlaps` and `oldest`). |
| **Lexicon** (`/?tab=lexicon`, `/lexicon`) | Client-side search and filter table across Named Rock Units (code with `*` wildcard, name, description/full-text, rank, status, age overlap/within/oldest, RCS rock type, preferred map code), CSV export, and rich unit detail views loaded on demand from sharded JSON (`data/units/{a..z,0-9}.json`). |
| **Rock Classification (RCS)** (`/?tab=rcs`, `/rcs`) | Client-side search and filter table for the BGS Rock Classification Scheme (code, name, inverted index names, category, status), CSV export, and a side panel showing broader/narrower hierarchy and linked Lexicon units. |
| **Browse A–Z** (`/?tab=browse`) | Initial-letter index for browsing all Lexicon rock units alphabetically. |
| **About the data** (`/?tab=about`, `/about`) | Field-by-field data coverage for Lexicon and RCS (Distributable RDF vs Proposed predicates), Geochronological Chart join/fallback summary, and source file metadata. |

**What comes from where:**

| Source | What |
|---|---|
| ICS `chart.ttl` | Hierarchy, ordering, ranks, GSSP/GSSA ratification |
| `Geochronology.ttl` | Numeric ages, labels, colours, notations, definitions, identifiers, and age intervals for Lexicon age filtering |
| `NamedRockUnit.ttl` | Lexicon of Named Rock Units (codes, names, ranks, statuses, ages, lithology, boundaries, thickness, stratotypes, hierarchy, map codes, BGS publications, spatial footprints) |
| `RockUnitRank.ttl` | Lithostratigraphic / lithodemic ranks |
| `RockClassAll.ttl` | BGS Rock Classification Scheme (codes, labels, inverted index names, definitions, hierarchy) |
| `TypeLocalityType.ttl`, `SourceReferenceType.ttl` | Lookup vocabularies for proposed Lexicon predicates |

## Deploy from a fork to GitHub Pages

`.github/workflows/deploy-bgs-chart.yml` builds and deploys the unified BGS portal in any fork. Upstream's `deploy-chart.yml` is guarded so it only runs in `i-c-stratigraphy/chart`, so it can't overwrite the BGS site.

1. Fork the repository and push this change to `main`.
2. In the fork:
   - **Actions** tab: enable workflows (GitHub disables them in new forks).
   - **Settings → Pages → Source:** choose **GitHub Actions**.
3. Run the workflow from the Actions tab, or push to `main`. The site appears at `https://<owner>.github.io/<repo>/`.

Each run:
- pins `BritishGeologicalSurvey/vocabularies` to the current commit on `BGS_VOCABS_REF`
- generates `bgs/build/bgs-chart.ttl` and `bgs/build/bgs-chart-report.json`
- tests and runs `chart-ui/scripts/build-bgs-vocabs.mjs` to generate `lexicon-index.json`, sharded `units/{a..z,0-9}.json`, `rcs.json`, `geochronology.json`, `coverage.json`, and `build.json`
- validates all chart and vocabulary artifacts, builds the static Nuxt site, and deploys it

Optional repository variables (**Settings → Secrets and variables → Actions → Variables**):

| Variable | Default | Use |
|---|---|---|
| `BGS_VOCABS_REPO` | `BritishGeologicalSurvey/vocabularies` | Source repository |
| `BGS_VOCABS_REF` | `main` | Branch, tag or commit to read |
| `BGS_GEOCHRON_PATH` | `prez/vocabs/Geochronology.ttl` | Geochronology TTL path within the repo (its directory is also used for the other 5 TTL files) |
| `BGS_SPARQL_ENDPOINT` | (unset) | Read chart data from a SPARQL endpoint instead of the TTL |
| `PAGES_BASE_URL` | `/<repo>/` | Set to `/` for a custom domain or a `<owner>.github.io` repo |

The deployed site serves all generated data under `<base>/data/` (`bgs-chart.ttl`, `bgs-chart-report.json`, `lexicon-index.json`, `units/*.json`, `rcs.json`, `geochronology.json`, `coverage.json`, `build.json`).

## Local testing with Docker

A multi-stage `Dockerfile` and `docker-compose.yml` at the repository root let you build and test the full BGS portal without installing Node, pnpm, or Python on the host.

```bash
# 1. Build and serve the full static site (fetches live BGS vocabularies -> http://localhost:8080)
docker compose up --build

# 2. Fast offline build using the committed sample data in bgs/build/ (-> http://localhost:8080)
FETCH_VOCABS=false docker compose up --build

# 3. Hot-reload Nuxt dev server with local files mounted (-> http://localhost:3000)
docker compose --profile dev up --build dev

# 4. Refresh ./bgs/build/ on the host from the live BGS vocabularies
docker compose --profile data run --rm build-data
```

## Build the data (without Docker)

### 1. Geochronological Chart RDF (`bgs/build/bgs-chart.ttl`)

Requires Python 3.10+ and `pip install -r bgs/requirements.txt`:

```bash
pip install -r bgs/requirements.txt

# from the SPARQL endpoint
python bgs/build_bgs_chart.py --endpoint https://data.bgs.ac.uk/sparql

# or from a TTL file or URL (what the GitHub workflow does)
python bgs/build_bgs_chart.py --ttl path/to/Geochronology.ttl
python bgs/build_bgs_chart.py --ttl https://raw.githubusercontent.com/BritishGeologicalSurvey/vocabularies/main/prez/vocabs/Geochronology.ttl
```

### 2. Lexicon, RCS & Coverage JSON (`bgs/build/*.json`)

Uses Node.js and the existing `n3` dependency in `chart-ui`:

```bash
cd chart-ui
pnpm install

# Fetch all 6 BGS TTL files from GitHub (or VOCAB_BASE_URL) and build JSON artifacts
node scripts/build-bgs-vocabs.mjs

# Or build from local TTL files on disk (e.g. offline fixtures)
VOCAB_DIR=../bgs/fixtures MIN_UNITS=1 MIN_RCS=1 node scripts/build-bgs-vocabs.mjs

# Run unit tests for the RDF parser, model, and JSON builder
node --test scripts/test-bgs-vocabs.mjs
```

Environment variables for `scripts/build-bgs-vocabs.mjs`:

| Variable | Default | Purpose |
|---|---|---|
| `VOCAB_BASE_URL` | `https://raw.githubusercontent.com/BritishGeologicalSurvey/vocabularies/main/prez/vocabs/` | Base URL to download the 6 `.ttl` files when not cached locally |
| `VOCAB_DIR` | `bgs/build/.cache/vocabs` | Directory for cached or local `.ttl` files |
| `OUT_DIR` | `bgs/build` | Output directory for generated JSON artifacts |
| `MIN_UNITS` | `1000` | Minimum Lexicon units guard (fails build if fewer are parsed) |
| `MIN_RCS` | `500` | Minimum RCS rock classes guard (fails build if fewer are parsed) |

Committed sample outputs in `bgs/build/` allow local UI development without network access.

## Build or run the UI

```bash
cd chart-ui
pnpm install
CHART_SOURCE=bgs node scripts/check-chart-data.mjs    # sanity-check chart + Lexicon/RCS data
CHART_SOURCE=bgs pnpm dev                             # http://localhost:3000/chart/
CHART_SOURCE=bgs NUXT_APP_BASE_URL=/ pnpm generate    # static site in .output/public
```

## Files

| File | Purpose |
|---|---|
| `.github/workflows/deploy-bgs-chart.yml` | Fork build and deploy to GitHub Pages |
| `bgs/build_bgs_chart.py` | Geochronological Chart RDF generator |
| `bgs/queries/bgs-geochronology.rq` | CONSTRUCT run against the endpoint or TTL |
| `bgs/regional-schemes.json` | Regional scheme mapping for non-ICS units |
| `chart-ui/scripts/bgs-vocabs-model.mjs` | N3 RDF parser and domain model for Lexicon, RCS, Geochronology, and coverage |
| `chart-ui/scripts/build-bgs-vocabs.mjs` | Fetches TTLs and writes `lexicon-index.json`, `units/*.json`, `rcs.json`, `geochronology.json`, `coverage.json`, and `build.json` |
| `chart-ui/scripts/test-bgs-vocabs.mjs` | `node:test` test suite for the vocabulary model and builder |
| `chart-ui/utils/bgsVocabs.ts` | Vue composable and client helpers for loading and querying Lexicon/RCS data |
| `chart-ui/assets/bgs-site.css` | BGS design system styles scoped to `.bgs-shell` and `.bgs-view` |
| `chart-ui/components/BgsApp.vue` | Unified BGS shell managing tabs, URL query state, and cross-tab navigation |
| `chart-ui/components/LexiconTab.vue` | Lexicon search/filter table, CSV export, and unit view switcher |
| `chart-ui/components/LexiconUnitView.vue` | Full Lexicon unit detail sheet with linked data sidebar |
| `chart-ui/components/RcsTab.vue` | RCS search/filter table and hierarchy detail side panel |
| `chart-ui/components/LexiconBrowseTab.vue` | A–Z browse view for Lexicon rock units |
| `chart-ui/components/AboutTab.vue` | Field-by-field Lexicon/RCS coverage report and chart build summary |
| `chart-ui/components/BgsHeader.vue`, `BgsFooter.vue` | Unified BGS header, navigation tabs, and footer |
