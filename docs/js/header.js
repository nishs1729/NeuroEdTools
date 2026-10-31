/**
 * header.js — injects the shared site navigation header and handles theme toggling.
 * Include this script with <script src="js/header.js"></script> in every page's <head>
 * (or early in <body>) so the header renders before page content.
 */
(function () {
  // ── 1. Inject header HTML ─────────────────────────────────────────────────
  const header = document.createElement('header');
  header.id = 'site-header';
  header.innerHTML = `
    <a class="site-logo" href="index.html">NeuroEdTools</a>
    <button id="menu-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
    <nav id="site-nav">
      <a href="hh.html">Hodgkin-Huxley</a>
      <a href="channel.html">Stochastic Channels</a>
      <a href="channelzoo.html">Channel Zoo</a>
      <a href="fhn.html">FitzHugh-Nagumo</a>
      <a href="izhikevich.html">Izhikevich</a>
    </nav>
    <button id="theme-toggle" aria-label="Toggle dark mode">🌙 Dark</button>
  `;
  document.body.insertBefore(header, document.body.firstChild);

  // ── 2. Mark the current page's nav link as active ────────────────────────
  // Strip ".html" so clean URLs (/hh, served by some static hosts) also match
  const pageName = function (p) { return p.replace(/\.html$/, ''); };
  const currentPage = pageName(window.location.pathname.split('/').pop() || 'index.html');
  header.querySelectorAll('nav a').forEach(function (link) {
    if (pageName(link.getAttribute('href')) === currentPage) {
      link.classList.add('active');
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

  function applyTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
    btn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
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
