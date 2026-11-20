import {parseOverpass, discoveryRadius} from './core.mjs';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OSM_MAP_URL = 'https://api.openstreetmap.org/api/0.6/map.json';

function coordinates(value) {
  return Boolean(value && Number.isFinite(value.lat) && Number.isFinite(value.lng)
    && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180);
}

function abortError(signal) {
  return signal?.reason?.name === 'AbortError' ? signal.reason
    : new DOMException('Nearby lookup cancelled', 'AbortError');
}

function checkAbort(signal) {
  if (signal?.aborted) throw abortError(signal);
}

function lookupBounds(position, fullRange = false) {
  // Only an approximately 100 m rounded location is sent to either provider.
  const lat = Number(position.lat.toFixed(3));
  const lng = Number(position.lng.toFixed(3));
  const rounded = value => Number(value.toFixed(3));
  const margin = discoveryRadius(100) + 150;
  const outward = degrees => Math.ceil(degrees * 1000) / 1000;
  const latitudePadding = fullRange ? outward(margin / 111320) : 0.007;
  // Cover the glow at city latitudes without an enormous polar longitude span.
  // Beyond 85 degrees and across the antimeridian, coverage remains bounded
  // rather than claiming a complete circular search.
  const cosine = Math.max(Math.cos(85 * Math.PI / 180), Math.cos(lat * Math.PI / 180));
  const longitudePadding = fullRange ? outward(margin / (111320 * cosine)) : 0.008;
  return {
    south: rounded(Math.max(-90, lat - latitudePadding)),
    west: rounded(Math.max(-180, lng - longitudePadding)),
    north: rounded(Math.min(90, lat + latitudePadding)),
    east: rounded(Math.min(180, lng + longitudePadding))
  };
}

async function requestJson(url, options, milliseconds, signal) {
  checkAbort(signal);
  const controller = new AbortController();
  let rejectCancellation;
  const cancellation = new Promise((_resolve, reject) => {rejectCancellation = reject;});
  const cancel = error => {
    controller.abort(error);
    rejectCancellation(error);
  };
  const onAbort = () => cancel(abortError(signal));
  signal?.addEventListener('abort', onAbort, {once: true});
  const timer = setTimeout(() => cancel(new DOMException('Nearby service timed out', 'TimeoutError')), milliseconds);
  try {
    const work = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw controller.signal.reason;
      return fetch(url, {...options, signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store'});
    }).then(response => {
      if (!response.ok) throw new Error(`Nearby service returned HTTP ${response.status}`);
      return response.json();
    });
    // This also bounds response-body reads and fetch implementations that do
    // not promptly reject when their request signal is aborted.
    return await Promise.race([work, cancellation]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function representativeNode(element, nodes) {
  if (!Array.isArray(element.nodes) || element.nodes.length < 2) return null;
  let points = element.nodes.map(id => nodes.get(id));
  if (points.some(point => !point)) return null;
  const closed = element.nodes[0] === element.nodes.at(-1);
  if (closed) points = points.slice(0, -1);
  if (!points.length) return null;
  const origin = points[0];
  const scale = Math.cos(origin.lat * Math.PI / 180);
  const projected = points.map(point => ({x: (point.lon - origin.lon) * scale, y: point.lat - origin.lat}));
  let x = 0, y = 0, crossSum = 0;
  if (closed && points.length >= 3) {
    for (let index = 0; index < points.length; index++) {
      const a = projected[index], b = projected[(index + 1) % points.length];
      const cross = a.x * b.y - b.x * a.y;
      crossSum += cross;
      x += (a.x + b.x) * cross;
      y += (a.y + b.y) * cross;
    }
  }
  if (Math.abs(crossSum) > 1e-16) {
    x /= 3 * crossSum;
    y /= 3 * crossSum;
  } else {
    x = projected.reduce((sum, point) => sum + point.x, 0) / projected.length;
    y = projected.reduce((sum, point) => sum + point.y, 0) / projected.length;
  }
  // The computed centroid is only used to choose a real mapped node. It never
  // becomes a synthetic arrival pin or an assertion about a park entrance.
  let nearest = 0, distance = Infinity;
  for (let index = 0; index < points.length; index++) {
    const candidate = (projected[index].x - x) ** 2 + (projected[index].y - y) ** 2;
    if (candidate < distance) {distance = candidate; nearest = index;}
  }
  return points[nearest];
}

function parseOsmMap(data) {
  if (!Array.isArray(data?.elements)) return [];
  const nodes = new Map();
  for (const element of data.elements) {
    if (element?.type === 'node' && Number.isSafeInteger(element.id) && element.id > 0
      && coordinates({lat: element.lat, lng: element.lon})) nodes.set(element.id, element);
  }
  const normalized = [];
  for (const element of data.elements) {
    if (element?.type === 'node') normalized.push(element);
    else if (element?.type === 'way' && element.tags) {
      const point = representativeNode(element, nodes);
      if (point) normalized.push({...element, center: {lat: point.lat, lon: point.lon}});
    }
  }
  // Reuse the same name, category, access restrictions and canonical OSM IDs
  // as the Overpass path. Incomplete relations are intentionally excluded.
  return parseOverpass({elements: normalized});
}

/**
 * Return named, eligible places from at most two requests. No internal cache.
 * Overpass gets 10 seconds; its official OSM API fallback gets 15 seconds.
 * External cancellation always throws AbortError and never starts a fallback.
 * Other final transport failures reject so the caller can show saved places.
 */
export async function loadNearby(position, {signal} = {}) {
  checkAbort(signal);
  if (!coordinates(position)) return [];
  const bounds = lookupBounds(position, true);
  const inside = (place, bounds) => place.lat >= bounds.south && place.lat <= bounds.north
    && place.lng >= bounds.west && place.lng <= bounds.east;
  const area = [bounds.south, bounds.west, bounds.north, bounds.east].map(value => value.toFixed(3)).join(',');
  const query = `[out:json][timeout:8];(nwr(${area})[tourism~"^(viewpoint|museum|gallery|artwork|attraction|picnic_site)$"][name];nwr(${area})[leisure~"^(park|garden|nature_reserve)$"][name];nwr(${area})[amenity=cafe][name];);out center 100;`;
  try {
    const data = await requestJson(OVERPASS_URL, {method: 'POST', body: new URLSearchParams({data: query})}, 10_000, signal);
    checkAbort(signal);
    if (!Array.isArray(data?.elements)) throw new Error('Invalid nearby service response');
    return parseOverpass(data).filter(place => inside(place, bounds));
  } catch (error) {
    checkAbort(signal);
    if (error?.name === 'AbortError') throw error;
  }
  // Keep the proven smaller map-API request: dense areas can exceed OSM's
  // 50,000-node limit even when the bounding-box degree area is permitted.
  // This fallback therefore offers a smaller, explicitly incomplete extent.
  const fallbackBounds = lookupBounds(position);
  const bbox = [fallbackBounds.west, fallbackBounds.south, fallbackBounds.east, fallbackBounds.north].map(value => value.toFixed(3)).join(',');
  const data = await requestJson(`${OSM_MAP_URL}?bbox=${bbox}`, {method: 'GET'}, 15_000, signal);
  checkAbort(signal);
  return parseOsmMap(data).filter(place => inside(place, fallbackBounds));
}
