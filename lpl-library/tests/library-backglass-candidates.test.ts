import assert from 'node:assert/strict';
import test from 'node:test';
import { cardArtworkCandidates, type LibraryGame } from '../src/lib/libraryData';

test('selected edition override precedes the largest OPDB image, retaining fallbacks', () => {
  const game = {
    backglassOverrideUrls: ['/pinball/images/backglasses/selected_1400.webp'],
    primaryImageLargeUrl: 'https://img.opdb.org/selected-large.jpg',
    primaryImageUrl: 'https://img.opdb.org/selected-medium.jpg',
  } as LibraryGame;
  assert.deepEqual(cardArtworkCandidates(game).slice(0, 3), [
    '/pinball/images/backglasses/selected_1400.webp',
    'https://img.opdb.org/selected-large.jpg',
    'https://img.opdb.org/selected-medium.jpg',
  ]);
});

test('older cached catalogs without an override layer still render OPDB artwork', () => {
  const game = {
    primaryImageLargeUrl: 'https://img.opdb.org/selected-large.jpg', primaryImageUrl: null,
  } as LibraryGame;
  assert.equal(cardArtworkCandidates(game)[0], game.primaryImageLargeUrl);
});
