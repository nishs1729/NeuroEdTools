/**
 * theme.js — applies the saved (or system) theme before the first paint, so dark-mode
 * users don't see a flash of the light theme. Load it in <head>; header.js adds the toggle.
 */
(function () {
  let saved = null;
  try { saved = localStorage.getItem('neurotools-dark'); } catch (e) { /* storage blocked */ }
  const dark = saved === null
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : saved === 'true';
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
})();
