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
    <nav>
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

  // ── 3. Theme toggle with localStorage persistence ────────────────────────
  const btn = document.getElementById('theme-toggle');

  function applyTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
    btn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
  }

  // Restore saved preference (default: light)
  const savedDark = localStorage.getItem('neurotools-dark') === 'true';
  applyTheme(savedDark);

  btn.addEventListener('click', function () {
    const nowDark = document.documentElement.getAttribute('data-theme') !== 'dark';
    applyTheme(nowDark);
    localStorage.setItem('neurotools-dark', nowDark);
  });
})();
