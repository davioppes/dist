import {distanceMeters} from './core.mjs';

const coordinates = p => p && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90
  && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180;
const text = value => typeof value === 'string' ? value.trim().slice(0, 240) : '';
const savedIds = state => new Set((Array.isArray(state?.stamps) ? state.stamps : [])
  .filter(s => s && (s.mode == null || s.mode === 'real') && text(s.id)).map(s => s.id));

/** A display-only goal derived from saved places. It awards nothing and persists nothing. */
export function collectionMilestone(state) {
  const count = savedIds(state).size, goal = 3;
  const complete = count > 0 && count % goal === 0;
  const progress = complete ? goal : count % goal;
  return {count, progress, goal, remaining: goal - progress, completedSets: Math.floor(count / goal), complete};
}

/** Select only from the supplied actual discovery results; distance remains straight-line. */
export function nextUnvisitedDestination(places, position, state) {
  if (!coordinates(position)) return null;
  const visited = savedIds(state);
  for (const id of Array.isArray(state?.visited) ? state.visited : []) visited.add(id);
  return (Array.isArray(places) ? places : [])
    .filter(p => coordinates(p) && text(p.id) && text(p.name) && !visited.has(p.id)
      && !['access', 'foot'].some(key => ['private', 'no', 'permit'].includes(text(p[key]).toLowerCase())))
    .map(p => ({...p, distance: distanceMeters(position, p)}))
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

/** Existing photos identify surroundings, never an entrance, floor, or current access. */
export function arrivalAssistance(place, media) {
  const hasReference = Boolean(text(media?.landmarkCue) && text(media?.sourceUrl));
  const cue = (hasReference && text(media.landmarkCue)) || text(place?.landmarkCue)
    || `Look for “${text(place?.name) || 'the place name'}” on local signs. Check the surroundings before entering.`;
  const details = [['Access', place?.access], ['Opening hours', place?.openingHours],
    ['On foot', place?.foot], ['Wheelchair access', place?.wheelchair]]
    .filter(([, value]) => text(value)).map(([label, value]) => ({label, value: text(value)}));
  return {cue, hasReference, details, entranceKnown: false, floorKnown: false};
}
