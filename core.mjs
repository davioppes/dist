/** Pure, local-only exploration rules. No timers, network calls or GPS tracking. */
const EARTH_RADIUS = 6_371_000;
const OIL_INTERVAL = 30 * 60_000;
const CATEGORIES = new Set(['nature', 'culture', 'views', 'food']);

function coordinates(value) {
  return Boolean(value && Number.isFinite(value.lat) && Number.isFinite(value.lng)
    && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180);
}

function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

// These are plain strings, not HTML-safe strings. Render with textContent or
// escape at the UI boundary. Keeping angle brackets is deliberate.
function text(value, limit = 120) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit)
    : '';
}

function cityMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const key = text(value.key, 200), name = text(value.name);
  if (!key || !name) return;
  const city = {key, name};
  const country = text(value.country), countryCode = text(value.countryCode).toUpperCase();
  if (country) city.country = country;
  if (/^[A-Z]{2}$/.test(countryCode)) city.countryCode = countryCode;
  if (coordinates(value)) {city.lat = value.lat; city.lng = value.lng;}
  return city;
}

export function distanceMeters(a, b) {
  if (!coordinates(a) || !coordinates(b)) throw failure('INVALID_LOCATION');
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(clamp(haversine, 0, 1)));
}

export function formatDistance(metres) {
  if (!Number.isFinite(metres) || metres < 0) return '—';
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

export function createState(now = Date.now()) {
  return {version: 1, oil: 45, oilUpdatedAt: now, stamps: [], visited: [], distance: 0, settings: {}, onboarded: false};
}

export function lightLevel(state, now = Date.now()) {
  const oil = Number.isFinite(state?.oil) ? clamp(state.oil, 10, 100) : 10;
  const elapsed = Number.isFinite(now) && Number.isFinite(state?.oilUpdatedAt)
    ? Math.max(0, now - state.oilUpdatedAt) : 0;
  return Math.max(10, oil - elapsed / OIL_INTERVAL);
}

export function discoveryRadius(oil) {
  return 250 + clamp(Number.isFinite(oil) ? oil : 0, 0, 100) * 14;
}

export function arrivalStatus(position, place, now = Date.now()) {
  if (!position) return {eligible: false, reason: 'LOCATION_REQUIRED', distance: null};
  if (!coordinates(position) || !coordinates(place)) {
    return {eligible: false, reason: 'INVALID_LOCATION', distance: null};
  }
  const distance = distanceMeters(position, place);
  if (!Number.isFinite(position.accuracy) || position.accuracy < 0 || position.accuracy > 50) {
    return {eligible: false, reason: 'LOCATION_INACCURATE', distance};
  }
  if (!Number.isFinite(now) || !Number.isFinite(position.timestamp) || position.timestamp < 0
      || position.timestamp > now + 5000 || now - position.timestamp > 60_000) {
    return {eligible: false, reason: 'LOCATION_STALE', distance};
  }
  return distance > 50
    ? {eligible: false, reason: 'TOO_FAR', distance}
    : {eligible: true, reason: 'ARRIVED', distance};
}

export function awardStamp(state, place, options = {}) {
  const {now = Date.now(), photoKey, note = '', mode = 'real', method = 'photo', position} = options;
  if (!state || state.version !== 1 || !Array.isArray(state.stamps) || !Array.isArray(state.visited)
      || !Number.isFinite(state.oil) || !Number.isFinite(now) || now < 0) {
    throw failure('INVALID_STATE');
  }
  const id = text(place?.id, 200);
  const name = text(place?.name);
  if (!id || !name || !coordinates(place)) throw failure('INVALID_PLACE');
  if (mode !== 'real') throw failure('INVALID_MODE');
  if (method !== 'photo' && method !== 'checkin') throw failure('INVALID_METHOD');
  if (state.stamps.some(stamp => stamp.id === id)) throw failure('DUPLICATE_STAMP');
  const photo = typeof photoKey === 'string' ? photoKey.trim() : '';
  if (method === 'photo' && !photo) throw failure('PHOTO_REQUIRED');
  const arrival = arrivalStatus(position, place, now);
  if (!arrival.eligible) throw failure(arrival.reason);
  const city = cityMetadata(place.city);
  const stamp = {
    id, name, category: CATEGORIES.has(place.category) ? place.category : 'culture',
    lat: place.lat, lng: place.lng, collectedAt: now,
    ...(photo ? {photoKey: photo} : {}), note: text(note, 1000), mode, method,
    ...(city ? {city} : {})
  };
  return {
    ...state, oil: Math.min(100, lightLevel(state, now) + 30), oilUpdatedAt: now,
    stamps: [...state.stamps, stamp], visited: [...new Set([...state.visited, id])]
  };
}

export function revealPlaces(places, position, state, filter = 'all', now = Date.now()) {
  const visited = new Set(Array.isArray(state?.visited) ? state.visited : []);
  const candidates = (Array.isArray(places) ? places : [])
    .filter(place => coordinates(place) && (filter === 'all' || place.category === filter))
    .map(place => ({...place, distance: coordinates(position) ? distanceMeters(position, place) : null}));
  if (!coordinates(position)) return candidates.filter(place => visited.has(place.id));
  candidates.sort((a, b) => a.distance - b.distance);
  const oil = lightLevel(state, now);
  const radius = discoveryRadius(oil);
  const nearby = candidates.filter(place => place.distance <= radius || visited.has(place.id));
  // At the prototype's low-light level, keep an alternative to a blocked spot.
  // Recovery options can extend beyond the glow, but always come from actual
  // available candidates. A collected place is not an uncollected alternative.
  const minimumOptions = oil <= 30 ? 2 : 1;
  let options = nearby.filter(place => !visited.has(place.id)).length;
  const shown = new Set(nearby.map(place => place.id));
  for (const place of candidates) {
    if (options >= minimumOptions) break;
    if (visited.has(place.id) || shown.has(place.id)) continue;
    nearby.push(place);
    shown.add(place.id);
    options++;
  }
  return nearby.sort((a, b) => a.distance - b.distance);
}

const PROMPTS = {
  nature: {description: 'A little room for nature in the city.', task: 'Photograph one natural detail that catches your eye.'},
  culture: {description: 'A place with a local story or creative detail.', task: 'Photograph a shape, artwork or detail you would like to remember.'},
  views: {description: 'A fresh perspective on your surroundings.', task: 'Photograph the view from a publicly accessible spot.'},
  food: {description: 'A neighbourhood pause around food or coffee.', task: 'Photograph a sign, texture or detail. Buying something is optional.'}
};

function categoryFor(tags) {
  if (tags.tourism === 'viewpoint') return 'views';
  if (tags.amenity === 'cafe') return 'food';
  if (['park', 'garden', 'nature_reserve'].includes(tags.leisure) || tags.tourism === 'picnic_site') return 'nature';
  if (['museum', 'gallery', 'artwork', 'attraction'].includes(tags.tourism)) return 'culture';
  return null;
}

export function parseOverpass(data) {
  if (!Array.isArray(data?.elements)) return [];
  const result = [];
  const seen = new Set();
  for (const element of data.elements) {
    if (!element || !['node', 'way', 'relation'].includes(element.type)
        || !Number.isSafeInteger(element.id) || element.id <= 0) continue;
    const tags = element.tags;
    if (!tags || typeof tags !== 'object') continue;
    if (['access', 'foot'].some(key => ['private', 'no', 'permit'].includes(text(tags[key]).toLowerCase()))) continue;
    const name = text(tags['name:en']) || text(tags.name) || text(tags['name:zh']);
    const category = categoryFor(tags);
    if (!name || !category) continue;
    const point = element.type === 'node' ? element : element.center;
    const position = {lat: point?.lat, lng: point?.lon};
    if (!coordinates(position)) continue;
    const id = `${element.type}/${element.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const metadata = {};
    const available = {
      localName: text(tags['name:zh']) || text(tags['name:zh-Hant']),
      openingHours: text(tags.opening_hours, 240),
      wheelchair: text(tags.wheelchair, 80),
      access: text(tags.access, 80),
      foot: text(tags.foot, 80)
    };
    for (const [key, value] of Object.entries(available)) if (value) metadata[key] = value;
    result.push({id, name, category, ...position, ...PROMPTS[category], ...metadata,
      sourceUrl: `https://www.openstreetmap.org/${id}`});
  }
  return result;
}
