import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanText,
  isInvertedName,
  isPlaceholder,
  rcsDefinition,
  splitObsoleteLabel,
  unitBucketKey,
} from './bgs-vocabs-model.mjs';
import { buildBgsVocabs } from './build-bgs-vocabs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(here, '../../bgs/fixtures');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bgs-vocabs-'));
const outDir = path.join(tmp, 'build');
let result;
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(outDir, rel), 'utf8'));

before(async () => {
  result = await buildBgsVocabs({
    vocabDir: fixturesDir,
    outDir,
    minUnits: 1,
    minRcs: 1,
    quiet: true,
  });
});

test('splitObsoleteLabel separates the obsolete note', () => {
  assert.deepEqual(splitObsoleteLabel('Keuper Marl [Obsolete: use MMG]'), {
    name: 'Keuper Marl',
    note: 'Obsolete: use MMG',
  });
  assert.deepEqual(splitObsoleteLabel('Dungiven Formation [Duplicate 2: use DUNN]'), {
    name: 'Dungiven Formation',
    note: 'Duplicate 2: use DUNN',
  });
  assert.deepEqual(splitObsoleteLabel('Mercia Mudstone Group'), {
    name: 'Mercia Mudstone Group',
    note: null,
  });
});

test('rcsDefinition strips repeated label and treats label-only text as no definition', () => {
  assert.equal(rcsDefinition('Trachyte', 'Trachyte - A type of trachytic-rock.'), 'A type of trachytic-rock.');
  assert.equal(rcsDefinition('Aeolianite (where cemented)', 'Aeolianite (where cemented)'), '');
  assert.equal(rcsDefinition('Felsite, albite', 'Felsite, albite'), '');
  assert.ok(isInvertedName('Albite felsite', 'Felsite, albite'));
  assert.ok(isInvertedName('Albite-chlorite paraschist', 'Paraschist, albite-chlorite'));
  assert.ok(!isInvertedName('Trachyte', 'A type of trachytic-rock.'));
  assert.equal(rcsDefinition('X', 'Some other text'), 'Some other text');
});

test('cleanText and isPlaceholder', () => {
  assert.equal(cleanText('a \r\n\r\nb\r\n'), 'a\n\nb');
  assert.equal(cleanText(undefined), '');
  assert.ok(isPlaceholder('[Obsolete: use MMG]'));
  assert.ok(isPlaceholder('[Obsolete]'));
  assert.ok(isPlaceholder('[Duplicate 2: use DUNN]'));
  assert.ok(!isPlaceholder('Trachyte.'));
});

test('writes lexicon, rcs, geochronology, coverage and unit bucket JSON files', () => {
  assert.equal(result.units.size, 6);
  for (const f of ['lexicon-index.json', 'rcs.json', 'geochronology.json', 'coverage.json', 'build.json']) {
    assert.ok(fs.existsSync(path.join(outDir, f)), f);
  }
  const mBucket = readJson(`units/${unitBucketKey('MMG')}.json`);
  assert.ok(mBucket.MMG);
  assert.equal(mBucket.MMG.name, 'Mercia Mudstone Group');
  assert.deepEqual(mBucket.MMG.chain, ['NRS']);
  assert.deepEqual(mBucket.MMG.periods, ['Triassic Period']);
  assert.deepEqual(mBucket.MMG.altNames, ['Mercia Mudstones']);
  assert.deepEqual(mBucket.MMG.previous, ['KM', 'H4292']);

  const eBucket = readJson(`units/${unitBucketKey('EILD')}.json`);
  assert.equal(eBucket.EILD.mapCode, 'EILD');
  assert.equal(eBucket.EILD.definitionStatus, 'Full');
  assert.equal(eBucket.EILD.geoLimits, 'Eildon Hills, Melrose, Scottish Borders.');
  assert.equal(eBucket.EILD.typeLocalities[0].type, 'Type Area');
  assert.match(eBucket.EILD.references[0].text, /McRobert, R A\. 1914/);
  assert.deepEqual(eBucket.EILD.mapSheets, ['S025']);
  assert.deepEqual(eBucket.EILD.lithology, ['BA', 'TR']);

  const kBucket = readJson(`units/${unitBucketKey('KM')}.json`);
  assert.equal(kBucket.KM.lithDesc, '');
  assert.deepEqual(kBucket.KM.altNames, []);
  assert.deepEqual(kBucket.KM.replacedBy, ['MMG']);
});

test('search indexes and coverage report', () => {
  const lex = readJson('lexicon-index.json');
  const ix = Object.fromEntries(lex.cols.map((c, i) => [c, i]));
  const eild = lex.rows.find((r) => r[ix.code] === 'EILD');
  assert.equal(eild[ix.rank], 'Laccolith');
  assert.equal(eild[ix.mapCode], 'EILD');
  assert.equal(eild[ix.lith], 'BA TR');
  const h = lex.rows.find((r) => r[ix.code] === 'H4292');
  assert.equal(h[ix.notation], '-4292');

  const rcs = readJson('rcs.json');
  const rx = Object.fromEntries(rcs.cols.map((c, i) => [c, i]));
  const tr = rcs.rows.find((r) => r[rx.code] === 'TR');
  assert.equal(tr[rx.definition], 'A type of trachytic-rock.');
  assert.equal(tr[rx.units], 1);
  assert.equal(tr[rx.parents], 'TRR');
  assert.equal(rcs.rows.find((r) => r[rx.code] === 'AGTT')[rx.type], 'Composite');
  const felab = rcs.rows.find((r) => r[rx.code] === 'FELAB');
  assert.equal(felab[rx.definition], '');
  assert.equal(felab[rx.indexName], 'Felsite, albite');
  const baalk = rcs.rows.find((r) => r[rx.code] === 'BAALK');
  assert.equal(baalk[rx.definition], 'A type of basalt.');
  assert.equal(baalk[rx.indexName], 'Basalt, alkali');

  const cov = readJson('coverage.json');
  const f = (name) => cov.lexicon.fields.find((x) => x.field.startsWith(name));
  assert.equal(f('Preferred map code').all, 1);
  assert.equal(f('Stratotypes').all, 1);
  assert.equal(f('Lithological description').all, 2);
});

test('build guard refuses a near-empty export', async () => {
  await assert.rejects(
    buildBgsVocabs({
      vocabDir: fixturesDir,
      outDir: path.join(tmp, 'guard'),
      minUnits: 1000,
      quiet: true,
    }),
    /refusing to build/,
  );
});
