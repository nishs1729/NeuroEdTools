/**
 * plot.js — shared canvas plotting for every NeuroEdTools page.
 *
 * Usage:
 *   NeuroPlot.render(canvas, {
 *     title: 'Membrane Potential',
 *     xLabel: 'Time (ms)', yLabel: 'V (mV)', y2Label: 'I_{inj} (µA/cm²)',
 *     x: { min: 0, max: 50 },            // omit min/max to auto-range from data
 *     y: { min: 0, max: 1 },             // also: integer, nice (default true), grid
 *     y2: {},                            // secondary axis, used by series with axis: 'y2'
 *     series: [{ x: [...], y: [...], color: '--v-color', label: 'V', axis, width, dash }],
 *     raster: { rows: [[{ t, state }, ...], ...], color },   // channel open/closed bars
 *     vlines: [{ x, color, dash }],
 *     legend: true | false | HTMLElement, // HTMLElement → legend rendered as HTML there
 *     compact: false,                     // smaller fonts and padding for small plots
 *   });
 *
 * Colours are CSS custom property names ('--v-color') or literal colours. The spec is kept
 * per canvas, so plots redraw by themselves (without re-running the simulation) when the
 * theme changes, the canvas is resized, or the device pixel ratio changes.
 *
 * Labels accept a tiny markup: `_{sub}`, `^{sup}`, or `_x` / `^x` for a single character.
 */
(function () {
  const specs = new WeakMap();
  const bases = new WeakMap();   // logical size from the canvas's width/height attributes
  const drawnWidth = new WeakMap();
  const live = new Set();
  let lastDpr = window.devicePixelRatio || 1;

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(entries => {
        entries.forEach(entry => {
          const canvas = entry.target;
          if (canvas.clientWidth && canvas.clientWidth !== drawnWidth.get(canvas)) draw(canvas);
        });
      })
    : null;

  // ── Colours and text ─────────────────────────────────────────────────────
  function color(c, styles) {
    if (typeof c === 'string' && c.startsWith('--')) {
      return styles.getPropertyValue(c).trim() || '#888';
    }
    return c;
  }

  function cssColor(c) {
    return typeof c === 'string' && c.startsWith('--') ? `var(${c})` : c;
  }

  // Split "g_{Na}" / "m_∞" / "x^{2}" into [{ text, mode: 'base' | 'sub' | 'sup' }]
  function parseRich(text) {
    const parts = [];
    const re = /([_^])(\{([^}]*)\}|(.))/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push({ text: text.slice(last, m.index), mode: 'base' });
      parts.push({ text: m[3] !== undefined ? m[3] : m[4], mode: m[1] === '_' ? 'sub' : 'sup' });
      last = re.lastIndex;
    }
    if (last < text.length) parts.push({ text: text.slice(last), mode: 'base' });
    return parts;
  }

  function richToHtml(text) {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return parseRich(text).map(p =>
      p.mode === 'base' ? esc(p.text) : `<${p.mode}>${esc(p.text)}</${p.mode}>`
    ).join('');
  }

  function richWidth(ctx, parts, size, weight, family) {
    let w = 0;
    parts.forEach(p => {
      ctx.font = `${weight} ${p.mode === 'base' ? size : Math.round(size * 0.72)}px ${family}`;
      w += ctx.measureText(p.text).width;
    });
    return w;
  }

  // Draw rich text with its baseline at y; align is 'left' | 'center' | 'right'
  function drawRich(ctx, text, x, y, align, size, weight, family) {
    const parts = parseRich(String(text));
    const total = richWidth(ctx, parts, size, weight, family);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    parts.forEach(p => {
      const small = p.mode !== 'base';
      ctx.font = `${weight} ${small ? Math.round(size * 0.72) : size}px ${family}`;
      const dy = p.mode === 'sub' ? size * 0.28 : p.mode === 'sup' ? -size * 0.4 : 0;
      ctx.fillText(p.text, cx, y + dy);
      cx += ctx.measureText(p.text).width;
    });
    return total;
  }

  // ── Ticks ────────────────────────────────────────────────────────────────
  function niceStep(span, target, integer) {
    const raw = span / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    let step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    if (integer && step < 1) step = 1;
    return step;
  }

  function ticksFor(lo, hi, step) {
    const out = [];
    const start = Math.ceil(lo / step - 1e-9);
    const end = Math.floor(hi / step + 1e-9);
    for (let n = start; n <= end; n++) out.push(parseFloat((n * step).toPrecision(12)));
    return out;
  }

  function formatTick(v, step) {
    const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    let s = v.toFixed(decimals);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('-', '−');
  }

  // Resolve an axis: domain [lo, hi] (lo maps to the bottom/left), ticks and step
  function resolveAxis(opts, values, target) {
    opts = opts || {};
    let lo = opts.min;
    let hi = opts.max;
    const auto = lo === undefined || hi === undefined;
    if (auto) {
      let dmin = Infinity;
      let dmax = -Infinity;
      values.forEach(arr => {
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i];
          if (Number.isFinite(v)) {
            if (v < dmin) dmin = v;
            if (v > dmax) dmax = v;
          }
        }
      });
      if (dmin === Infinity) { dmin = 0; dmax = 1; }
      if (lo === undefined) lo = dmin;
      if (hi === undefined) hi = dmax;
    }
    if (lo === hi) {
      const pad = Math.abs(lo) * 0.1 || 1;
      lo -= pad;
      hi += pad;
    }
    const min = Math.min(lo, hi);
    const max = Math.max(lo, hi);
    const step = niceStep(max - min, target, opts.integer);
    if (auto && opts.nice !== false) {
      if (opts.min === undefined && lo <= hi) lo = Math.floor(lo / step + 1e-9) * step;
      if (opts.max === undefined && lo <= hi) hi = Math.ceil(hi / step - 1e-9) * step;
    }
    const ticks = ticksFor(Math.min(lo, hi), Math.max(lo, hi), step);
    return { lo, hi, step, ticks };
  }

  // ── Drawing ──────────────────────────────────────────────────────────────
  function render(canvas, spec) {
    if (!canvas) return;
    specs.set(canvas, spec);
    if (!bases.has(canvas)) {
      bases.set(canvas, { w: canvas.width, h: canvas.height });
      // Logical CSS width; page stylesheets may override it (e.g. width: 100%)
      canvas.style.setProperty('--plot-w', canvas.width + 'px');
      live.add(canvas);
      if (resizeObserver) resizeObserver.observe(canvas);
    }
    draw(canvas);
  }

  function draw(canvas) {
    const spec = specs.get(canvas);
    const base = bases.get(canvas);
    if (!spec || !base) return;

    // Hidden canvases (display: none) have no layout size; draw them at their base size
    const w = canvas.clientWidth || base.w;
    const h = Math.round(w * base.h / base.w);
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    drawnWidth.set(canvas, canvas.clientWidth);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const styles = getComputedStyle(document.documentElement);
    const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const textColor = color('--plot-text', styles);
    const mutedColor = color('--plot-muted', styles);
    const axisColor = color('--plot-axis', styles);
    const gridColor = color('--plot-grid', styles);

    const compact = !!spec.compact;
    const fsTitle = compact ? 12 : 15;
    const fsLabel = compact ? 11 : 13;
    const fsTick = compact ? 10 : 12;
    const fsLegend = compact ? 11 : 12;

    const series = (spec.series || []).filter(s => s && s.y);
    const primary = series.filter(s => s.axis !== 'y2');
    const secondary = series.filter(s => s.axis === 'y2');
    const hasY2 = secondary.length > 0;

    const legendItems = series.filter(s => s.label && s.legend !== false);
    const htmlLegend = spec.legend instanceof HTMLElement ? spec.legend : null;
    const canvasLegend = !htmlLegend && spec.legend !== false && legendItems.length > 0;

    // Vertical layout
    const pad = { top: 8, right: 14, bottom: 6, left: 8 };
    if (spec.title) pad.top += fsTitle + 10;
    const legendY = pad.top + fsLegend * 0.5;
    if (canvasLegend) pad.top += fsLegend + 10;
    pad.bottom += fsTick + 8;
    if (spec.xLabel) pad.bottom += fsLabel + 8;
    const plotH = Math.max(10, h - pad.top - pad.bottom);

    // Y axes
    const yTarget = Math.max(2, Math.round(plotH / (compact ? 35 : 45)));
    const rasterRows = spec.raster ? spec.raster.rows.length : 0;
    const yOpts = spec.raster
      ? Object.assign({ min: rasterRows + 0.5, max: 0.5, integer: true }, spec.y)
      : spec.y;
    const yAxis = resolveAxis(yOpts, primary.map(s => s.y), yTarget);
    if (spec.raster) yAxis.ticks = yAxis.ticks.filter(v => v >= 1 && v <= rasterRows);
    const y2Axis = hasY2 ? resolveAxis(spec.y2, secondary.map(s => s.y), yTarget) : null;

    const tickWidth = axis => {
      ctx.font = `${fsTick}px ${family}`;
      return axis.ticks.reduce((m, v) => Math.max(m, ctx.measureText(formatTick(v, axis.step)).width), 0);
    };
    pad.left += tickWidth(yAxis) + 8;
    if (spec.yLabel) pad.left += fsLabel + 8;
    if (hasY2) {
      pad.right = 8 + tickWidth(y2Axis) + 8;
      if (spec.y2Label) pad.right += fsLabel + 8;
    }
    const plotW = Math.max(10, w - pad.left - pad.right);

    // X axis
    const xAxis = resolveAxis(
      Object.assign({ nice: false }, spec.x),
      series.map(s => s.x || []),
      Math.max(2, Math.round(plotW / (compact ? 55 : 85)))
    );

    const sx = v => pad.left + ((v - xAxis.lo) / (xAxis.hi - xAxis.lo)) * plotW;
    const syFor = axis => v => pad.top + plotH - ((v - axis.lo) / (axis.hi - axis.lo)) * plotH;
    const sy = syFor(yAxis);
    const sy2 = hasY2 ? syFor(y2Axis) : null;
    const left = pad.left;
    const right = pad.left + plotW;
    const top = pad.top;
    const bottom = pad.top + plotH;

    // Grid
    if (!spec.raster && (!spec.y || spec.y.grid !== false)) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      yAxis.ticks.forEach(v => {
        const y = Math.round(sy(v)) + 0.5;
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
      });
      xAxis.ticks.forEach(v => {
        const x = Math.round(sx(v)) + 0.5;
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
      });
      ctx.stroke();
    }

    // Data, clipped to the plot area
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top - 1, plotW, plotH + 2);
    ctx.clip();

    if (spec.raster) {
      const rows = spec.raster.rows;
      const rowH = plotH / Math.max(1, rows.length);
      const barH = Math.max(1, Math.min(rowH * 0.6, 10));
      ctx.fillStyle = color(spec.raster.color || '--raster-color', styles);
      rows.forEach((row, i) => {
        const yc = sy(i + 1);
        let start = null;
        for (let k = 0; k < row.length; k++) {
          const open = row[k].state === 1;
          if (open && start === null) start = row[k].t;
          if ((!open || k === row.length - 1) && start !== null) {
            const end = row[k].t;
            const x0 = sx(start);
            ctx.fillRect(x0, yc - barH / 2, Math.max(1, sx(end) - x0), barH);
            start = null;
          }
        }
      });
    }

    const clampPx = v => Math.max(-1e5, Math.min(1e5, v));
    series.forEach(s => {
      const scaleY = s.axis === 'y2' ? sy2 : sy;
      const xs = s.x;
      ctx.beginPath();
      ctx.strokeStyle = color(s.color, styles);
      ctx.lineWidth = s.width || 1.75;
      ctx.lineJoin = 'round';
      ctx.setLineDash(s.dash || []);
      let penDown = false;
      for (let i = 0; i < s.y.length; i++) {
        const xv = xs[i];
        const yv = s.y[i];
        if (!Number.isFinite(xv) || !Number.isFinite(yv)) { penDown = false; continue; }
        const px = clampPx(sx(xv));
        const py = clampPx(scaleY(yv));
        if (penDown) ctx.lineTo(px, py);
        else { ctx.moveTo(px, py); penDown = true; }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    (spec.vlines || []).forEach(line => {
      if (line.x === null || line.x === undefined) return;
      const x = Math.round(sx(line.x)) + 0.5;
      ctx.beginPath();
      ctx.strokeStyle = color(line.color || '--plot-muted', styles);
      ctx.lineWidth = 1;
      ctx.setLineDash(line.dash || [4, 3]);
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    ctx.restore();

    // Axis lines
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left + 0.5, top);
    ctx.lineTo(left + 0.5, bottom + 0.5);
    ctx.lineTo(right, bottom + 0.5);
    if (hasY2) {
      ctx.moveTo(right + 0.5, top);
      ctx.lineTo(right + 0.5, bottom + 0.5);
    }
    ctx.stroke();

    // Tick marks and labels
    ctx.fillStyle = mutedColor;
    ctx.font = `${fsTick}px ${family}`;
    ctx.beginPath();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    yAxis.ticks.forEach(v => {
      const y = Math.round(sy(v)) + 0.5;
      ctx.moveTo(left - 4, y);
      ctx.lineTo(left, y);
      ctx.fillText(formatTick(v, yAxis.step), left - 7, y);
    });
    if (hasY2) {
      ctx.textAlign = 'left';
      y2Axis.ticks.forEach(v => {
        const y = Math.round(sy2(v)) + 0.5;
        ctx.moveTo(right, y);
        ctx.lineTo(right + 4, y);
        ctx.fillText(formatTick(v, y2Axis.step), right + 7, y);
      });
    }
    ctx.textBaseline = 'top';
    xAxis.ticks.forEach((v, i) => {
      const x = Math.round(sx(v)) + 0.5;
      ctx.moveTo(x, bottom);
      ctx.lineTo(x, bottom + 4);
      // Keep the first/last labels inside the canvas
      const label = formatTick(v, xAxis.step);
      const half = ctx.measureText(label).width / 2;
      ctx.textAlign = 'center';
      ctx.fillText(label, Math.min(w - half - 2, Math.max(half + 2, x)), bottom + 7);
    });
    ctx.strokeStyle = axisColor;
    ctx.stroke();

    // Axis titles
    ctx.fillStyle = textColor;
    if (spec.xLabel) {
      drawRich(ctx, spec.xLabel, left + plotW / 2, h - 8, 'center', fsLabel, '500', family);
    }
    const drawVertical = (text, x, angle) => {
      ctx.save();
      ctx.translate(x, top + plotH / 2);
      ctx.rotate(angle);
      drawRich(ctx, text, 0, 0, 'center', fsLabel, '500', family);
      ctx.restore();
    };
    if (spec.yLabel) drawVertical(spec.yLabel, 8 + fsLabel, -Math.PI / 2);
    if (hasY2 && spec.y2Label) drawVertical(spec.y2Label, w - 8 - fsLabel, Math.PI / 2);

    if (spec.title) {
      drawRich(ctx, spec.title, w / 2, 8 + fsTitle, 'center', fsTitle, '600', family);
    }

    // Legend
    if (canvasLegend) {
      const swatch = 16;
      const gap = 14;
      const widths = legendItems.map(s =>
        swatch + 5 + richWidth(ctx, parseRich(s.label), fsLegend, 'normal', family));
      const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
      let x = Math.max(left, right - total);
      legendItems.forEach((s, i) => {
        ctx.strokeStyle = color(s.color, styles);
        ctx.lineWidth = 2.5;
        ctx.setLineDash(s.dash || []);
        ctx.beginPath();
        ctx.moveTo(x, legendY);
        ctx.lineTo(x + swatch, legendY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = textColor;
        drawRich(ctx, s.label, x + swatch + 5, legendY + fsLegend * 0.35, 'left', fsLegend, 'normal', family);
        x += widths[i] + gap;
      });
    }
    if (htmlLegend) {
      htmlLegend.innerHTML = legendItems.map(s => `
        <div class="legend-item">
          <span class="legend-color${s.dash ? ' dashed' : ''}" style="--swatch: ${cssColor(s.color)}"></span>
          <span>${richToHtml(s.label)}</span>
        </div>`).join('');
    }
  }

  function redrawAll() {
    live.forEach(canvas => {
      if (canvas.isConnected) draw(canvas);
      else live.delete(canvas);
    });
  }

  // Redraw on theme change (header.js sets data-theme on <html>)
  new MutationObserver(redrawAll).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // Redraw when moving between screens with different pixel densities, or zooming
  window.addEventListener('resize', () => {
    const dpr = window.devicePixelRatio || 1;
    if (dpr !== lastDpr) {
      lastDpr = dpr;
      redrawAll();
    }
  });

  window.NeuroPlot = { render, redrawAll };
})();
