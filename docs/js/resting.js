/**
 * resting.js — Resting Membrane Potential, Part 1: one ion and the Nernst potential.
 *
 * A membrane whose channels pass only one ion separates the cell (left) from the outside
 * (right). The membrane potential V relaxes towards the Nernst potential E with time
 * constant TAU_MS. Ion crossings are drawn at the GHK unidirectional flux rates, so at E
 * the outward and inward crossings visibly balance: equilibrium means equal fluxes in
 * both directions, not zero flux.
 *
 * Each compartment is drawn as a small window onto a much larger volume, so the number of
 * ions on each side tracks the concentration and does not run down as ions cross. (In a
 * real cell the change is tiny; the "moved" readout gives its size.)
 */
(function () {
  // ── Physics ─────────────────────────────────────────────────────────────
  const R = 8.314;          // J/(mol·K)
  const F = 96485;          // C/mol
  const CM = 1e-2;          // membrane capacitance, F/m² (1 µF/cm²)
  const CELL_RADIUS = 10e-6; // m, spherical cell used for the "ions moved" estimate

  const IONS = {
    K:  { name: 'K⁺',  sub: 'K',  z: 1,  cin: 140,    cout: 5,   color: '--k-color' },
    Na: { name: 'Na⁺', sub: 'Na', z: 1,  cin: 12,     cout: 145, color: '--na-color' },
    Cl: { name: 'Cl⁻', sub: 'Cl', z: -1, cin: 10,     cout: 110, color: '--cl-color' },
    Ca: { name: 'Ca²⁺', sub: 'Ca', z: 2, cin: 0.0001, cout: 2,   color: '--ca-color' },
  };

  // RT/F in mV
  function thermalVoltage(tempC) {
    return R * (tempC + 273.15) / F * 1000;
  }

  // Nernst potential (mV) for valence z and concentrations in/out
  function nernst(z, cin, cout, tempC) {
    return thermalVoltage(tempC) / z * Math.log(cout / cin);
  }

  // u / (1 − e^(−u)), the GHK flux factor; → 1 as u → 0
  function ghkFactor(u) {
    if (Math.abs(u) < 1e-6) return 1 + u / 2;
    return u / (1 - Math.exp(-u));
  }

  // Unidirectional GHK fluxes at V (mV), relative to the flux each way at equilibrium.
  // Both equal 1 when V = E.
  function relativeFluxes(z, cin, cout, V, tempC) {
    const vT = thermalVoltage(tempC);
    const u = z * V / vT;
    const uEq = Math.log(cout / cin);  // z·E/vT
    const norm = cin * ghkFactor(uEq);
    return {
      out: cin * ghkFactor(u) / norm,
      in: cout * ghkFactor(-u) / norm,
    };
  }

  // Concentration change (mM) inside a CELL_RADIUS sphere when enough ions cross to charge
  // the membrane to V (mV): Q = C·V per area, over volume/area = r/3.
  function concentrationMoved(z, V) {
    return CM * Math.abs(V) / 1000 / (Math.abs(z) * F) * 3 / CELL_RADIUS;
  }

  // ── Simulation settings ─────────────────────────────────────────────────
  const TAU_MS = 2;          // membrane time constant
  const SIM_SPEED = 2;       // simulated ms per real second
  const WINDOW_MS = 30;      // time shown on the plots
  const SAMPLE_MS = 0.05;
  const EQ_CROSS_RATE = 2.5; // drawn crossings per second, each way, at equilibrium
  const MAX_CROSS_RATE = 25;

  // ── Scene geometry (world units; the canvas is scaled uniformly) ─────────
  const W = 800, H = 400;
  const MEM_L = 382, MEM_R = 418;
  const PORES = [90, 200, 310];
  const PORE_HALF = 13;
  const ION_R = 6;
  const MAX_PARTICLES = 90;  // on the side with the higher concentration
  const SPEED = 45;          // px/s

  // ── DOM ─────────────────────────────────────────────────────────────────
  const el = id => document.getElementById(id);
  const ionSelect = el('ion');
  const sliders = { cin: el('c_in'), cout: el('c_out'), temp: el('temp') };
  const scene = el('scene');
  const playBtn = el('play');
  const plotV = el('plot-v');
  const plotFlux = el('plot-flux');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── State ───────────────────────────────────────────────────────────────
  const state = {
    ion: 'K',
    cin: 140,
    cout: 5,
    temp: 37,
    V: 0,
    t: 0,
    running: !reducedMotion,
    hist: { t: [], V: [], out: [], in: [] },
    lastSample: -Infinity,
    particles: [],
    crossers: [],
    spawnAcc: { out: 0, in: 0 },
  };

  const ion = () => IONS[state.ion];
  const E = () => nernst(ion().z, state.cin, state.cout, state.temp);

  // ── Formatting ──────────────────────────────────────────────────────────
  function fmtConc(mM) {
    if (mM >= 10) return mM.toFixed(0) + ' mM';
    if (mM >= 1) return mM.toFixed(1) + ' mM';
    if (mM >= 0.1) return mM.toFixed(2) + ' mM';
    if (mM >= 1e-3) return (mM * 1e3).toPrecision(2).replace(/\.0$/, '') + ' µM';
    return (mM * 1e6).toPrecision(2).replace(/\.0$/, '') + ' nM';
  }

  function fmtMV(v, signed) {
    const s = Math.abs(v) < 0.05 ? '0.0' : v.toFixed(1);
    const out = (signed && v >= 0.05 ? '+' : '') + s.replace('-', '−');
    return out + ' mV';
  }

  function fmtPercent(p) {
    if (p >= 10) return p.toFixed(0) + '%';
    if (p >= 0.1) return p.toPrecision(2) + '%';
    return p.toPrecision(1) + '%';
  }

  // Concentration sliders are logarithmic: value = log10(mM)
  const sliderToConc = s => Math.pow(10, parseFloat(s.value));

  // ── Particles ───────────────────────────────────────────────────────────
  const sideBounds = side => side === 'in'
    ? { x0: ION_R + 2, x1: MEM_L - ION_R - 2 }
    : { x0: MEM_R + ION_R + 2, x1: W - ION_R - 2 };

  function targetCount(side) {
    const cmax = Math.max(state.cin, state.cout);
    const c = side === 'in' ? state.cin : state.cout;
    return Math.round(MAX_PARTICLES * c / cmax);
  }

  function newParticle(side, fadeIn) {
    const b = sideBounds(side);
    return {
      side,
      x: b.x0 + Math.random() * (b.x1 - b.x0),
      y: ION_R + 2 + Math.random() * (H - 2 * ION_R - 4),
      ang: Math.random() * Math.PI * 2,
      alpha: fadeIn ? 0 : 1,
      fade: fadeIn ? 1 : 0,
    };
  }

  // Add or fade out particles so each side matches its concentration
  function rebalance(side, fadeIn) {
    const alive = state.particles.filter(p => p.side === side && p.fade >= 0);
    const target = targetCount(side);
    for (let i = alive.length; i < target; i++) state.particles.push(newParticle(side, fadeIn));
    // Remove random extras away from the membrane, so removals aren't mistaken for ions
    // entering a channel (always taking the furthest would crowd ions against the membrane)
    let extra = alive.length - target;
    while (extra-- > 0) {
      const far = alive.filter(p => p.fade >= 0 && Math.abs(p.x - 400) > 100);
      const pool = far.length ? far : alive.filter(p => p.fade >= 0);
      pool[Math.floor(Math.random() * pool.length)].fade = -1;
    }
  }

  function respawnAll() {
    state.particles = [];
    state.crossers = [];
    rebalance('in', false);
    rebalance('out', false);
  }

  function moveParticles(dt) {
    state.particles.forEach(p => {
      p.ang += (Math.random() - 0.5) * 6 * Math.sqrt(dt);
      p.x += Math.cos(p.ang) * SPEED * dt;
      p.y += Math.sin(p.ang) * SPEED * dt;
      const b = sideBounds(p.side);
      if (p.x < b.x0) { p.x = b.x0; p.ang = Math.PI - p.ang; }
      if (p.x > b.x1) { p.x = b.x1; p.ang = Math.PI - p.ang; }
      if (p.y < ION_R + 2) { p.y = ION_R + 2; p.ang = -p.ang; }
      if (p.y > H - ION_R - 2) { p.y = H - ION_R - 2; p.ang = -p.ang; }
      if (p.fade) p.alpha = Math.min(1, Math.max(0, p.alpha + p.fade * dt / (p.merging ? 1.2 : 0.6)));
      if (p.fade > 0 && p.alpha >= 1) p.fade = 0;
    });
    state.particles = state.particles.filter(p => !(p.fade < 0 && p.alpha <= 0));
  }

  // Crossers travel through a pore from one side to the other, then merge into the bulk
  function spawnCrossers(dt, fluxes) {
    ['out', 'in'].forEach(dir => {
      const rate = Math.min(MAX_CROSS_RATE, EQ_CROSS_RATE * fluxes[dir]);
      state.spawnAcc[dir] += rate * dt;
      while (state.spawnAcc[dir] >= 1) {
        state.spawnAcc[dir] -= 1;
        const pore = PORES[Math.floor(Math.random() * PORES.length)];
        const from = dir === 'out' ? MEM_L - 26 : MEM_R + 26;
        const to = dir === 'out' ? MEM_R + 26 : MEM_L - 26;
        state.crossers.push({ dir, x: from, from, to, y: pore, alpha: 0 });
      }
    });
  }

  function moveCrossers(dt) {
    const arrived = [];
    state.crossers.forEach(c => {
      const step = 95 * dt * Math.sign(c.to - c.from);
      c.x += step;
      c.alpha = Math.min(1, c.alpha + dt / 0.15);
      if ((c.to - c.x) * Math.sign(c.to - c.from) <= 0) arrived.push(c);
    });
    if (!arrived.length) return;
    state.crossers = state.crossers.filter(c => !arrived.includes(c));
    arrived.forEach(c => {
      const side = c.dir === 'out' ? 'out' : 'in';
      const p = newParticle(side, false);
      p.x = c.to;
      p.y = c.y;
      p.ang = c.dir === 'out' ? (Math.random() - 0.5) : Math.PI + (Math.random() - 0.5);
      // It merges into the bulk, which stands for a large reservoir at fixed concentration
      p.fade = -1;
      p.merging = true;
      state.particles.push(p);
    });
  }

  // ── Simulation step ─────────────────────────────────────────────────────
  function sample() {
    const f = relativeFluxes(ion().z, state.cin, state.cout, state.V, state.temp);
    const h = state.hist;
    h.t.push(state.t); h.V.push(state.V); h.out.push(f.out); h.in.push(f.in);
    while (h.t.length && h.t[0] < state.t - WINDOW_MS) {
      h.t.shift(); h.V.shift(); h.out.shift(); h.in.shift();
    }
    state.lastSample = state.t;
  }

  function step(dtReal) {
    const dtSim = dtReal * SIM_SPEED;
    const e = E();
    // Exact exponential relaxation over the step
    state.V = e + (state.V - e) * Math.exp(-dtSim / TAU_MS);
    state.t += dtSim;
    if (state.t - state.lastSample >= SAMPLE_MS) sample();

    const fluxes = relativeFluxes(ion().z, state.cin, state.cout, state.V, state.temp);
    moveParticles(dtReal);
    spawnCrossers(dtReal, fluxes);
    moveCrossers(dtReal);
  }

  function resetVoltage() {
    state.V = 0;
    state.t = 0;
    state.hist = { t: [], V: [], out: [], in: [] };
    state.lastSample = -Infinity;
    state.crossers = [];
    state.spawnAcc = { out: 0, in: 0 };
    sample();
  }

  // ── Drawing: membrane scene ─────────────────────────────────────────────
  function drawScene() {
    const w = scene.clientWidth || W;
    const h = Math.round(w * H / W);
    const dpr = window.devicePixelRatio || 1;
    if (scene.width !== Math.round(w * dpr)) scene.width = Math.round(w * dpr);
    if (scene.height !== Math.round(h * dpr)) scene.height = Math.round(h * dpr);
    const ctx = scene.getContext('2d');
    const k = w / W * dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const styles = getComputedStyle(document.documentElement);
    const css = name => styles.getPropertyValue(name).trim();
    const ionColor = css(ion().color) || '#0072b2';

    // Compartments
    ctx.fillStyle = css('--cyto-bg');
    ctx.fillRect(0, 0, MEM_L, H);
    ctx.fillStyle = css('--extra-bg');
    ctx.fillRect(MEM_R, 0, W - MEM_R, H);

    // Membrane: lipid tails, then heads along both faces, skipping the pores
    const inPore = y => PORES.some(p => Math.abs(y - p) < PORE_HALF + 30);
    ctx.fillStyle = css('--membrane-core');
    ctx.fillRect(MEM_L, 0, MEM_R - MEM_L, H);
    ctx.fillStyle = css('--lipid-head');
    for (let y = 6; y < H; y += 12) {
      if (inPore(y)) continue;
      [MEM_L + 4, MEM_R - 4].forEach(x => {
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Channels: a protein on either side of each pore
    PORES.forEach(py => {
      ctx.fillStyle = css('--cyto-bg');
      ctx.fillRect(MEM_L, py - PORE_HALF - 28, MEM_R - MEM_L, 2 * (PORE_HALF + 28));
      [[py - PORE_HALF - 28, py - PORE_HALF], [py + PORE_HALF, py + PORE_HALF + 28]].forEach(([y0, y1]) => {
        ctx.beginPath();
        roundRect(ctx, MEM_L - 5, y0, MEM_R - MEM_L + 10, y1 - y0, 6);
        ctx.fillStyle = css('--channel-fill');
        ctx.fill();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = ionColor;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = ionColor;
        ctx.stroke();
      });
      ctx.fillStyle = css('--pore-bg');
      ctx.fillRect(MEM_L - 5, py - PORE_HALF, MEM_R - MEM_L + 10, 2 * PORE_HALF);
    });

    // Excess charge on the membrane faces: one mark per ~6 mV
    const n = Math.min(26, Math.round(Math.abs(state.V) / 6));
    if (n > 0) {
      const insideNeg = state.V < 0;
      const slots = [];
      for (let y = 18; y < H - 10; y += 14) if (!PORES.some(p => Math.abs(y - p) < PORE_HALF + 6)) slots.push(y);
      const pick = Math.min(n, slots.length);
      ctx.font = `bold 15px ${getComputedStyle(document.body).fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < pick; i++) {
        const y = slots[Math.floor((i + 0.5) * slots.length / pick)];
        drawCharge(ctx, MEM_L - 13, y, insideNeg ? '−' : '+', css(insideNeg ? '--minus-color' : '--plus-color'));
        drawCharge(ctx, MEM_R + 13, y, insideNeg ? '+' : '−', css(insideNeg ? '--plus-color' : '--minus-color'));
      }
    }

    // Ions
    ctx.fillStyle = ionColor;
    state.particles.forEach(p => {
      ctx.globalAlpha = 0.85 * p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ION_R, 0, Math.PI * 2);
      ctx.fill();
    });
    const ring = css('--crosser-ring');
    state.crossers.forEach(c => {
      ctx.globalAlpha = c.alpha;
      ctx.beginPath();
      ctx.arc(c.x, c.y, ION_R + 1, 0, Math.PI * 2);
      ctx.fillStyle = ionColor;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = ring;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function drawCharge(ctx, x, y, sign, color) {
    ctx.fillStyle = color;
    ctx.fillText(sign, x, y + 1);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ── Drawing: forces, readouts, plots ─────────────────────────────────────
  function setForce(id, outward, scale) {
    const bar = el(id);
    const pct = Math.min(50, Math.abs(outward) / scale * 50);
    bar.style.width = pct + '%';
    bar.style.left = outward >= 0 ? '50%' : (50 - pct) + '%';
    bar.classList.toggle('inward', outward < 0);
    bar.classList.toggle('zero', pct < 0.5);
  }

  function forceText(outward, isNet) {
    if (Math.abs(outward) < 0.5) return isNet ? 'balanced' : 'none';
    return Math.abs(outward).toFixed(0) + ' mV ' + (outward > 0 ? 'out' : 'in');
  }

  function updatePanels() {
    const { z, name, sub } = ion();
    const e = E();
    const V = state.V;
    const sgn = Math.sign(z);

    // Outward-positive pushes, as equivalent voltages
    const chem = -sgn * e;      // concentration gradient
    const elec = sgn * V;       // electric field acting on the ion's charge
    const net = chem + elec;    // = sign(z)·(V − E)
    const scale = Math.max(40, Math.abs(chem), Math.abs(elec));
    setForce('force-chem', chem, scale);
    setForce('force-elec', elec, scale);
    setForce('force-net', net, scale);
    el('force-chem-value').textContent = forceText(chem);
    el('force-elec-value').textContent = forceText(elec);
    el('force-net-value').textContent = forceText(net, true);

    el('readout-v').textContent = fmtMV(V);
    el('readout-e').textContent = fmtMV(e);
    el('readout-drive').textContent = fmtMV(V - e, true);

    const vT = thermalVoltage(state.temp);
    const zText = z === 1 ? '' : (z === -1 ? '−' : z);
    el('equation').innerHTML =
      `E<sub>${sub}</sub> = <span class="frac"><span>RT</span><span>${zText}F</span></span> ` +
      `ln <span class="frac"><span>[${name}]<sub>out</sub></span><span>[${name}]<sub>in</sub></span></span>` +
      `<span class="eq-numbers">= ${vT.toFixed(1)} mV${z === 1 ? '' : ' / ' + String(z).replace('-', '−')}` +
      ` × ln(${fmtConc(state.cout).replace(' ', '&nbsp;')} / ${fmtConc(state.cin).replace(' ', '&nbsp;')})` +
      ` = <strong>${fmtMV(e).replace(' ', '&nbsp;')}</strong></span>`;

    const moved = concentrationMoved(z, V);
    const note = el('moved-note');
    if (Math.abs(V) < 0.5) {
      note.textContent = 'The membrane is uncharged: equal numbers of positive and negative charges on each side.';
    } else {
      const pct = moved / state.cin * 100;
      let text = `To charge a 10 µm cell to ${fmtMV(V)}, about ${fmtConc(moved)} of ${name} has to cross: ` +
        `${fmtPercent(pct)} of the ${name} inside.`;
      if (pct > 10) text += ' That is a large share of so little intracellular ' + name + '; real cells hold most of theirs in buffers and stores.';
      note.textContent = text;
    }
  }

  let lastPlot = 0;
  function updatePlots() {
    const h = state.hist;
    const x1 = Math.max(WINDOW_MS, state.t);
    const x0 = x1 - WINDOW_MS;
    const e = E();
    const { name, sub, color } = ion();
    NeuroPlot.render(plotV, {
      title: 'Membrane potential',
      xLabel: 'Time (ms)', yLabel: 'V (mV)',
      x: { min: x0, max: x1 },
      series: [
        { x: [x0, x1], y: [e, e], color, dash: [5, 4], label: `E_{${sub}}` },
        { x: h.t, y: h.V, color: '--v-color', label: 'V_m', width: 2 },
        { x: [x0, x1], y: [0, 0], color: '--plot-grid', legend: false },
      ],
      compact: true,
    });
    NeuroPlot.render(plotFlux, {
      title: `${name} crossings`,
      xLabel: 'Time (ms)', yLabel: '× equilibrium rate',
      x: { min: x0, max: x1 },
      y: { min: 0 },
      series: [
        { x: h.t, y: h.out, color, label: 'outward', width: 2 },
        { x: h.t, y: h.in, color, dash: [5, 4], label: 'inward', width: 2 },
      ],
      compact: true,
    });
  }

  function updateAria() {
    const { name } = ion();
    const V = state.V;
    scene.setAttribute('role', 'img');
    scene.setAttribute('aria-label',
      `Membrane with ${name} channels. ${name} inside: ${fmtConc(state.cin)}, outside: ${fmtConc(state.cout)}. ` +
      `Membrane potential ${fmtMV(V)}` + (Math.abs(V) >= 0.5 ? `, inside ${V < 0 ? 'negative' : 'positive'}.` : '.'));
  }

  function render(now) {
    drawScene();
    updatePanels();
    if (!now || now - lastPlot > 66) {
      updatePlots();
      updateAria();
      lastPlot = now || 0;
    }
  }

  // ── Animation loop ──────────────────────────────────────────────────────
  let lastFrame = null;
  function frame(now) {
    if (!state.running) { lastFrame = null; return; }
    if (lastFrame !== null && scene.offsetParent !== null) {
      step(Math.min(0.05, (now - lastFrame) / 1000));
      render(now);
    }
    lastFrame = now;
    requestAnimationFrame(frame);
  }

  function setRunning(run) {
    state.running = run;
    playBtn.textContent = run ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', run);
    if (run) requestAnimationFrame(frame);
  }

  // ── Controls ────────────────────────────────────────────────────────────
  function syncLabels() {
    const { name, sub, color } = ion();
    document.querySelectorAll('.ion-name').forEach(n => { n.textContent = name; });
    document.querySelectorAll('.ion-sub').forEach(n => { n.textContent = sub; });
    el('legend-ion-dot').style.setProperty('--swatch', `var(${color})`);
    el('legend-cross-dot').style.setProperty('--swatch', `var(${color})`);
    el('c_in-value').textContent = fmtConc(state.cin);
    el('c_out-value').textContent = fmtConc(state.cout);
    el('temp-value').textContent = state.temp;
  }

  function setConcentrations(cin, cout) {
    state.cin = cin;
    state.cout = cout;
    sliders.cin.value = Math.log10(cin);
    sliders.cout.value = Math.log10(cout);
  }

  ionSelect.addEventListener('change', () => {
    state.ion = ionSelect.value;
    setConcentrations(ion().cin, ion().cout);
    syncLabels();
    respawnAll();
    resetVoltage();
    render();
  });

  ['cin', 'cout'].forEach(key => {
    sliders[key].addEventListener('input', () => {
      state[key] = sliderToConc(sliders[key]);
      syncLabels();
      rebalance('in', true);
      rebalance('out', true);
      render();
    });
  });

  sliders.temp.addEventListener('input', () => {
    state.temp = parseFloat(sliders.temp.value);
    syncLabels();
    render();
  });

  el('defaults').addEventListener('click', () => {
    setConcentrations(ion().cin, ion().cout);
    state.temp = 37;
    sliders.temp.value = 37;
    syncLabels();
    rebalance('in', true);
    rebalance('out', true);
    render();
  });

  playBtn.addEventListener('click', () => setRunning(!state.running));

  el('reset').addEventListener('click', () => {
    resetVoltage();
    render();
  });

  // Theme switches change CSS colours; redraw when paused
  new MutationObserver(() => { if (!state.running) render(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('resize', () => { if (!state.running) render(); });

  // ── Start ───────────────────────────────────────────────────────────────
  state.ion = ionSelect.value;
  setConcentrations(ion().cin, ion().cout);
  state.temp = parseFloat(sliders.temp.value);
  syncLabels();
  respawnAll();
  resetVoltage();
  render();
  setRunning(state.running);

  // For tests and the console
  window.RestingSim = { state, nernst, relativeFluxes, concentrationMoved, thermalVoltage };
})();
