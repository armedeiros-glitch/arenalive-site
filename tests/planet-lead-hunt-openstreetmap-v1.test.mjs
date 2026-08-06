import assert from 'node:assert/strict';
import {
  OSM_ATTRIBUTION,
  OSM_LICENSE_URL,
  buildOverpassQuery,
  osmElementToCandidate,
  searchOpenStreetMap,
} from '../functions/_lib/planet-lead-hunt-openstreetmap.js';

const location = {
  city: 'Joinville',
  state: 'SC',
  lat: -26.3045,
  lon: -48.8487,
  radiusMeters: 24_000,
};
const segments = ['cafeteria', 'sorveteria', 'açaí'];
const query = buildOverpassQuery({ location, segments });
assert.match(query, /around:24000,-26\.304500,-48\.848700/);
assert.match(query, /amenity"="cafe/);
assert.match(query, /amenity"="ice_cream/);
assert.match(query, /açaí\|acai/);
assert.match(query, /out center tags/);

let captured = null;
const fetchImpl = async (url, options) => {
  captured = { url, options };
  return new Response(JSON.stringify({
    elements: [{
      type: 'node',
      id: 123456,
      lat: -26.3,
      lon: -48.84,
      tags: {
        name: 'Café Exemplo',
        amenity: 'cafe',
        'contact:phone': '+55 47 3333-4444',
        'contact:email': 'contato@cafe.example',
        'contact:website': 'https://cafe.example/',
        'addr:street': 'Rua Exemplo',
        'addr:housenumber': '123',
        'addr:city': 'Joinville',
        'addr:state': 'SC',
      },
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const elements = await searchOpenStreetMap({
  location,
  segments,
  maxResults: 40,
  fetchImpl,
});
assert.equal(elements.length, 1);
assert.equal(captured.url, 'https://overpass-api.de/api/interpreter');
assert.equal(captured.options.method, 'POST');
assert.match(captured.options.headers['Content-Type'], /application\/x-www-form-urlencoded/);
const body = new URLSearchParams(captured.options.body);
assert.match(body.get('data'), /Joinville|around:24000/);

const candidate = osmElementToCandidate(elements[0], {
  location,
  discoveredAt: '2026-08-06T12:00:00.000Z',
});
assert.equal(candidate.source, 'openstreetmap');
assert.equal(candidate.sourceRecordId, 'node/123456');
assert.equal(candidate.sourceName, OSM_ATTRIBUTION);
assert.equal(candidate.name, 'Café Exemplo');
assert.equal(candidate.company, 'Café Exemplo');
assert.equal(candidate.phone, '+55 47 3333-4444');
assert.equal(candidate.email, 'contato@cafe.example');
assert.equal(candidate.city, 'Joinville');
assert.equal(candidate.state, 'SC');
assert.equal(candidate.reviewStatus, 'pending');
assert.equal(candidate.enrichmentStatus, 'completed');
assert.match(candidate.sourceUrl, /openstreetmap\.org\/node\/123456/);
assert.ok(candidate.evidences.some((item) => item.sourceUrl === OSM_LICENSE_URL));
assert.ok(candidate.evidences.some((item) => /telefone comercial/i.test(item.description)));
assert.match(candidate.reviewNotes, /não representa interesse explícito/i);
assert.equal(candidate.promotedLeadId, undefined);

console.log('Provedor OpenStreetMap do Caça Leads validado.');
