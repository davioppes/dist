const VARIANTS = new Set(['map', 'card', 'hero', 'reward', 'arrival']);
const STATES = new Set(['idle', 'bright', 'walking', 'reward', 'arrival', 'low']);
const EVENT_STATES = new Set(['reward', 'arrival']);
const POSES = Object.freeze({
  standing: './assets/linda-character.svg',
  resting: './assets/companion/linda-resting.svg',
  walking: './assets/companion/linda-walking.svg',
  celebrating: './assets/companion/linda-celebrate.svg'
});

function sourceForState(state) {
  return EVENT_STATES.has(state) ? POSES.celebrating
    : state === 'walking' ? POSES.walking
    : state === 'low' ? POSES.resting : POSES.standing;
}

const lightPose = oil => oil <= 30 ? 'low' : oil > 70 ? 'bright' : 'idle';

const escapeAttribute = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function lightAppearance(oil) {
  const level = Number.isFinite(oil) ? Math.max(0, Math.min(100, oil)) : 45;
  return {
    oil: level,
    tone: level <= 30 ? 'low' : level > 70 ? 'bright' : 'warm',
    glow: (.12 + level * .0042).toFixed(3),
    spread: (.78 + level * .004).toFixed(3)
  };
}

function companionNodes(root) {
  const companions = [];
  if (root?.matches?.('[data-companion]')) companions.push(root);
  if (root?.querySelectorAll) companions.push(...root.querySelectorAll('[data-companion]'));
  return companions;
}

const motionObservers = new WeakMap();

/**
 * Pause offscreen instances and hidden pages, including later modal content.
 * Initialized automatically by sync; safe to call explicitly in a standalone view.
 * One observer/controller is shared by every instance in a document.
 */
export function observeCompanionMotion(root = globalThis.document) {
  const doc = root?.nodeType === 9 ? root : root?.ownerDocument;
  if (!doc?.documentElement || !doc.defaultView) return 0;
  let controller = motionObservers.get(doc);
  if (!controller) {
    const view = doc.defaultView;
    const nodes = new Set();
    const visible = (element, value) => {
      const next = String(value);
      if (element.dataset.companionVisible !== next) element.dataset.companionVisible = next;
    };
    const inViewport = element => {
      const rect = element.getBoundingClientRect?.();
      return !!rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
        && rect.top < view.innerHeight && rect.left < view.innerWidth;
    };
    const intersection = typeof view.IntersectionObserver === 'function'
      ? new view.IntersectionObserver(entries => {
        for (const entry of entries) visible(entry.target, entry.isIntersecting && entry.intersectionRatio > 0);
      }, { threshold: 0 }) : null;
    const add = tree => {
      for (const element of companionNodes(tree)) {
        if (nodes.has(element)) continue;
        nodes.add(element);
        visible(element, intersection ? false : inViewport(element));
        intersection?.observe(element);
      }
    };
    const remove = tree => {
      for (const element of companionNodes(tree)) {
        intersection?.unobserve(element);
        nodes.delete(element);
      }
    };
    const pageVisibility = () => {
      doc.documentElement.dataset.companionPage = doc.hidden ? 'hidden' : 'visible';
      if (!intersection) for (const element of nodes) visible(element, inViewport(element));
    };
    controller = { nodes, add };
    motionObservers.set(doc, controller);
    pageVisibility();
    add(doc);
    doc.addEventListener?.('visibilitychange', pageVisibility);
    if (!intersection) {
      view.addEventListener?.('resize', pageVisibility, { passive: true });
      doc.addEventListener?.('scroll', pageVisibility, { passive: true, capture: true });
    }
    if (typeof view.MutationObserver === 'function') {
      const mutation = new view.MutationObserver(records => {
        for (const record of records) {
          for (const node of record.removedNodes ?? []) remove(node);
          for (const node of record.addedNodes ?? []) add(node);
        }
      });
      mutation.observe(doc.documentElement, { childList: true, subtree: true });
    }
  }
  controller.add(root);
  return controller.nodes.size;
}

/**
 * A non-interactive, accessible rendering of Linda's explorer.
 * Layout belongs to the caller; only the inner layers animate.
 * `reward` and `arrival` use a distinct celebratory pose and play once.
 */
export function companionMarkup({
  variant = 'hero',
  state = 'idle',
  label = 'Your explorer',
  oil = 45,
  decorative = false
} = {}) {
  const kind = VARIANTS.has(variant) ? variant : 'hero';
  const appearance = lightAppearance(oil);
  const requestedState = STATES.has(state) ? state : 'idle';
  const pose = requestedState === 'idle' ? lightPose(appearance.oil) : requestedState;
  const accessible = decorative
    ? 'aria-hidden="true"'
    : `role="img" aria-label="${escapeAttribute(label || 'Your explorer')}"`;

  return `<span class="companion companion--${kind}" data-companion data-companion-variant="${kind}" data-companion-state="${pose}" data-companion-light="${appearance.tone}" data-companion-oil="${Math.round(appearance.oil)}" data-companion-visible="false" data-companion-arrival-cycle="a" style="--companion-glow:${appearance.glow};--companion-spread:${appearance.spread}" ${accessible}><span class="companion__arrival-ring" aria-hidden="true"></span><span class="companion__arrival-ring companion__arrival-ring--echo" aria-hidden="true"></span><span class="companion__trail" aria-hidden="true"><i></i><i></i></span><span class="companion__shadow" aria-hidden="true"></span><span class="companion__motion" aria-hidden="true"><span class="companion__figure"><span class="companion__torch-glow"></span><img class="companion__image" src="${sourceForState(pose)}" width="1254" height="1254" alt="" draggable="false" decoding="async"><span class="companion__spark"></span></span></span></span>`;
}

/**
 * Update persistent instances without replacing their DOM or restarting motion.
 * Walking affects the map avatar; other views remain quietly idle or low-light.
 * `arrived` acknowledges map arrival once; `arrivalKey` distinguishes places.
 * Reward/arrival artwork in other views retains its one-shot state.
 * Returns the instance count.
 */
export function syncCompanionStates(root = globalThis.document, {
  walking = false, oil = 45, arrived = false, arrivalKey = null
} = {}) {
  if (!root) return 0;
  observeCompanionMotion(root);
  const companions = companionNodes(root);
  const appearance = lightAppearance(oil);

  for (const companion of companions) {
    const setData = (name, value) => {
      if (companion.dataset[name] !== value) companion.dataset[name] = value;
    };
    const setStyle = (name, value) => {
      if (companion.style.getPropertyValue(name) !== value) companion.style.setProperty(name, value);
    };
    setData('companionOil', String(Math.round(appearance.oil)));
    setData('companionLight', appearance.tone);
    setStyle('--companion-glow', appearance.glow);
    setStyle('--companion-spread', appearance.spread);

    const isMap = companion.dataset.companionVariant === 'map';
    if (isMap || !EVENT_STATES.has(companion.dataset.companionState)) {
      const pose = isMap && arrived ? 'arrival'
        : isMap && walking ? 'walking'
        : lightPose(appearance.oil);
      if (isMap && arrived) {
        const key = String(arrivalKey ?? 'arrival');
        if (companion.dataset.companionArrivalKey !== key) {
          setData('companionArrivalKey', key);
          setData('companionArrivalCycle', companion.dataset.companionArrivalCycle === 'a' ? 'b' : 'a');
        }
      }
      setData('companionState', pose);
    }

    const image = companion.querySelector?.('.companion__image');
    const source = sourceForState(companion.dataset.companionState);
    if (image && image.getAttribute('src') !== source) image.setAttribute('src', source);
  }
  return companions.length;
}
