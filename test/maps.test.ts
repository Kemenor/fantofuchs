import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapsPlaceUrl, mapsWalkToUrl, mapsWalkUrl } from '../src/maps.ts';
import type { Place } from '../src/model/types.ts';

const trafo: Place = { id: 'trafo', name: 'Trafo', address: 'Brown Boveri Platz 1', lat: 47.4785, lon: 8.3056 };
const orient: Place = { id: 'orient', name: 'Orient', address: '', lat: 47.47, lon: 8.3166 };

test('the pin link carries exact coordinates, nothing else', () => {
  assert.equal(
    mapsPlaceUrl(trafo),
    'https://www.google.com/maps/search/?api=1&query=47.4785%2C8.3056',
  );
});

test('the route link asks for walking between the two buildings', () => {
  const url = mapsWalkUrl(trafo, orient);
  assert.ok(url.startsWith('https://www.google.com/maps/dir/?api=1'));
  assert.ok(url.includes('origin=47.4785%2C8.3056'));
  assert.ok(url.includes('destination=47.47%2C8.3166'));
  assert.ok(url.includes('travelmode=walking'));
});

test('the route-from-here link names only the destination', () => {
  const url = mapsWalkToUrl(orient);
  assert.ok(!url.includes('origin='));
  assert.ok(url.includes('destination=47.47%2C8.3166'));
  assert.ok(url.includes('travelmode=walking'));
});
