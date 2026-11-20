// A separate preference; never changes the passport's storage schema.
const key = 'jiayou-map-theme';
let theme = 'light';
try { theme = localStorage.getItem(key) === 'dark' ? 'dark' : 'light'; } catch {}
function applyTheme() {
  document.documentElement.dataset.mapTheme = theme;
  const button = document.querySelector('[data-theme-toggle]');
  button?.setAttribute('aria-pressed', String(theme === 'dark'));
  button?.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} map`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#29252d' : '#ffffff');
}
applyTheme();
document.addEventListener('click', event => {
  if (!event.target.closest('[data-theme-toggle]')) return;
  theme = theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(key, theme); } catch {}
  applyTheme();
});
