import { getPlanetBrainManifest } from '../../_shared/knowledge/planet-brain.js';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'public, max-age=300',
  'X-Content-Type-Options': 'nosniff',
};

export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: true,
    ...getPlanetBrainManifest(),
    mode: 'selective_context',
    ai_usage: 'manual_only',
    precedence: ['live_context', 'confirmed_context', 'planet_brain'],
  }), { status: 200, headers });
}
