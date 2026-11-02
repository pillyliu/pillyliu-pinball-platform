import assert from 'node:assert/strict';
import test from 'node:test';
import { pinProfPlayfieldShortLabel, resolvedPlayfieldOptions, type LibraryGame } from '../src/lib/libraryData';

test('three distinct playfield choices reach the page without a two-choice limit', () => {
  const choices = ['Pro', 'Pre/LE', '70'].map((label, index) => ({
    title: `PP · ${label}`, candidates: [`https://data.pinprof.com/pinball/images/playfields/view-${index}.webp`],
  }));
  const game = { pinProfPlayfields: choices } as LibraryGame;
  assert.deepEqual(resolvedPlayfieldOptions(game, null), choices);
});

test('playfield labels use the agreed compact edition names', () => {
  for (const [input, expected] of [['Prem/LE', 'Pre/LE'], ['Premium', 'Pre'], ['70th Anniversary', '70'],
    ['50th anniversary', '50'], ['Home Edition', 'Home'], ['LE', 'LE'], ["Collector's Edition", 'CE']]) {
    assert.equal(pinProfPlayfieldShortLabel(input), expected);
  }
});
