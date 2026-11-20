// Browser hints choose instructions only. Permissions and installability remain
// feature/event driven; this module never requests access or changes storage.
export function installEnvironment(options = {}) {
  const nav = options.navigator ?? globalThis.navigator ?? {};
  const ua = String(nav.userAgent ?? '');
  const ios = /iPhone|iPad|iPod/i.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const platform = ios ? 'ios' : /Android/i.test(ua) ? 'android' : 'desktop';
  let browser = 'other';
  if (/EdgA?\/|EdgiOS\//i.test(ua)) browser = 'edge';
  else if (/Firefox\/|FxiOS\//i.test(ua)) browser = 'firefox';
  else if (/SamsungBrowser\//i.test(ua)) browser = 'samsung';
  else if (/Chrome\/|CriOS\//i.test(ua)) browser = 'chrome';
  else if (/Safari\//i.test(ua)) browser = 'safari';
  const embeddedHints = [
    [/WhatsApp/i, 'WhatsApp'], [/FBAN|FBAV/i, 'Facebook'], [/Instagram/i, 'Instagram'],
    [/MicroMessenger/i, 'WeChat'], [/Line\//i, 'LINE'], [/Snapchat/i, 'Snapchat'],
    [/TikTok|BytedanceWebview/i, 'TikTok'], [/GSA\//i, 'Google app'],
    [/\bwv\b/i, 'this in-app browser']
  ];
  const embeddedApp = embeddedHints.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
  const media = options.matchMedia ?? globalThis.matchMedia;
  let standalone = false;
  try { standalone = !!media?.call(globalThis, '(display-mode: standalone)')?.matches; } catch {}
  return {
    platform, browser, isStandalone: standalone || nav.standalone === true,
    isEmbedded: !!embeddedApp, embeddedApp,
    secureContext: (options.isSecureContext ?? globalThis.isSecureContext) === true,
    cameraSupported: typeof nav.mediaDevices?.getUserMedia === 'function',
    locationSupported: typeof nav.geolocation?.watchPosition === 'function'
  };
}

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const steps = (title, items) => `<section class="install-guide__steps"><h3>${title}</h3><ol>${items.map(item => `<li>${item}</li>`).join('')}</ol></section>`;
const iosSteps = () => steps('On iPhone or iPad', [
  'Open this link in <strong>Safari</strong>.',
  'Tap <strong>More → Share</strong>, or the <strong>Share</strong> button if it is already visible.',
  'Choose <strong>Add to Home Screen</strong>. Turn on <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.',
  'Launch JiaYou from its new Home Screen icon.'
]);
const androidSteps = () => steps('On Android', [
  'Open this link in <strong>Chrome</strong>.',
  'Open the <strong>⋮ menu</strong> → <strong>Install and create shortcut</strong> → <strong>Install</strong>.',
  'Follow the phone’s confirmation, then open the new JiaYou icon.'
]);

/** Inner content for the install sheet. canPrompt must mean a captured,
 * unused beforeinstallprompt event, not a user-agent guess. */
export function installGuideMarkup(env = installEnvironment(), {canPrompt = false} = {}) {
  const ios = env.platform === 'ios', android = env.platform === 'android';
  const browserName = ios ? 'Safari' : android ? 'Chrome' : 'Safari on iPhone or Chrome on Android';
  let html = '<div class="install-guide">';
  if (!env.secureContext) {
    html += '<aside class="install-guide__notice" role="status"><strong>Open the secure shared link</strong><p>Camera and live location need HTTPS. Open JiaYou’s shared HTTPS link in your phone’s browser, then try again.</p></aside>';
  }
  if (env.isStandalone) {
    html += '<div class="install-guide__ready"><span aria-hidden="true">✓</span><div><h3>JiaYou is already open as an app</h3><p>Use this Home Screen icon for your next adventure.</p></div></div>';
  } else {
    if (env.isEmbedded) html += `<aside class="install-guide__notice"><strong>Continue in ${browserName}</strong><p>You opened this link inside ${escape(env.embeddedApp || 'another app')}. Use its menu to open in ${browserName}, or copy the link and paste it there for the full install steps.</p></aside>`;
    else html += '<p class="install-guide__intro">Add JiaYou to your Home Screen for quick access.</p>';
    if (canPrompt && env.secureContext && !env.isEmbedded) html += '<button class="button primary full install-guide__prompt" data-action="install-now">Install JiaYou</button>';
    html += ios ? iosSteps() : android ? androidSteps() : iosSteps() + androidSteps();
    if (android || (!ios && !android)) html += '<p class="install-guide__hint">Chrome labels vary by version: you may see “Install app” or “Add to Home screen”.</p>';
    if (!env.isEmbedded) html += `<p class="install-guide__hint">Opened from a chat app? If these options are missing, open or paste the same link in ${browserName}.</p>`;
  }
  if (ios) html += `<aside class="install-guide__storage"><strong>${env.isStandalone ? 'Bringing memories from Safari?' : 'Install before collecting'}</strong><p>Safari and the Home Screen app may keep separate memories. If you already collected in Safari, use <strong>Settings → Back up passport</strong> there, then <strong>Restore backup</strong> after opening JiaYou from its Home Screen icon.</p></aside>`;
  if (env.secureContext && (!env.cameraSupported || !env.locationSupported)) {
    const missing = [!env.cameraSupported && 'camera', !env.locationSupported && 'location'].filter(Boolean).join(' and ');
    html += `<p class="install-guide__hint">This browser is not exposing ${missing} access. Try ${browserName} to use location and camera.</p>`;
  }
  html += '<div class="install-guide__footnote"><p>Your passport stays on this device. Back it up before switching browsers or phones, or clearing website data.</p><p>Keep JiaYou open during a live walk. Location pauses in the background and resumes when you return. New maps and nearby places need internet.</p></div></div>';
  return html;
}
