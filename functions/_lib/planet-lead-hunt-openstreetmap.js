export const DEFAULT_OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
export const OSM_LICENSE_URL = 'https://www.openstreetmap.org/copyright';

const clean = (value, limit = 500) => String(value || '').trim().slice(0, limit);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const escapeRegex = (value) => clean(value, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeSearch = (value) => clean(value, 500)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const segmentClauses = (segment, around) => {
  const normalized = normalizeSearch(segment);

  if (normalized === 'cafeteria') {
    return [
      `nwr(${around})["amenity"="cafe"]["name"];`,
      `nwr(${around})["shop"="coffee"]["name"];`,
    ];
  }
  if (normalized === 'sorveteria') {
    return [
      `nwr(${around})["amenity"="ice_cream"]["name"];`,
      `nwr(${around})["shop"="ice_cream"]["name"];`,
    ];
  }
  if (normalized === 'acai') {
    return [
      `nwr(${around})["amenity"~"^(cafe|fast_food|restaurant|ice_cream)$"]["name"~"açaí|acai",i];`,
      `nwr(${around})["shop"~"^(confectionery|ice_cream|food)$"]["name"~"açaí|acai",i];`,
      `nwr(${around})["cuisine"~"(^|;)(açaí|acai)(;|$)",i]["name"];`,
    ];
  }
  if (normalized === 'chocolateria') {
    return [
      `nwr(${around})["shop"="chocolate"]["name"];`,
      `nwr(${around})["shop"~"^(confectionery|food)$"]["name"~"chocolate|chocolateria",i];`,
      `nwr(${around})["amenity"="cafe"]["name"~"chocolate|chocolateria",i];`,
    ];
  }
  if (normalized === 'confeitaria') {
    return [
      `nwr(${around})["shop"~"^(confectionery|bakery)$"]["name"];`,
      `nwr(${around})["amenity"~"^(cafe|restaurant)$"]["name"~"confeitaria|doceria",i];`,
    ];
  }
  if (normalized === 'alimentacao em shopping') {
    return [
      `nwr(${around})["amenity"="food_court"]["name"];`,
    ];
  }

  const fallback = escapeRegex(segment);
  return fallback ? [`nwr(${around})["name"~"${fallback}",i];`] : [];
};

export const buildOverpassQuery = ({ location, segments }) => {
  const lat = Number(location?.lat);
  const lon = Number(location?.lon);
  const radiusMeters = Math.round(clamp(location?.radiusMeters || 24_000, 2_000, 50_000));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const error = new Error('A praça precisa informar latitude e longitude.');
    error.status = 400;
    throw error;
  }
  const around = `around:${radiusMeters},${lat.toFixed(6)},${lon.toFixed(6)}`;
  const clauses = [...new Set((Array.isArray(segments) ? segments : [])
    .flatMap((segment) => segmentClauses(segment, around)))]
    .slice(0, 24);
  if (!clauses.length) {
    const error = new Error('Nenhum segmento válido foi configurado para a consulta.');
    error.status = 400;
    throw error;
  }
  return `[out:json][timeout:25][maxsize:67108864];\n(\n  ${clauses.join('\n  ')}\n);\nout center tags;`;
};

const addressFromTags = (tags = {}) => clean([
  tags['addr:street'],
  tags['addr:housenumber'],
  tags['addr:suburb'],
].filter(Boolean).join(', '), 500);

const sourceUrlFor = (element) => {
  const type = ['node', 'way', 'relation'].includes(element?.type) ? element.type : 'node';
  const id = clean(element?.id, 80);
  return id ? `https://www.openstreetmap.org/${type}/${id}` : OSM_LICENSE_URL;
};

const tagValue = (tags, ...keys) => {
  for (const key of keys) {
    const value = clean(tags?.[key], 1200);
    if (value) return value;
  }
  return '';
};

const categoryText = (tags = {}) => [
  tags.amenity ? `amenity=${tags.amenity}` : '',
  tags.shop ? `shop=${tags.shop}` : '',
  tags.cuisine ? `cuisine=${tags.cuisine}` : '',
].filter(Boolean).join(', ');

const segmentFromTags = (tags = {}, name = '') => {
  const searchable = normalizeSearch([
    name,
    tags.amenity,
    tags.shop,
    tags.cuisine,
  ].filter(Boolean).join(' '));
  if (/acai/.test(searchable)) return 'açaí';
  if (/chocolate|chocolateria/.test(searchable)) return 'chocolateria';
  if (/ice_cream/.test(searchable)) return 'sorveteria';
  if (/confectionery|bakery|confeitaria|doceria/.test(searchable)) return 'confeitaria';
  if (/food_court/.test(searchable)) return 'alimentação em shopping';
  if (/cafe|coffee/.test(searchable)) return 'cafeteria';
  return '';
};

const isInactive = (tags = {}) => {
  const truthy = new Set(['yes', 'true', '1']);
  return truthy.has(normalizeSearch(tags.disused))
    || truthy.has(normalizeSearch(tags.abandoned))
    || truthy.has(normalizeSearch(tags.closed))
    || normalizeSearch(tags.shop) === 'no';
};

const isOwnBrand = (name) => /\bplanet\s*chocolate\b/i.test(clean(name, 300));

export const osmElementToCandidate = (element = {}, context = {}) => {
  const tags = element.tags || {};
  const name = tagValue(tags, 'name', 'brand', 'operator');
  const company = tagValue(tags, 'operator', 'brand', 'name') || name;
  const phone = tagValue(tags, 'contact:phone', 'phone', 'contact:mobile', 'mobile');
  const email = tagValue(tags, 'contact:email', 'email').toLowerCase();
  const website = tagValue(tags, 'contact:website', 'website');
  const city = tagValue(tags, 'addr:city') || clean(context.location?.city, 140);
  const state = tagValue(tags, 'addr:state') || clean(context.location?.state, 40);
  const sourceUrl = sourceUrlFor(element);
  const address = addressFromTags(tags);
  const categories = categoryText(tags);
  const segment = segmentFromTags(tags, name);
  const discoveredAt = clean(context.discoveredAt, 40) || new Date().toISOString();
  const evidences = [{
    type: 'fact',
    description: 'Dados públicos obtidos do OpenStreetMap sob a licença ODbL 1.0.',
    sourceUrl: OSM_LICENSE_URL,
    confidence: 100,
    createdAt: discoveredAt,
  }];

  if (address) {
    evidences.push({
      type: 'fact',
      description: `Endereço empresarial informado no OpenStreetMap: ${address}`,
      sourceUrl,
      confidence: 88,
      createdAt: discoveredAt,
    });
  }
  if (categories) {
    evidences.push({
      type: 'fact',
      description: `Categoria pública no OpenStreetMap: ${categories}.`,
      sourceUrl,
      confidence: 88,
      createdAt: discoveredAt,
    });
  }
  if (segment) {
    evidences.push({
      type: 'inference',
      description: `Segmento compatível com o ICP inicial da Planet: ${segment}.`,
      sourceUrl,
      confidence: 84,
      createdAt: discoveredAt,
    });
  }
  if (phone) {
    evidences.push({
      type: 'fact',
      description: `Telefone comercial público informado no OpenStreetMap: ${phone}`,
      sourceUrl,
      confidence: 90,
      createdAt: discoveredAt,
    });
  }
  if (email) {
    evidences.push({
      type: 'fact',
      description: `E-mail comercial público informado no OpenStreetMap: ${email}`,
      sourceUrl,
      confidence: 90,
      createdAt: discoveredAt,
    });
  }
  if (website) {
    evidences.push({
      type: 'fact',
      description: `Site empresarial público informado no OpenStreetMap: ${website}`,
      sourceUrl: website,
      confidence: 90,
      createdAt: discoveredAt,
    });
  }

  return {
    source: 'openstreetmap',
    sourceRecordId: `${clean(element.type, 20)}/${clean(element.id, 80)}`,
    sourceUrl,
    sourceName: OSM_ATTRIBUTION,
    name,
    company,
    phone,
    email,
    city,
    state: state.toUpperCase(),
    franchiseModel: '',
    evidences,
    enrichmentStatus: phone || email || website ? 'completed' : 'pending',
    reviewStatus: 'pending',
    reviewNotes: clean([
      'Descoberto automaticamente pelo Caça Leads usando dados abertos do OpenStreetMap.',
      `Praça consultada: ${city}${state ? `/${state.toUpperCase()}` : ''}.`,
      segment ? `Segmento sugerido: ${segment}.` : '',
      'A descoberta não representa interesse explícito em franquia; confirmar na revisão humana.',
    ].filter(Boolean).join(' '), 1600),
  };
};

export const searchOpenStreetMap = async ({
  location,
  segments,
  maxResults = 40,
  endpoint = DEFAULT_OVERPASS_API_URL,
  fetchImpl = fetch,
}) => {
  const query = buildOverpassQuery({ location, segments });
  const response = await fetchImpl(clean(endpoint, 1200) || DEFAULT_OVERPASS_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'AndreOS-CacaLeads/1.0',
    },
    body: new URLSearchParams({ data: query }).toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = clean(payload?.remark || payload?.error || `Falha HTTP ${response.status}`, 800);
    const error = new Error(`Overpass API: ${details}`);
    error.status = response.status;
    throw error;
  }
  return (Array.isArray(payload.elements) ? payload.elements : [])
    .filter((element) => {
      const tags = element?.tags || {};
      const name = tagValue(tags, 'name', 'brand', 'operator');
      return name && !isInactive(tags) && !isOwnBrand(name);
    })
    .slice(0, Math.round(clamp(maxResults, 1, 100)));
};
