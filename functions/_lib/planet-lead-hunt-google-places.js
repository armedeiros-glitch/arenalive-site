const GOOGLE_PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

export const GOOGLE_PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.primaryType',
  'places.types',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
].join(',');

const clean = (value, limit = 500) => String(value || '').trim().slice(0, limit);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

const componentValue = (place, acceptedTypes, key = 'longText') => {
  const components = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
  const match = components.find((component) => (
    Array.isArray(component?.types)
    && acceptedTypes.some((type) => component.types.includes(type))
  ));
  return clean(match?.[key] || match?.longText || match?.shortText, 140);
};

const placeName = (place) => clean(place?.displayName?.text || place?.displayName, 180);

export const googlePlaceToCandidate = (place = {}, context = {}) => {
  const name = placeName(place);
  const city = componentValue(place, ['locality', 'administrative_area_level_2'])
    || clean(context.city, 140);
  const state = componentValue(place, ['administrative_area_level_1'], 'shortText')
    || clean(context.state, 40);
  const sourceUrl = clean(place.googleMapsUri, 1200);
  const website = clean(place.websiteUri, 1200);
  const phone = clean(place.nationalPhoneNumber, 80);
  const types = Array.isArray(place.types) ? place.types.map((value) => clean(value, 80)).filter(Boolean) : [];
  const rating = Number(place.rating) || 0;
  const ratingCount = Number(place.userRatingCount) || 0;
  const address = clean(place.formattedAddress, 500);
  const discoveredAt = clean(context.discoveredAt, 40) || new Date().toISOString();
  const query = clean(context.query, 240);
  const evidences = [];

  if (address) {
    evidences.push({
      type: 'fact',
      description: `Endereço público informado no Google Places: ${address}`,
      sourceUrl,
      confidence: 95,
      createdAt: discoveredAt,
    });
  }
  if (types.length || place.primaryType) {
    evidences.push({
      type: 'fact',
      description: `Categoria pública: ${clean(place.primaryType || types.slice(0, 4).join(', '), 300)}.`,
      sourceUrl,
      confidence: 88,
      createdAt: discoveredAt,
    });
  }
  if (rating > 0 && ratingCount > 0) {
    evidences.push({
      type: 'fact',
      description: `Avaliação pública ${rating.toFixed(1)} com ${ratingCount} avaliações no Google.`,
      sourceUrl,
      confidence: clamp(70 + Math.log10(ratingCount + 1) * 8, 75, 96),
      createdAt: discoveredAt,
    });
  }
  if (website) {
    evidences.push({
      type: 'fact',
      description: `Site público informado pelo estabelecimento: ${website}`,
      sourceUrl: website,
      confidence: 92,
      createdAt: discoveredAt,
    });
  }
  if (phone) {
    evidences.push({
      type: 'fact',
      description: `Telefone comercial público encontrado no Google Places: ${phone}`,
      sourceUrl,
      confidence: 92,
      createdAt: discoveredAt,
    });
  }

  return {
    source: 'google_places',
    sourceRecordId: clean(place.id, 180),
    sourceUrl,
    sourceName: 'Google Places',
    name,
    company: name,
    phone,
    email: '',
    city,
    state: state.toUpperCase(),
    franchiseModel: '',
    evidences,
    enrichmentStatus: phone || website ? 'completed' : 'pending',
    reviewStatus: 'pending',
    reviewNotes: clean([
      'Descoberto automaticamente pelo Caça Leads.',
      query ? `Consulta: ${query}.` : '',
      website ? `Site público: ${website}.` : '',
      'A descoberta não representa interesse explícito em franquia; confirmar na revisão humana.',
    ].filter(Boolean).join(' '), 1600),
    discoveredAt,
  };
};

export const searchGooglePlaces = async ({
  apiKey,
  textQuery,
  pageSize = 8,
  fetchImpl = fetch,
}) => {
  const key = clean(apiKey, 500);
  const query = clean(textQuery, 240);
  if (!key) {
    const error = new Error('GOOGLE_PLACES_API_KEY não configurada.');
    error.status = 503;
    throw error;
  }
  if (!query) {
    const error = new Error('Consulta do Google Places não informada.');
    error.status = 400;
    throw error;
  }

  const response = await fetchImpl(GOOGLE_PLACES_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': GOOGLE_PLACES_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      pageSize: Math.round(clamp(pageSize, 1, 20)),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = payload?.error?.message || payload?.error || `Falha HTTP ${response.status}`;
    const error = new Error(`Google Places: ${details}`);
    error.status = response.status;
    throw error;
  }

  return (Array.isArray(payload.places) ? payload.places : [])
    .filter((place) => place?.businessStatus !== 'CLOSED_PERMANENTLY')
    .slice(0, Math.round(clamp(pageSize, 1, 20)));
};
