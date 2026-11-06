# BGS Geochronological Chart

A BGS build of the ICS chart UI. The same `chart-ui` app builds either the
ICS chart (default) or the BGS chart (`CHART_SOURCE=bgs`).

**What comes from where:**

| From | What |
|---|---|
| ICS `chart.ttl` | Hierarchy, ordering, ranks, GSSP/GSSA ratification |
| BGS Geochronology vocabulary | Numeric ages, labels, colours, notations, definitions, identifiers |
| BGS only | British and NW European regional series, stages and substages, and Marine Isotope Stages, as extra columns plus a Quaternary panel |

Each ICS unit is joined to a BGS concept through BGS's CGI `skos:exactMatch`.
When a unit has several candidate matches, the one at the same rank wins.
Where the CGI link is missing or wrong, the join falls back to matching
labels. Where BGS has no value (currently colour, for Visean and the three
Holocene ages), the ICS value is used and the cell gets a dashed outline.
`build/bgs-chart-report.json` records every join, fallback, conflict and
age difference. The data problems behind the fallbacks are written up as a
triples-ql-views issue.

## Deploy from a fork to GitHub Pages

`.github/workflows/deploy-bgs-chart.yml` builds and deploys the BGS chart in
any fork. Upstream's `deploy-chart.yml` is guarded so it only runs in
`i-c-stratigraphy/chart`, so it can't overwrite the BGS site.

1. Fork the repository and push this change to `main`.
2. In the fork:
   - **Actions** tab: enable workflows (GitHub disables them in new forks).
   - **Settings → Pages → Source:** choose **GitHub Actions**.
3. Run the workflow from the Actions tab, or push to `main`. The site
   appears at `https://<owner>.github.io/<repo>/`.

Each run:
- reads `prez/vocabs/Geochronology.ttl` from `BritishGeologicalSurvey/vocabularies`, pinned to that branch's current commit
- generates the chart data (the run page shows a summary of joins and fallbacks)
- validates the data, builds the site and deploys it

It runs on every push to `main`, daily at 04:23 UTC to pick up vocabulary
changes, manually, and on a `bgs-vocabularies-updated` repository dispatch.
To rebuild as soon as the vocabularies repo publishes, add a step there that
calls:

```bash
gh api repos/<owner>/<repo>/dispatches -f event_type=bgs-vocabularies-updated
```

That call needs a token with access to this repo.

Optional repository variables (**Settings → Secrets and variables →
Actions → Variables**):

| Variable | Default | Use |
|---|---|---|
| `BGS_VOCABS_REPO` | `BritishGeologicalSurvey/vocabularies` | Source repository |
| `BGS_VOCABS_REF` | `main` | Branch, tag or commit to read |
| `BGS_GEOCHRON_PATH` | `prez/vocabs/Geochronology.ttl` | File within it |
| `BGS_SPARQL_ENDPOINT` | (unset) | Read from a SPARQL endpoint instead of the TTL |
| `PAGES_BASE_URL` | `/<repo>/` | Set to `/` for a custom domain or a `<owner>.github.io` repo |

The deployed site also serves `data/bgs-chart.ttl` and
`data/bgs-chart-report.json`, linked from the page header.

## Build the data

You need Python 3.10+ and `pip install -r bgs/requirements.txt`. One query
(`queries/bgs-geochronology.rq`) serves both sources:

```bash
pip install -r bgs/requirements.txt

# from the SPARQL endpoint
python bgs/build_bgs_chart.py --endpoint https://data.bgs.ac.uk/sparql

# or from a TTL file or URL (what the GitHub workflow does)
python bgs/build_bgs_chart.py --ttl path/to/Geochronology.ttl
python bgs/build_bgs_chart.py --ttl https://raw.githubusercontent.com/BritishGeologicalSurvey/vocabularies/main/prez/vocabs/Geochronology.ttl
```

This writes `bgs/build/bgs-chart.ttl` (read by the UI) and
`bgs/build/bgs-chart-report.json`. The workflow regenerates both on every
run. The committed copies are only for local development without network
access.

## Build or run the UI

```bash
cd chart-ui
pnpm install
CHART_SOURCE=bgs node scripts/check-chart-data.mjs    # sanity-check the data
CHART_SOURCE=bgs pnpm dev                             # http://localhost:3000/chart/
CHART_SOURCE=bgs NUXT_APP_BASE_URL=/ pnpm generate    # static site in .output/public
```

Without `CHART_SOURCE` everything behaves exactly as upstream.

## Files

| File | Purpose |
|---|---|
| `.github/workflows/deploy-bgs-chart.yml` | Fork build and deploy to GitHub Pages |
| `bgs/build_bgs_chart.py` | Generator |
| `bgs/requirements.txt` | Generator dependencies |
| `bgs/queries/bgs-geochronology.rq` | CONSTRUCT run against the endpoint or the TTL |
| `bgs/regional-schemes.json` | Which regional scheme each non-ICS unit belongs to (by notation). The vocabulary doesn't record this. Delete it once triples-ql-views does |
| `chart-ui/utils/chartConfig.ts` | Everything that differs between the ICS and BGS builds |
| `chart-ui/components/RegionalColumns.vue` | Regional columns beside each segment. Measures where the ICS rows rendered, so alignment holds under every scale option |
| `chart-ui/components/QuaternaryPanel.vue` | Quaternary panel (log or linear scale) with the MIS |
| `chart-ui/components/BgsHeader.vue`, `BgsFooter.vue` | BGS page header and footer, including ICS CC BY 4.0 attribution |

## Behaviour to know about

- **Quaternary units appear only in the panel.** The main chart gives the
  whole Quaternary a few rows, so its regional stages and the MIS would be
  unreadable there.
- **MIS 13–104 have a single age in BGS** (max = min). Each is drawn from
  that age to the next younger stage, with a dashed outline.
- **MIS shading is presentation only, not BGS data:** odd stages are warm,
  even stages cold; for substages, a/c/e are warm and b/d cold.
- **Chart-specific terms use a placeholder namespace,**
  `http://data.bgs.ac.uk/def/geochron-chart#`. Rename it in
  `build_bgs_chart.py` and `utils/layout.ts` if BGS wants to publish them.
- **No ICS logos, PDF downloads or release lookups** in the BGS build. The
  language selector is hidden, because BGS labels are English only.
