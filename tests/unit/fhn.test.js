/**
 * unit/fhn.test.js
 *
 * Tests for the FitzHugh-Nagumo model math.
 * Functions are replicated exactly from doc/js/fnh.js.
 */

import { describe, it, expect } from 'vitest';

// ── Exact copy of fnh.js simulateFHN ─────────────────────────────────────────

function simulateFHN(i, a, b, epsilon, duration, v_init, w_init) {
  let v = v_init;
  let w = w_init;
  const dt = 0.1;
  const steps = Math.floor(duration / dt);

  const v_trace = [];
  const w_trace = [];
  const t_trace = [];

  for (let step = 0; step < steps; step++) {
    const dv = v - (v * v * v) / 3 - w + i;
    const dw = epsilon * (v + a - b * w);

    v += dt * dv;
    w += dt * dw;

    if (!isFinite(v) || !isFinite(w)) break;

    v_trace.push(v);
    w_trace.push(w);
    t_trace.push(step * dt);
  }
  return { t_trace, v_trace, w_trace };
}

/** Nullcline functions — V-nullcline: dv/dt = 0 → w = v - v³/3 + I */
function vNullcline(v, i) { return v - (v ** 3) / 3 + i; }
/** W-nullcline: dw/dt = 0 → w = (v + a) / b */
function wNullcline(v, a, b) { return (v + a) / b; }

// ── Default parameters (from fhn.html slider defaults) ───────────────────────
const DEFAULTS = { i: 0.5, a: 0.7, b: 0.8, epsilon: 0.08 };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FHN — simulation stability', () => {
  it('produces finite traces with default parameters', () => {
    const { v_trace, w_trace } = simulateFHN(
      DEFAULTS.i, DEFAULTS.a, DEFAULTS.b, DEFAULTS.epsilon, 200, -1, -1
    );
    expect(v_trace.every(isFinite)).toBe(true);
    expect(w_trace.every(isFinite)).toBe(true);
  });

  it('produces the correct number of steps', () => {
    const duration = 200;
    const { v_trace } = simulateFHN(DEFAULTS.i, DEFAULTS.a, DEFAULTS.b, DEFAULTS.epsilon, duration, -1, -1);
    expect(v_trace.length).toBe(Math.floor(duration / 0.1));
  });

  it('remains stable for epsilon values across allowed range [0.01, 0.2]', () => {
    for (const eps of [0.01, 0.05, 0.08, 0.12, 0.2]) {
      const { v_trace } = simulateFHN(DEFAULTS.i, DEFAULTS.a, DEFAULTS.b, eps, 200, -1, -1);
      expect(v_trace.every(isFinite), `Diverged at epsilon=${eps}`).toBe(true);
    }
  });

  it('remains stable across the full I range [0, 2]', () => {
    for (const I of [0, 0.5, 1.0, 1.5, 2.0]) {
      const { v_trace } = simulateFHN(I, DEFAULTS.a, DEFAULTS.b, DEFAULTS.epsilon, 200, -1, -1);
      expect(v_trace.every(isFinite), `Diverged at I=${I}`).toBe(true);
    }
  });
});

describe('FHN — ODE derivatives', () => {
  it('dv/dt is zero on V-nullcline', () => {
    // On V-nullcline: w = v - v³/3 + I → dv = v - v³/3 - w + I = 0
    for (const v of [-1.5, -0.5, 0, 0.5, 1.0]) {
      const w = vNullcline(v, DEFAULTS.i);
      const dv = v - (v ** 3) / 3 - w + DEFAULTS.i;
      expect(Math.abs(dv)).toBeLessThan(1e-10);
    }
  });

  it('dw/dt is zero on W-nullcline', () => {
    // On W-nullcline: w = (v+a)/b → dw = epsilon*(v + a - b*w) = 0
    for (const v of [-1.5, -0.5, 0, 0.5, 1.0]) {
      const w = wNullcline(v, DEFAULTS.a, DEFAULTS.b);
      const dw = DEFAULTS.epsilon * (v + DEFAULTS.a - DEFAULTS.b * w);
      expect(Math.abs(dw)).toBeLessThan(1e-10);
    }
  });

  it('increasing I shifts V-nullcline up (more excitable)', () => {
    const v = 0;
    const w_null_low = vNullcline(v, 0);
    const w_null_high = vNullcline(v, 1.5);
    expect(w_null_high).toBeGreaterThan(w_null_low);
  });
});

describe('FHN — excitability and oscillation', () => {
  it('produces oscillations for I=0.5 (above threshold)', () => {
    const { v_trace } = simulateFHN(0.5, DEFAULTS.a, DEFAULTS.b, DEFAULTS.epsilon, 500, -1, -1);
    const vMax = Math.max(...v_trace);
    const vMin = Math.min(...v_trace);
    // Should oscillate with meaningful amplitude
    expect(vMax - vMin).toBeGreaterThan(1.0);
  });

  it('converges to a fixed point for I=0 (below threshold)', () => {
    const { v_trace } = simulateFHN(0, DEFAULTS.a, DEFAULTS.b, DEFAULTS.epsilon, 1000, -1, -1);
    // Last 10% should be nearly constant (settled)
    const tail = v_trace.slice(-100);
    const tailMin = Math.min(...tail);
    const tailMax = Math.max(...tail);
    expect(tailMax - tailMin).toBeLessThan(0.1);
  });

  it('smaller epsilon produces slower recovery variable dynamics', () => {
    const { w_trace: w_fast } = simulateFHN(0.5, 0.7, 0.8, 0.15, 200, -1, -1);
    const { w_trace: w_slow } = simulateFHN(0.5, 0.7, 0.8, 0.02, 200, -1, -1);
    // Faster epsilon → w changes more; measure total variation
    const tv = (trace) => trace.slice(1).reduce((s, v, i) => s + Math.abs(v - trace[i]), 0);
    expect(tv(w_fast)).toBeGreaterThan(tv(w_slow));
  });

  it('initial conditions affect trajectory but not long-run limit cycle', () => {
    const run1 = simulateFHN(0.5, 0.7, 0.8, 0.08, 800, -1, -1);
    const run2 = simulateFHN(0.5, 0.7, 0.8, 0.08, 800, 1, 1);
    // Tail spans several oscillation periods so the phase offset between
    // runs averages out (a short window just samples different phases).
    const tail1 = run1.v_trace.slice(-2000);
    const tail2 = run2.v_trace.slice(-2000);
    const mean = t => t.reduce((a, b) => a + b, 0) / t.length;
    const amp = t => Math.max(...t) - Math.min(...t);
    // Both should converge to the same limit cycle: same mean and amplitude
    expect(Math.abs(mean(tail1) - mean(tail2))).toBeLessThan(0.1);
    expect(Math.abs(amp(tail1) - amp(tail2))).toBeLessThan(0.1);
  });
});
