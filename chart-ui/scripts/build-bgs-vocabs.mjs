#!/usr/bin/env node
// Build the BGS Lexicon, Rock Classification Scheme (RCS), Geochronology lookup,
// and data coverage JSON files into bgs/build/ (served at <base>/data/ by Nuxt).
//
// Usage:
//   node scripts/build-bgs-vocabs.mjs
//   VOCAB_DIR=/path/to/prez/vocabs node scripts/build-bgs-vocabs.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ancestors,
  ancestorOfRank,
  buildGeochron,
  buildRanks,
  buildRcs,
  buildUnits,
  coverage,
  labelLookup,
  linkLithology,
  loadTurtleFile,
  parseTurtle,
  unitBucketKey,
} from './bgs-vocabs-model.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');

export const DEFAULT_FILES = {
  lexicon: 'NamedRockUnit.ttl',
  rank: 'RockUnitRank.ttl',
  geochron: 'Geochronology.ttl',
  rcs: 'RockClassAll.ttl',
  typeLocalityType: 'TypeLocalityType.ttl',
  sourceReferenceType: 'SourceReferenceType.ttl',
};

export async function buildBgsVocabs(opts = {}) {
  const env = process.env;
  const vocabBaseUrl =
    opts.vocabBaseUrl ||
    env.VOCAB_BASE_URL ||
    'https://raw.githubusercontent.com/BritishGeologicalSurvey/vocabularies/main/prez/vocabs/';
  const vocabDir = opts.vocabDir ?? (env.VOCAB_DIR ? path.resolve(env.VOCAB_DIR) : null);
  const cacheDir = path.resolve(opts.cacheDir || env.VOCAB_CACHE_DIR || path.join(REPO, '.cache', 'vocabs'));
  const outDir = path.resolve(opts.outDir || env.OUT_DIR || path.join(REPO, 'bgs', 'build'));
  const minUnits = Number(opts.minUnits ?? env.MIN_UNITS ?? 18000);
  const minRcs = Number(opts.minRcs ?? env.MIN_RCS ?? 3500);
  const files = opts.files || DEFAULT_FILES;
  const log = opts.quiet ? () => {} : (...a) => console.log(...a);

  const t0 = Date.now();
  const srcDir = vocabDir || cacheDir;

  if (!vocabDir) {
    fs.mkdirSync(cacheDir, { recursive: true });
    const baseUrl = vocabBaseUrl.endsWith('/') ? vocabBaseUrl : vocabBaseUrl + '/';
    for (const name of Object.values(files)) {
      const url = new URL(name, baseUrl).toString();
      const started = Date.now();
      const res = await fetch(url, { headers: { 'User-Agent': 'bgs-geochron-chart vocab build' } });
      if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
      const text = await res.text();
      if (!text.trim()) throw new Error(`GET ${url} returned an empty body`);
      fs.writeFileSync(path.join(cacheDir, name), text);
      log(`fetched ${name} (${(text.length / 1e6).toFixed(1)} MB, ${Date.now() - started} ms)`);
    }
  }

  const graphs = {};
  for (const [k, name] of Object.entries(files)) {
    const f = path.join(srcDir, name);
    if (!fs.existsSync(f)) throw new Error(`Missing ${f}. Set VOCAB_DIR or allow fetching from VOCAB_BASE_URL.`);
    graphs[k] = loadTurtleFile(f);
  }

  const vocabMeta = Object.fromEntries(Object.entries(files).map(([k, f]) => [f, graphs[k].meta]));
  log(`parsed ${Object.values(graphs).reduce((n, g) => n + g.triples, 0).toLocaleString()} triples in ${Date.now() - t0} ms`);

  const typeLabels = new Map([...labelLookup(graphs.typeLocalityType), ...labelLookup(graphs.sourceReferenceType)]);
  const geochron = buildGeochron(graphs.geochron);
  const ranks = buildRanks(graphs.rank);
  const rcs = buildRcs(graphs.rcs);
  const units = buildUnits(graphs.lexicon, { typeLabels });
  linkLithology(units, rcs);
  const cov = coverage(units, rcs);

  if (units.size < minUnits) {
    throw new Error(`Only ${units.size} Lexicon units (MIN_UNITS=${minUnits}); refusing to build.`);
  }
  if (rcs.size < minRcs) {
    throw new Error(`Only ${rcs.size} RCS codes (MIN_RCS=${minRcs}); refusing to build.`);
  }

  const buildInfo = {
    builtAt: new Date().toISOString(),
    source: opts.sourceLabel || env.SOURCE_LABEL || vocabDir || vocabBaseUrl,
    lexiconVersion: graphs.lexicon.meta.version || null,
    lexiconFingerprint: graphs.lexicon.meta.fingerprint || null,
    units: units.size,
    rcs: rcs.size,
  };

  const write = (rel, content) => {
    const f = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content);
  };

  // 1. Lexicon search & browse index
  const unitCols = [
    'code',
    'notation',
    'name',
    'rank',
    'oldest',
    'youngest',
    'oldestMa',
    'youngestMa',
    'obsolete',
    'lith',
    'mapCode',
    'names',
    'text',
  ];
  const unitRows = [...units.values()].map((u) => [
    u.code,
    u.notation === u.code ? 0 : u.notation,
    u.name,
    u.rank ? ranks.get(u.rank)?.label || u.rank : '',
    u.oldest || '',
    u.youngest || '',
    u.oldestMa,
    u.youngestMa,
    u.deprecated ? 1 : 0,
    u.lithology.join(' '),
    u.mapCode || '',
    [...new Set([...u.altNames, ...u.obsoleteAltNames])].join(' | '),
    [u.definition, u.lithDesc, u.lower, u.upper, u.thickness, u.geoLimits].filter(Boolean).join(' '),
  ]);
  write('lexicon-index.json', JSON.stringify({ cols: unitCols, rows: unitRows }));

  // 2. Sharded unit detail files (data/units/{a..z,0-9}.json) for fast on-demand loading
  const buckets = new Map();
  for (const u of units.values()) {
    const key = unitBucketKey(u.code);
    if (!buckets.has(key)) buckets.set(key, {});
    const chain = ancestors(units, u.code);
    const period1 = u.oldest ? ancestorOfRank(geochron, u.oldest, 'PERIOD') : null;
    const period2 = u.youngest ? ancestorOfRank(geochron, u.youngest, 'PERIOD') : null;
    const periods = [period1?.label, period2 && period2.code !== period1?.code ? period2.label : null].filter(Boolean);

    buckets.get(key)[u.code] = {
      code: u.code,
      iri: u.iri,
      notation: u.notation,
      name: u.name,
      obsoleteNote: u.obsoleteNote,
      deprecated: u.deprecated,
      definition: u.definition,
      rank: u.rank,
      rankLabel: u.rank ? ranks.get(u.rank)?.label || u.rank : null,
      oldest: u.oldest,
      youngest: u.youngest,
      oldestMa: u.oldestMa,
      youngestMa: u.youngestMa,
      predominantAge: u.predominantAge,
      periods,
      lithology: u.lithology,
      lithDesc: u.lithDesc,
      lower: u.lower,
      upper: u.upper,
      thickness: u.thickness,
      geoLimits: u.geoLimits,
      mapCode: u.mapCode,
      mapSheets: u.mapSheets,
      definitionStatus: u.definitionStatus,
      formality: u.formality,
      parents: u.parents,
      chain,
      children: u.children
        .filter((c) => units.has(c))
        .sort((a, b) => units.get(a).name.localeCompare(units.get(b).name)),
      altNames: u.altNames,
      obsoleteAltNames: u.obsoleteAltNames,
      previous: u.previous.filter((c) => units.has(c)),
      replacedBy: u.replacedBy.filter((c) => units.has(c)),
      lateral: u.lateral.filter((c) => units.has(c)),
      typeLocalities: u.typeLocalities,
      references: u.references,
    };
  }
  fs.rmSync(path.join(outDir, 'units'), { recursive: true, force: true });
  for (const [key, map] of buckets.entries()) {
    write(`units/${key}.json`, JSON.stringify(map));
  }

  // 3. Geochronology lookup
  write(
    'geochronology.json',
    JSON.stringify(
      geochron.ordered.map((d) => ({
        code: d.code,
        iri: d.iri,
        label: d.label,
        rank: d.rank,
        depth: d.depth,
        min: d.min,
        max: d.max,
        color: d.color,
        parent: d.parent,
      })),
    ),
  );

  // 4. Rock Classification Scheme (RCS)
  const rcsCols = [
    'code',
    'name',
    'type',
    'obsolete',
    'parents',
    'children',
    'definition',
    'units',
    'qualifiers',
    'sameAs',
    'indexName',
  ];
  const rcsRows = [...rcs.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((r) => [
      r.code,
      r.label,
      r.type,
      r.deprecated ? 1 : 0,
      r.parents.join(' '),
      r.children.join(' '),
      r.definition,
      r.lexiconUnits,
      r.qualifiers.join(' | '),
      r.sameAs || '',
      r.indexName,
    ]);
  write('rcs.json', JSON.stringify({ cols: rcsCols, rows: rcsRows }));

  // 5. Coverage & Build info
  write('coverage.json', JSON.stringify(cov, null, 2));
  write('build.json', JSON.stringify({ ...buildInfo, vocabularies: vocabMeta }, null, 2));

  if (env.GITHUB_STEP_SUMMARY) {
    const lines = [
      '## BGS Lexicon & RCS data',
      `Source: \`${buildInfo.source}\`, Lexicon version \`${buildInfo.lexiconVersion || 'unversioned'}\``,
      '',
      '| Dataset | Entries | Current |',
      '|---|---:|---:|',
      `| Lexicon of Named Rock Units | ${cov.lexicon.total.toLocaleString('en-GB')} | ${cov.lexicon.current.toLocaleString('en-GB')} |`,
      `| Rock Classification Scheme (RCS) | ${cov.rcs.total.toLocaleString('en-GB')} | ${cov.rcs.current.toLocaleString('en-GB')} |`,
      `| Geochronology divisions | ${geochron.ordered.length.toLocaleString('en-GB')} | – |`,
    ];
    fs.appendFileSync(env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  }

  log(`wrote Lexicon (${units.size.toLocaleString()} units in ${buckets.size} buckets) & RCS (${rcs.size.toLocaleString()} codes) to ${outDir} in ${Date.now() - t0} ms`);
  return { units, rcs, geochron, cov, buildInfo };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildBgsVocabs().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
