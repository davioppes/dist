import { stampIdentity, stampMarkup } from './stamps.mjs';

const WIDTH = 1080, HEIGHT = 1350;
const COLORS = { paper: '#f5f8f8', white: '#ffffff', ink: '#203c3a', muted: '#587064', mint: '#e3f0eb', green: '#21695c', gold: '#d7ad59', rule: '#d8e5dd' };
const clean = (value, fallback = '', limit = 120) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit) || fallback : fallback;
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const fail = code => Object.assign(new Error(code), { code });
function abortError() { const error = new Error('Recap cancelled'); error.name = 'AbortError'; return error; }
function check(signal) { if (signal?.aborted) throw abortError(); }
function abortable(promise, signal) {
  check(signal);
  if (!signal) return Promise.resolve(promise);
  return new Promise((resolve, reject) => {
    const cancel = () => { cleanup(); reject(abortError()); };
    const cleanup = () => signal.removeEventListener('abort', cancel);
    signal.addEventListener('abort', cancel, { once: true });
    Promise.resolve(promise).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

function dateRange(stamps) {
  const times = stamps.map(stamp => stamp.collectedAt).filter(time => finite(time) && time <= 8640000000000000);
  if (!times.length) return { label: 'Dates not recorded', key: 'visits' };
  const start = new Date(Math.min(...times)), end = new Date(Math.max(...times));
  const format = (date, options) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(date);
  const full = date => format(date, { day: 'numeric', month: 'short', year: 'numeric' });
  let label;
  if (start.toISOString().slice(0, 10) === end.toISOString().slice(0, 10)) label = full(start);
  else if (start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()) label = `${start.getUTCDate()}–${full(end)}`;
  else if (start.getUTCFullYear() === end.getUTCFullYear()) label = `${format(start, { day: 'numeric', month: 'short' })}–${full(end)}`;
  else label = `${full(start)}–${full(end)}`;
  return { label, key: end.toISOString().slice(0, 10).replaceAll('-', '') };
}
const number = (value, digits = 2) => value.toLocaleString('en-GB', { maximumFractionDigits: digits });
const distanceLabel = value => !finite(value) ? 'Not recorded' : value >= 1000 ? `${number(value / 1000)} km` : value > 0 && value < 1 ? '<1 m' : `${Math.round(value)} m`;
const areaLabel = value => !finite(value) ? 'Not recorded' : value > 0 && value < .01 ? '<0.01 km²' : `${number(value)} km²`;

function rectangles(count) {
  const x = 48, y = 248, w = 984, h = 620, gap = 12;
  const box = (col, row, width, height) => ({ x: col, y: row, width, height });
  if (count === 1) return [box(x, y, w, h)];
  if (count === 2) return [box(x, y, 486, h), box(x + 498, y, 486, h)];
  if (count === 3) return [box(x, y, 644, h), box(x + 656, y, 328, 304), box(x + 656, y + 316, 328, 304)];
  if (count === 4) return [0, 1, 2, 3].map(i => box(x + (i % 2) * 498, y + Math.floor(i / 2) * 316, 486, 304));
  if (count === 5) return [box(x, y, 486, 304), box(x + 498, y, 486, 304), ...[0, 1, 2].map(i => box(x + i * 332, y + 316, 320, 304))];
  return [0, 1, 2, 3, 4, 5].map(i => box(x + (i % 3) * (320 + gap), y + Math.floor(i / 3) * 316, 320, 304));
}

/** Pure, immutable layout/data boundary; city metrics are supplied, never inferred. */
export function buildRecapPlan(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const stamps = [], ids = new Set();
  for (const value of Array.isArray(source.stamps) ? source.stamps : []) {
    if (!value || typeof value !== 'object' || value.mode === 'demo') continue;
    const id = clean(value.id, '', 200);
    if (!id || ids.has(id)) continue;
    ids.add(id);stamps.push({ ...value, id, name: clean(value.name, 'Visited place') });
  }
  if (!stamps.length) throw fail('EMPTY_RECAP');
  const byId = new Map(stamps.map(stamp => [stamp.id, stamp]));
  const highlights = [], highlightIds = new Set();
  for (const value of Array.isArray(source.topPlaces) ? source.topPlaces : []) {
    const id = typeof value === 'string' ? value : value?.id;
    if (byId.has(id) && !highlightIds.has(id) && highlights.length < 3) { highlights.push(byId.get(id));highlightIds.add(id); }
  }
  const recent = [...stamps].sort((a, b) => (finite(b.collectedAt) ? b.collectedAt : -1) - (finite(a.collectedAt) ? a.collectedAt : -1));
  const selected = [...highlights, ...recent.filter(stamp => !highlightIds.has(stamp.id))].slice(0, 6);
  const date = dateRange(stamps), cityName = clean(source.city?.name, 'city', 80);
  return {
    width: WIDTH, height: HEIGHT, title: `My ${cityName}`, cityName,
    country: clean(source.city?.country, '', 80), dateLabel: date.label, dateKey: date.key,
    visitCount: stamps.length, distanceLabel: distanceLabel(source.distance), areaLabel: areaLabel(source.areaKm2),
    extraCount: stamps.length - selected.length, highlights,
    tiles: rectangles(selected.length).map((rect, index) => ({ ...rect, stamp: selected[index] }))
  };
}

/** Keep only inert original SVG geometry/text. No foreign content or resource URLs. */
export function sanitizeRecapSvg(source, stamp) {
  if (typeof source !== 'string' || source.length > 250000 || /<!DOCTYPE|<!ENTITY/i.test(source)) return null;
  let svg = source.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0];
  if (!svg) return null;
  svg = svg.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|foreignObject|style|image|use|a|iframe|object|embed|animate|animateTransform|set)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(?:script|foreignObject|style|image|use|a|iframe|object|embed|animate|animateTransform|set)\b[^>]*\/?>/gi, '');
  const allowedTags = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'text', 'tspan', 'title', 'desc']);
  for (const match of svg.matchAll(/<\/?\s*([\w:-]+)/g)) if (!allowedTags.has(match[1].toLowerCase())) return null;
  const palette = stampIdentity(stamp).palette;
  for (const [key, value] of Object.entries(palette)) svg = svg.replaceAll(`var(--stamp-${key})`, value);
  const attributes = new Set(['viewbox','width','height','x','y','cx','cy','r','rx','ry','x1','y1','x2','y2','d','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity','transform','font-family','font-size','font-weight','letter-spacing','text-anchor']);
  svg = svg.replace(/<([a-zA-Z][\w:-]*)([^<>]*?)(\/?)>/g, (_, tag, raw, closing) => {
    const safe = [];
    for (const match of raw.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const name = match[1], value = match[2] ?? match[3];
      const paint = ['fill', 'stroke'].includes(name.toLowerCase());
      if (paint && !/^(?:#[0-9a-f]{3,8}|none|currentColor|transparent)$/i.test(value)) continue;
      if (attributes.has(name.toLowerCase()) && !/url\s*\(|javascript\s*:|https?\s*:|data\s*:|var\s*\(/i.test(value)) safe.push(`${name}="${value.replaceAll('"', '&quot;')}"`);
    }
    if (tag.toLowerCase() === 'svg') safe.push('xmlns="http://www.w3.org/2000/svg"');
    return `<${tag}${safe.length ? ' ' + safe.join(' ') : ''}${closing}>`;
  });
  return svg;
}

function roundPath(ctx, x, y, w, h, radius = 16) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();ctx.moveTo(x + r, y);ctx.lineTo(x + w - r, y);ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);ctx.quadraticCurveTo(x, y, x + r, y);ctx.closePath();
}
function font(ctx, size, weight = 600) { ctx.font = `${weight} ${size}px Nunito, sans-serif`; }
function clippedText(ctx, value, maxWidth) {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let result = [...value];
  while (result.length && ctx.measureText(`${result.join('')}…`).width > maxWidth) result.pop();
  return result.join('') + '…';
}
function label(ctx, value, x, y, width, size = 22, weight = 700, color = COLORS.ink) {
  font(ctx, size, weight);ctx.fillStyle = color;ctx.fillText(clippedText(ctx, value, width), x, y);
}
function wrapped(ctx, value, x, y, width, size = 22, lines = 2, color = COLORS.ink) {
  font(ctx, size, 700);ctx.fillStyle = color;
  const words = value.split(' '), output = [];let current = '';
  for (let index = 0; index < words.length; index++) {
    const next = `${current}${current ? ' ' : ''}${words[index]}`;
    if (current && ctx.measureText(next).width > width && output.length < lines - 1) { output.push(current);current = words[index]; }
    else current = next;
  }
  output.push(current);
  output.slice(0, lines).forEach((line, index) => ctx.fillText(clippedText(ctx, line, width), x, y + index * size * 1.3));
}
function cover(ctx, image, x, y, width, height) {
  const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
  if (!iw || !ih) throw fail('RECAP_IMAGE_INVALID');
  const scale = Math.max(width / iw, height / ih), sw = width / scale, sh = height / scale;
  ctx.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, width, height);
}
function contain(ctx, image, x, y, width, height) {
  const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
  if (!iw || !ih) return;
  const scale = Math.min(width / iw, height / ih), w = iw * scale, h = ih * scale;
  ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

function decodeLocalImage(source, { signal } = {}) {
  check(signal);
  return new Promise((resolve, reject) => {
    const image = new Image();
    const clear = () => { image.onload = null;image.onerror = null;signal?.removeEventListener('abort', cancel); };
    const cancel = () => { clear();image.removeAttribute('src');reject(abortError()); };
    image.onload = () => { clear();image.naturalWidth && image.naturalHeight ? resolve(image) : reject(fail('RECAP_IMAGE_INVALID')); };
    image.onerror = () => { clear();reject(fail('RECAP_IMAGE_INVALID')); };
    signal?.addEventListener('abort', cancel, { once: true });
    image.src = source;
  });
}
const localRaster = data => typeof data === 'string' && data.length <= 12000000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(data);
const manualVisit = stamp => stamp.method === 'checkin' || stamp.mode === 'manual' || stamp.manual === true || stamp.visitType === 'manual';

async function pngBlob(canvas, signal) {
  check(signal);
  if (typeof canvas.convertToBlob === 'function') return abortable(canvas.convertToBlob({ type: 'image/png' }), signal);
  if (typeof canvas.toBlob !== 'function') throw fail('RECAP_ENCODING_FAILED');
  return abortable(new Promise((resolve, reject) => {
    try { canvas.toBlob(blob => blob ? resolve(blob) : reject(fail('RECAP_ENCODING_FAILED')), 'image/png'); }
    catch { reject(fail('RECAP_ENCODING_FAILED')); }
  }), signal);
}

/**
 * Render locally to a lossless 1080×1350 PNG. No fetch, uploads or external URLs.
 * getPhoto reads IndexedDB records; stampSvg supplies original inline SVG (the
 * existing stamp renderer is the default). Optional createCanvas/decodeImage/
 * fontsReady boundaries allow portable tests without replacing browser code.
 */
export async function makeTripRecap(data, options = {}) {
  const { getPhoto = async () => null, stampSvg = stamp => stampMarkup(stamp, { size: 'hero', collected: true }), signal,
    createCanvas = () => globalThis.document?.createElement('canvas'), decodeImage = decodeLocalImage,
    fontsReady = globalThis.document?.fonts?.ready || Promise.resolve() } = options || {};
  check(signal);
  const plan = buildRecapPlan(data);
  await abortable(fontsReady, signal);check(signal);
  const canvas = createCanvas();
  if (!canvas?.getContext) throw fail('RECAP_CANVAS_UNAVAILABLE');
  canvas.width = WIDTH;canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw fail('RECAP_CANVAS_UNAVAILABLE');
  const loaded = [], rendered = new Map();
  const decode = async source => {
    check(signal);
    const pending = Promise.resolve(decodeImage(source, { signal })).then(image => {
      if (signal?.aborted) { image.close?.();throw abortError(); }
      loaded.push(image);return image;
    });
    return abortable(pending, signal);
  };
  try {
    await Promise.all(plan.tiles.map(async tile => {
      const stamp = tile.stamp;let photo = null, art = null;
      if (!manualVisit(stamp) && typeof stamp.photoKey === 'string' && stamp.photoKey) {
        try {
          const stored = await abortable(getPhoto(stamp.photoKey), signal);check(signal);
          if (stored?.sample !== true && localRaster(stored?.data)) photo = await decode(stored.data);
        } catch (error) { if (error.name === 'AbortError') throw error; }
      }
      try {
        const svg = sanitizeRecapSvg(await abortable(stampSvg(stamp), signal), stamp);check(signal);
        if (svg) art = await decode(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      } catch (error) { if (error.name === 'AbortError') throw error; }
      rendered.set(stamp.id, { photo, art });
    }));
    check(signal);
    ctx.fillStyle = COLORS.paper;ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textBaseline = 'alphabetic';ctx.textAlign = 'left';
    label(ctx, 'JiaYou', 48, 65, 800, 28, 850, COLORS.green);
    ctx.fillStyle = COLORS.gold;roundPath(ctx, 1008, 40, 24, 24, 7);ctx.fill();
    let titleSize = 82;font(ctx, titleSize, 850);
    while (titleSize > 46 && ctx.measureText(plan.title).width > 984) { titleSize -= 2;font(ctx, titleSize, 850); }
    label(ctx, plan.title, 48, 155, 984, titleSize, 850);
    label(ctx, [plan.country, plan.dateLabel].filter(Boolean).join(' · '), 50, 209, 980, 25, 600, COLORS.muted);

    for (const tile of plan.tiles) {
      const { x, y, width, height, stamp } = tile, images = rendered.get(stamp.id), caption = width < 400 ? 70 : 64;
      ctx.save();roundPath(ctx, x, y, width, height, 18);ctx.clip();
      ctx.fillStyle = COLORS.white;ctx.fillRect(x, y, width, height);
      if (images.photo) cover(ctx, images.photo, x, y, width, height - caption);
      else {
        ctx.fillStyle = COLORS.mint;ctx.fillRect(x, y, width, height - caption);
        if (images.art) contain(ctx, images.art, x + 24, y + 18, width - 48, height - caption - 58);
        else { ctx.fillStyle = COLORS.green;ctx.fillRect(x + width / 2 - 28, y + (height - caption) / 2 - 2, 56, 4); }
        font(ctx, 18, 650);ctx.fillStyle = COLORS.green;ctx.textAlign = 'center';ctx.fillText('Visit stamp', x + width / 2, y + height - caption - 16);ctx.textAlign = 'left';
      }
      wrapped(ctx, stamp.name, x + 16, y + height - caption + 27, width - 32, width < 400 ? 19 : 23, 2);
      ctx.restore();
    }
    if (plan.extraCount) label(ctx, `+${plan.extraCount} more ${plan.extraCount === 1 ? 'visit' : 'visits'} in my passport`, 50, 899, 984, 20, 650, COLORS.muted);
    ctx.fillStyle = COLORS.rule;ctx.fillRect(48, 925, 984, 1);
    const stats = [[String(plan.visitCount), 'Visited places'], [plan.distanceLabel, 'Recorded walk'], [plan.areaLabel, 'Explored footprint*']];
    stats.forEach(([value, name], index) => {
      const x = 50 + index * 332;
      label(ctx, value, x, 982, 304, value === 'Not recorded' ? 28 : 40, 850);
      label(ctx, name, x, 1017, 304, 20, 600, COLORS.muted);
    });
    ctx.fillStyle = COLORS.rule;ctx.fillRect(48, 1055, 984, 1);
    label(ctx, 'Highlights', 50, 1104, 980, 25, 800);
    if (!plan.highlights.length) label(ctx, 'No highlights selected.', 50, 1153, 980, 23, 600, COLORS.muted);
    plan.highlights.forEach((stamp, index) => {
      const x = 50 + index * 332, art = rendered.get(stamp.id)?.art;
      if (art) contain(ctx, art, x - 2, 1125, 64, 70);
      wrapped(ctx, stamp.name, x + (art ? 76 : 0), 1148, art ? 226 : 302, 22, 2);
    });
    label(ctx, '*Explored footprint is an estimate from recorded exploration.', 50, 1252, 984, 19, 500, COLORS.muted);
    label(ctx, 'Dates use UTC calendar days.', 50, 1281, 984, 18, 500, COLORS.muted);
    label(ctx, 'My city passport', 50, 1320, 984, 20, 700, COLORS.green);
    check(signal);
    const blob = await pngBlob(canvas, signal);check(signal);
    if (!(blob instanceof Blob) || blob.type !== 'image/png') throw fail('RECAP_ENCODING_FAILED');
    const city = plan.cityName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'City';
    return { blob, width: WIDTH, height: HEIGHT, filename: `JiaYou-My-${city}-${plan.dateKey}.png` };
  } finally {
    for (const image of loaded) image.close?.();
  }
}
