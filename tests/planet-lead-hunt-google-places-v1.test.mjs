import assert from 'node:assert/strict';
import {
  GOOGLE_PLACES_FIELD_MASK,
  googlePlaceToCandidate,
  searchGooglePlaces,
} from '../functions/_lib/planet-lead-hunt-google-places.js';

let captured = null;
const fetchImpl = async (url, options) => {
  captured = { url, options };
  return new Response(JSON.stringify({
    places: [{
      id: 'place-joinville-1',
      displayName: { text: 'Café Exemplo' },
      formattedAddress: 'Rua Exemplo, 123 - Centro, Joinville - SC',
      addressComponents: [
        { longText: 'Joinville', shortText: 'Joinville', types: ['locality'] },
        { longText: 'Santa Catarina', shortText: 'SC', types: ['administrative_area_level_1'] },
      ],
      googleMapsUri: 'https://maps.google.com/?cid=123',
      websiteUri: 'https://cafe.example.com/',
      nationalPhoneNumber: '(47) 3333-4444',
      primaryType: 'cafe',
      types: ['cafe', 'food', 'establishment'],
      rating: 4.7,
      userRatingCount: 218,
      businessStatus: 'OPERATIONAL',
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const places = await searchGooglePlaces({
  apiKey: 'test-key',
  textQuery: 'cafeteria em Joinville SC',
  pageSize: 7,
  fetchImpl,
});

assert.equal(places.length, 1);
assert.equal(captured.url, 'https://places.googleapis.com/v1/places:searchText');
assert.equal(captured.options.method, 'POST');
assert.equal(captured.options.headers['X-Goog-Api-Key'], 'test-key');
assert.equal(captured.options.headers['X-Goog-FieldMask'], GOOGLE_PLACES_FIELD_MASK);
assert.deepEqual(JSON.parse(captured.options.body), {
  textQuery: 'cafeteria em Joinville SC',
  languageCode: 'pt-BR',
  regionCode: 'BR',
  pageSize: 7,
});

const candidate = googlePlaceToCandidate(places[0], {
  query: 'cafeteria em Joinville SC',
  city: 'Joinville',
  state: 'SC',
  discoveredAt: '2026-08-06T12:00:00.000Z',
});

assert.equal(candidate.source, 'google_places');
assert.equal(candidate.sourceRecordId, 'place-joinville-1');
assert.equal(candidate.sourceName, 'Google Places');
assert.equal(candidate.name, 'Café Exemplo');
assert.equal(candidate.company, 'Café Exemplo');
assert.equal(candidate.phone, '(47) 3333-4444');
assert.equal(candidate.city, 'Joinville');
assert.equal(candidate.state, 'SC');
assert.equal(candidate.reviewStatus, 'pending');
assert.equal(candidate.enrichmentStatus, 'completed');
assert.ok(candidate.evidences.length >= 4);
assert.ok(candidate.evidences.every((item) => item.sourceUrl));
assert.match(candidate.reviewNotes, /não representa interesse explícito/i);
assert.equal(candidate.promotedLeadId, undefined);

console.log('Provedor Google Places do Caça Leads validado.');
