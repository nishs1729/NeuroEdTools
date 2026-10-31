/**
 * steps.js — shows one .model-section[data-tab] at a time, with a numbered tab bar above
 * the parts and previous/next buttons at the bottom of each. The open part is kept in the
 * URL hash (#part-2), so a part can be linked to directly.
 */
(function () {
  const sections = Array.from(document.querySelectorAll('.model-section[data-tab]'));
  if (sections.length < 2) return;

  const bar = document.createElement('div');
  bar.className = 'part-tabs';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Parts');

  const tabs = sections.map(function (section, i) {
    section.id = section.id || 'part-' + (i + 1);
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'part-tab';
    tab.id = section.id + '-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', section.id);
    tab.innerHTML = '<span class="part-num">' + (i + 1) + '</span>' +
      '<span class="part-label">' + section.dataset.tab + '</span>';
    tab.addEventListener('click', function () { show(i, true); });
    bar.appendChild(tab);

    section.setAttribute('role', 'tabpanel');
    section.setAttribute('aria-labelledby', tab.id);
    return tab;
  });
  sections[0].before(bar);

  // Previous / next buttons at the bottom of each part
  sections.forEach(function (section, i) {
    const pager = document.createElement('div');
    pager.className = 'part-pager';
    if (i > 0) pager.appendChild(pagerButton(i - 1, 'prev'));
    if (i < sections.length - 1) pager.appendChild(pagerButton(i + 1, 'next'));
    section.appendChild(pager);
  });

  function pagerButton(target, dir) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'part-pager-btn ' + dir;
    const label = sections[target].dataset.tab;
    btn.innerHTML = dir === 'prev'
      ? '<span class="part-pager-hint">← Previous</span>' + label
      : '<span class="part-pager-hint">Next →</span>' + label;
    btn.addEventListener('click', function () {
      show(target, true);
      bar.scrollIntoView({ block: 'start' });
      tabs[target].focus({ preventScroll: true });
    });
    return btn;
  }

  function show(index, updateHash) {
    sections.forEach(function (section, i) {
      const active = i === index;
      section.hidden = !active;
      tabs[i].setAttribute('aria-selected', active);
      tabs[i].tabIndex = active ? 0 : -1;
    });
    if (updateHash) history.replaceState(null, '', '#' + sections[index].id);
  }

  // Arrow keys move between tabs (WAI-ARIA tabs pattern)
  bar.addEventListener('keydown', function (e) {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    const last = tabs.length - 1;
    const next = { ArrowRight: current === last ? 0 : current + 1,
                   ArrowLeft: current === 0 ? last : current - 1,
                   Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    show(next, true);
    tabs[next].focus();
  });

  function indexFromHash() {
    const i = sections.findIndex(function (s) { return '#' + s.id === location.hash; });
    return i < 0 ? 0 : i;
  }

  window.addEventListener('hashchange', function () { show(indexFromHash(), false); });
  show(indexFromHash(), false);

  // Opening a #part-N link: land on the tab bar rather than partway down the part
  if (indexFromHash() > 0 || location.hash === '#' + sections[0].id) {
    bar.scrollIntoView({ block: 'start' });
  }
})();
