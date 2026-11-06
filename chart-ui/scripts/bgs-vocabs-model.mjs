// RDF parser and domain model for BGS Lexicon, Rock Classification Scheme (RCS),
// and Geochronology vocabularies. Adapted from lexicon-rcs-static/build/{rdf,model}.mjs.

import fs from 'node:fs';
import N3 from 'n3';

export const NS = {
  skos: 'http://www.w3.org/2004/02/skos/core#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  dcterms: 'http://purl.org/dc/terms/',
  reg: 'http://purl.org/linked-data/registry#',
  schema: 'https://schema.org/',
  lex: 'http://data.bgs.ac.uk/ref/Lexicon/',
  geo: 'http://data.bgs.ac.uk/ref/Geochronology/',
};

export const ID = {
  unit: 'http://data.bgs.ac.uk/id/Lexicon/NamedRockUnit/',
  rank: 'http://data.bgs.ac.uk/id/Lexicon/RockUnitRank/',
  division: 'http://data.bgs.ac.uk/id/Geochronology/Division/',
  rcs: 'http://data.bgs.ac.uk/id/EarthMaterialClass/RockClassAll/',
  rockName: 'http://data.bgs.ac.uk/id/EarthMaterialClass/RockName/',
  rockComposite: 'http://data.bgs.ac.uk/id/EarthMaterialClass/RockComposite/',
  rockDummy: 'http://data.bgs.ac.uk/id/EarthMaterialClass/RockDummy/',
  deprecated: 'https://linked.data.gov.au/def/reg-statuses/deprecated',
};

const S = NS.skos;
const L = NS.lex;

export const P = {
  prefLabel: S + 'prefLabel',
  altLabel: S + 'altLabel',
  notation: S + 'notation',
  definition: S + 'definition',
  broader: S + 'broader',
  narrower: S + 'narrower',
  exactMatch: S + 'exactMatch',
  status: NS.reg + 'status',
  sameAs: NS.owl + 'sameAs',
  rdfsLabel: NS.rdfs + 'label',
  rdfsComment: NS.rdfs + 'comment',
  color: NS.schema + 'color',
  citation: NS.dcterms + 'bibliographicCitation',
  description: NS.dcterms + 'description',
  skosNote: S + 'note',
  rank: L + 'hasRockUnitRank',
  oldest: L + 'hasOldestAge',
  youngest: L + 'hasYoungestAge',
  oldestMa: L + 'hasOldestAgeValue',
  youngestMa: L + 'hasYoungestAgeValue',
  predominantAge: L + 'hasPredominantAge',
  lithology: L + 'hasLithology',
  lithDesc: L + 'hasLithologyDescription',
  lower: L + 'hasLowerBoundaryDefinition',
  upper: L + 'hasUpperBoundaryDefinition',
  thickness: L + 'hasThicknessDescription',
  obsoleteEquivalent: L + 'hasObsoleteEquivalent',
  obsoleteEquivalentOf: L + 'isObsoleteEquivalentOf',
  lateral: L + 'hasLateralEquivalent',
  geoRank: NS.geo + 'hasGeochronologyRank',
  geoMax: NS.geo + 'maxAgeValue',
  geoMin: NS.geo + 'minAgeValue',

  // Defined in Lexicon-predicates.ttl (switched on automatically when present)
  geoLimits: L + 'hasGeographicalDistribution',
  typeLocality: L + 'hasTypeLocality',
  typeLocalityType: L + 'isTypeLocalityType',
  sourceInfo: L + 'hasSourceInfo',
  sourceInfoType: L + 'isSourceInfoType',
  definitionStatus: L + 'hasDefinitionStatus',
  formality: L + 'hasFormality',

  // Proposed predicates
  mapCode: L + 'hasPreferredMapCode',
  mapSheet: L + 'appearsOnMapSheet',
  rcsQualifier: 'http://data.bgs.ac.uk/ref/EarthMaterialClass/hasQualifier',
};

export const tail = (iri) => (iri ? iri.slice(iri.lastIndexOf('/') + 1) : '');

export function unitBucketKey(code = '') {
  const first = (String(code).replace(/^[^A-Za-z0-9]+/, '')[0] || '').toLowerCase();
  return /[a-z]/.test(first) ? first : '0-9';
}

export class Graph {
  constructor() {
    this.s = new Map();
    this.meta = {};
    this.triples = 0;
  }

  add(subject, predicate, object) {
    let props = this.s.get(subject);
    if (!props) this.s.set(subject, (props = new Map()));
    let list = props.get(predicate);
    if (!list) props.set(predicate, (list = []));
    list.push(object);
    this.triples++;
  }

  all(s, p) {
    return (this.s.get(s)?.get(p) || []).map((t) => t.v);
  }

  one(s, p) {
    const list = this.s.get(s)?.get(p);
    if (!list || !list.length) return undefined;
    const en = list.find((t) => !t.lang || t.lang === 'en');
    return (en || list[0]).v;
  }

  subjectsWithPrefix(prefix) {
    const out = [];
    for (const k of this.s.keys()) if (k.startsWith(prefix)) out.push(k);
    return out;
  }
}

export function readHeader(text) {
  const meta = {};
  for (const line of text.split('\n', 20)) {
    const m = /^#\s*([a-z-]+):\s*(.+)$/.exec(line);
    if (m) meta[m[1]] = m[2].trim();
  }
  return meta;
}

export function parseTurtle(text, name = 'input') {
  const g = new Graph();
  g.meta = readHeader(text);
  const parser = new N3.Parser({ format: 'text/turtle' });
  let quads;
  try {
    quads = parser.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse ${name}: ${err.message}`);
  }
  for (const q of quads) {
    const o = q.object;
    const term =
      o.termType === 'Literal'
        ? { v: o.value, iri: false, lang: o.language || undefined, dt: o.datatype?.value }
        : { v: o.value, iri: true };
    g.add(q.subject.value, q.predicate.value, term);
  }
  return g;
}

export function loadTurtleFile(file) {
  return parseTurtle(fs.readFileSync(file, 'utf8'), file);
}

const OBSOLETE_SUFFIX = /\s*\[((?:Obsolete|Duplicate)[^\]]*)\]\s*$/i;

export function splitObsoleteLabel(label = '') {
  const m = OBSOLETE_SUFFIX.exec(label);
  if (!m) return { name: label.trim(), note: null };
  return { name: label.slice(0, m.index).trim(), note: m[1].trim() };
}

const PLACEHOLDER = /^\[(?:Obsolete|Duplicate)[^\]]*\]\.?$/i;
export const isPlaceholder = (s) => PLACEHOLDER.test(String(s || '').trim());

export function cleanText(s) {
  if (s == null) return '';
  return String(s).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
}

export function rcsDefinition(label, def) {
  const d = cleanText(def);
  if (!d || d === label) return '';
  const prefix = `${label} - `;
  return d.startsWith(prefix) ? d.slice(prefix.length).trim() : d;
}

const wordKey = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).sort().join(' ');

export function isInvertedName(label, text) {
  return !!text && text !== label && wordKey(text) === wordKey(label);
}

export function buildGeochron(g) {
  const divisions = new Map();
  for (const iri of g.subjectsWithPrefix(ID.division)) {
    const label = g.one(iri, P.prefLabel);
    if (!label) continue;
    const num = (p) => {
      const v = g.one(iri, p);
      return v == null || v === '' ? null : Number(v);
    };
    divisions.set(tail(iri), {
      code: tail(iri),
      iri,
      label,
      rank: tail(g.one(iri, P.geoRank) || ''),
      max: num(P.geoMax),
      min: num(P.geoMin),
      color: g.one(iri, P.color) || null,
      parent: tail(g.one(iri, P.broader) || '') || null,
    });
  }
  const kids = new Map();
  for (const d of divisions.values()) {
    if (d.parent && divisions.has(d.parent)) {
      if (!kids.has(d.parent)) kids.set(d.parent, []);
      kids.get(d.parent).push(d);
    }
  }
  const byAge = (a, b) => (b.max ?? -1) - (a.max ?? -1) || a.label.localeCompare(b.label);
  const ordered = [];
  const visit = (d, depth) => {
    d.depth = depth;
    ordered.push(d);
    for (const k of (kids.get(d.code) || []).sort(byAge)) visit(k, depth + 1);
  };
  const roots = [...divisions.values()].filter((d) => !d.parent || !divisions.has(d.parent)).sort(byAge);
  for (const r of roots) visit(r, 0);
  return { divisions, ordered };
}

export function ancestorOfRank(geochron, code, rank) {
  const seen = new Set();
  let d = geochron.divisions.get(code);
  while (d && !seen.has(d.code)) {
    if (d.rank === rank) return d;
    seen.add(d.code);
    d = d.parent ? geochron.divisions.get(d.parent) : null;
  }
  return null;
}

export function buildRanks(g) {
  const ranks = new Map();
  for (const iri of g.subjectsWithPrefix(ID.rank)) {
    const label = g.one(iri, P.prefLabel);
    if (label) ranks.set(tail(iri), { code: tail(iri), label, definition: cleanText(g.one(iri, P.definition)) });
  }
  return ranks;
}

export function labelLookup(g) {
  const m = new Map();
  for (const [s] of g.s) {
    const l = g.one(s, P.prefLabel);
    if (l) m.set(s, l);
  }
  return m;
}

export function buildRcs(g) {
  const rcs = new Map();
  for (const iri of g.subjectsWithPrefix(ID.rcs)) {
    const label = g.one(iri, P.prefLabel);
    if (!label) continue;
    const same = g.all(iri, P.sameAs);
    let type = 'Rock name';
    let sameAs = same.find((x) => x.startsWith(ID.rockName)) || null;
    if (same.some((x) => x.startsWith(ID.rockComposite))) {
      type = 'Composite';
      sameAs = same.find((x) => x.startsWith(ID.rockComposite));
    } else if (same.some((x) => x.startsWith(ID.rockDummy))) {
      type = 'Dummy';
      sameAs = same.find((x) => x.startsWith(ID.rockDummy));
    }
    let def = rcsDefinition(label, g.one(iri, P.definition));
    let inverted = isInvertedName(label, def);
    let indexName = inverted ? def : '';
    const m = !inverted && /^(.+?) - (.+)$/s.exec(def);
    if (m && isInvertedName(label, m[1])) {
      indexName = m[1];
      def = m[2].trim();
    }
    rcs.set(tail(iri), {
      code: tail(iri),
      iri,
      sameAs,
      label,
      type,
      deprecated: g.one(iri, P.status) === ID.deprecated,
      definition: inverted ? '' : def,
      indexName,
      parents: g.all(iri, P.broader).map(tail),
      children: g.all(iri, P.narrower).map(tail),
      qualifiers: g.all(iri, P.rcsQualifier).map(cleanText).filter(Boolean),
      lexiconUnits: 0,
    });
  }
  return rcs;
}

function nested(g, value, textPreds, typePred, typeLabels) {
  const props = g.s.get(value);
  if (!props) return { type: null, text: cleanText(value) };
  let text = '';
  for (const p of textPreds) {
    text = cleanText(g.one(value, p));
    if (text) break;
  }
  const typeIri = typePred ? g.one(value, typePred) : null;
  return { type: typeIri ? typeLabels.get(typeIri) || tail(typeIri) : null, text };
}

export function buildUnits(g, { typeLabels = new Map() } = {}) {
  const units = new Map();
  for (const iri of g.subjectsWithPrefix(ID.unit)) {
    const notation = g.one(iri, P.notation);
    if (!notation) continue;
    const code = tail(iri);
    const pref = g.one(iri, P.prefLabel) || code;
    const { name, note } = splitObsoleteLabel(pref);
    const alt = g.all(iri, P.altLabel).map((l) => splitObsoleteLabel(l));
    const num = (p) => {
      const v = g.one(iri, p);
      return v == null || v === '' ? null : Number(v);
    };
    const statusIri = g.one(iri, P.definitionStatus);
    units.set(code, {
      code,
      iri,
      notation,
      label: pref,
      name,
      obsoleteNote: note,
      deprecated: g.one(iri, P.status) === ID.deprecated,
      definition: cleanText(g.one(iri, P.definition)),
      rank: tail(g.one(iri, P.rank) || '') || null,
      oldest: tail(g.one(iri, P.oldest) || '') || null,
      youngest: tail(g.one(iri, P.youngest) || '') || null,
      oldestMa: num(P.oldestMa),
      youngestMa: num(P.youngestMa),
      predominantAge: tail(g.one(iri, P.predominantAge) || '') || null,
      lithology: [...new Set(g.all(iri, P.lithology).map(tail))].sort(),
      lithDesc: isPlaceholder(g.one(iri, P.lithDesc)) ? '' : cleanText(g.one(iri, P.lithDesc)),
      lower: cleanText(g.one(iri, P.lower)),
      upper: cleanText(g.one(iri, P.upper)),
      thickness: cleanText(g.one(iri, P.thickness)),
      geoLimits: cleanText(g.one(iri, P.geoLimits)),
      mapCode: cleanText(g.one(iri, P.mapCode)),
      mapSheets: [...new Set(g.all(iri, P.mapSheet).map((v) => (v.includes('/') ? tail(v) : v.trim())))].sort(),
      definitionStatus: statusIri ? (g.s.has(statusIri) ? g.one(statusIri, P.prefLabel) : tail(statusIri)) : null,
      formality: cleanText(g.one(iri, P.formality)) || null,
      parents: g.all(iri, P.broader).map(tail),
      children: g.all(iri, P.narrower).map(tail),
      altNames: alt.filter((a) => !a.note).map((a) => a.name),
      obsoleteAltNames: alt.filter((a) => a.note).map((a) => a.name),
      previous: g.all(iri, P.obsoleteEquivalent).map(tail),
      replacedBy: g.all(iri, P.obsoleteEquivalentOf).map(tail),
      lateral: g.all(iri, P.lateral).map(tail),
      typeLocalities: g
        .all(iri, P.typeLocality)
        .map((v) => nested(g, v, [P.rdfsComment, P.description, P.skosNote, P.rdfsLabel], P.typeLocalityType, typeLabels)),
      references: g
        .all(iri, P.sourceInfo)
        .map((v) => nested(g, v, [P.citation, P.rdfsLabel, P.rdfsComment, P.description], P.sourceInfoType, typeLabels)),
    });
  }
  for (const u of units.values()) {
    if (!u.replacedBy.length) continue;
    const repl = new Set(u.replacedBy.map((c) => units.get(c)?.name.toLowerCase()).filter(Boolean));
    u.altNames = u.altNames.filter((n) => !repl.has(n.toLowerCase()));
  }
  return units;
}

export function ancestors(units, code, max = 30) {
  const chain = [];
  const seen = new Set([code]);
  let u = units.get(code);
  while (u && u.parents.length && chain.length < max) {
    const p = u.parents.find((c) => units.has(c) && !seen.has(c));
    if (!p) break;
    seen.add(p);
    chain.unshift(p);
    u = units.get(p);
  }
  return chain;
}

export function linkLithology(units, rcs) {
  for (const u of units.values()) {
    for (const c of u.lithology) {
      const r = rcs.get(c);
      if (r) r.lexiconUnits++;
    }
  }
}

export function coverage(units, rcs) {
  const all = [...units.values()];
  const current = all.filter((u) => !u.deprecated);
  const count = (list, f) => list.filter(f).length;
  const lex = [
    ['Name (prefLabel)', (u) => !!u.name, 'present'],
    ['Rank', (u) => !!u.rank, 'present'],
    ['Oldest / youngest age', (u) => !!u.oldest, 'present'],
    ['Lithology (RCS codes)', (u) => u.lithology.length > 0, 'present'],
    ['Lithological description', (u) => !!u.lithDesc, 'present'],
    ['Lower boundary', (u) => !!u.lower, 'present'],
    ['Upper boundary', (u) => !!u.upper, 'present'],
    ['Thickness', (u) => !!u.thickness, 'present'],
    ['Parent unit', (u) => u.parents.length > 0, 'present'],
    ['Alternative names', (u) => u.altNames.length > 0, 'partial'],
    ['Lexicon status code (e.g. "Full")', (u) => !!u.definitionStatus, 'missing'],
    ['Preferred map code', (u) => !!u.mapCode, 'missing'],
    ['Geographical limits', (u) => !!u.geoLimits, 'missing'],
    ['Stratotypes / type localities', (u) => u.typeLocalities.length > 0, 'missing'],
    ['References', (u) => u.references.length > 0, 'missing'],
    ['1:50k map sheets', (u) => u.mapSheets.length > 0, 'missing'],
  ].map(([field, f, expected]) => ({ field, expected, all: count(all, f), current: count(current, f) }));
  const r = [...rcs.values()];
  const rcsRows = [
    ['Name', (x) => !!x.label, 'present'],
    ['Definition (not just the name repeated or inverted)', (x) => !!x.definition, 'partial'],
    ['Parent class', (x) => x.parents.length > 0, 'present'],
    ['Qualifiers (Q1–Q4)', (x) => x.qualifiers.length > 0, 'missing'],
  ].map(([field, f, expected]) => ({ field, expected, all: count(r, f), current: count(r.filter((x) => !x.deprecated), f) }));
  return {
    lexicon: { total: all.length, current: current.length, fields: lex },
    rcs: { total: r.length, current: r.filter((x) => !x.deprecated).length, fields: rcsRows },
  };
}
