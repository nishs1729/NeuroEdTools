/**
 * header.js — injects the shared site navigation header and handles theme toggling.
 * Include it as the first element of every page's <body>, and js/theme.js in <head>
 * so the saved theme is applied before the first paint.
 */
(function () {
  // ── 1. Inject header HTML ─────────────────────────────────────────────────
  const header = document.createElement('header');
  header.id = 'site-header';
  header.innerHTML = `
    <a class="skip-link" href="#main-content">Skip to content</a>
    <a class="site-logo" href="index.html">NeuroEdTools</a>
    <button id="menu-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
    <nav id="site-nav" aria-label="Tools">
      <a href="resting.html">Resting Potential</a>
      <a href="channel.html">Stochastic Channels</a>
      <a href="channelzoo.html">Channel Zoo</a>
      <a href="hh.html">Hodgkin-Huxley</a>
      <a href="fhn.html">FitzHugh-Nagumo</a>
      <a href="izhikevich.html">Izhikevich</a>
    </nav>
    <button id="theme-toggle">
      <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
      <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <span class="sr-only"></span>
    </button>
  `;
  document.body.insertBefore(header, document.body.firstChild);

  // Target for the skip link: the page's main content (parsed after this script runs)
  document.addEventListener('DOMContentLoaded', function () {
    const main = document.querySelector('main, #page-wrapper');
    if (!main) return;
    main.id = main.id || 'main-content';
    header.querySelector('.skip-link').setAttribute('href', '#' + main.id);
    main.setAttribute('tabindex', '-1');
  });

  // ── 2. Mark the current page's nav link as active ────────────────────────
  // Strip ".html" so clean URLs (/hh, served by some static hosts) also match
  const pageName = function (p) { return p.replace(/\.html$/, ''); };
  const currentPage = pageName(window.location.pathname.split('/').pop() || 'index.html');
  header.querySelectorAll('nav a').forEach(function (link) {
    if (pageName(link.getAttribute('href')) === currentPage) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });

  // ── 3. Collapsible nav on narrow screens ─────────────────────────────────
  const menuBtn = document.getElementById('menu-toggle');

  function setMenuOpen(open) {
    header.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  menuBtn.addEventListener('click', function () {
    setMenuOpen(!header.classList.contains('menu-open'));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenuOpen(false);
  });
  document.addEventListener('click', function (e) {
    if (!header.contains(e.target)) setMenuOpen(false);
  });

  // ── 4. Theme toggle with localStorage persistence ────────────────────────
  const btn = document.getElementById('theme-toggle');
  const btnLabel = btn.querySelector('.sr-only');

  function applyTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
    btnLabel.textContent = isDark ? 'Switch to light theme' : 'Switch to dark theme';
    btn.title = btnLabel.textContent;
  }

  // Restore saved preference; without one, follow the operating system setting
  const saved = localStorage.getItem('neurotools-dark');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  applyTheme(saved === null ? systemDark.matches : saved === 'true');
  systemDark.addEventListener('change', function (e) {
    if (localStorage.getItem('neurotools-dark') === null) applyTheme(e.matches);
  });

  btn.addEventListener('click', function () {
    const nowDark = document.documentElement.getAttribute('data-theme') !== 'dark';
    applyTheme(nowDark);
    localStorage.setItem('neurotools-dark', nowDark);
  });
})();
