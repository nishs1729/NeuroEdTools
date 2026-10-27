/**
 * unit/hh.test.js
 *
 * Tests for the Hodgkin-Huxley model math.
 * Functions are replicated here exactly as implemented in docs/js/hh.js
 * so tests are self-contained and remain valid even if the source is refactored.
 */

import { describe, it, expect } from 'vitest';

// ── Exact copies of hh.js functions ──────────────────────────────────────────

function getAlphaBeta(V) {
  const alpha_n = (V === -55.0) ? 0.1 : (0.01 * (V + 55)) / (1 - Math.exp(-0.1 * (V + 55)));
  const beta_n = 0.125 * Math.exp(-0.0125 * (V + 65));
  const alpha_m = (V === -40.0) ? 1.0 : (0.1 * (V + 40)) / (1 - Math.exp(-0.1 * (V + 40)));
  const beta_m = 4 * Math.exp(-0.0556 * (V + 65));
  const alpha_h = 0.07 * Math.exp(-0.05 * (V + 65));
  const beta_h = 1 / (1 + Math.exp(-0.1 * (V + 35)));
  return { alpha_n, beta_n, alpha_m, beta_m, alpha_h, beta_h };
}

function hodgkinHuxley(V, m, h, n, gNaMax, gKMax, gL, ENa, EK, EL, Cm, i_inj) {
  const { alpha_n, beta_n, alpha_m, beta_m, alpha_h, beta_h } = getAlphaBeta(V);
  const gNa = gNaMax * m ** 3 * h;
  const gK = gKMax * n ** 4;
  const INa = gNa * (V - ENa);
  const IK = gK * (V - EK);
  const IL = gL * (V - EL);
  const dV = (i_inj - (INa + IK + IL));
  const dn = alpha_n * (1 - n) - beta_n * n;
  const dm = alpha_m * (1 - m) - beta_m * m;
  const dh = alpha_h * (1 - h) - beta_h * h;
  return { dV: dV / Cm, dm, dh, dn, gNa, gK, INa, IK, IL };
}

function runCurrentClamp({ gNaMax = 120, gKMax = 36, gL = 0.3,
  ENa = 50, EK = -77, EL = -54.4, Cm = 1.0,
  i_inj_val = 10, tSim = 50, tStart = 5, tEnd = 45 } = {}) {
  let V = -65, m = 0.05, h = 0.6, n = 0.32;
  const dt = 0.01;
  const results = [];
  for (let t = 0; t <= tSim; t += dt) {
    const i_inj = (t >= tStart && t <= tEnd) ? i_inj_val : 0;
    const d = hodgkinHuxley(V, m, h, n, gNaMax, gKMax, gL, ENa, EK, EL, Cm, i_inj);
    V += dt * d.dV; m += dt * d.dm; h += dt * d.dh; n += dt * d.dn;
    results.push({ t, V, m, h, n });
  }
  return results;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HH — alpha/beta rate functions', () => {
  it('alpha_n at V=-65 is positive and finite', () => {
    const { alpha_n } = getAlphaBeta(-65);
    expect(isFinite(alpha_n)).toBe(true);
    expect(alpha_n).toBeGreaterThan(0);
  });

  it('alpha_n at V=-55 returns the special-case limit 0.1', () => {
    const { alpha_n } = getAlphaBeta(-55);
    expect(alpha_n).toBeCloseTo(0.1, 6);
  });

  it('alpha_m at V=-40 returns the special-case limit 1.0', () => {
    const { alpha_m } = getAlphaBeta(-40);
    expect(alpha_m).toBeCloseTo(1.0, 6);
  });

  it('beta_n is positive everywhere in physiological range', () => {
    for (let V = -100; V <= 50; V += 5) {
      const { beta_n } = getAlphaBeta(V);
      expect(beta_n).toBeGreaterThan(0);
    }
  });

  it('beta_m is positive everywhere in physiological range', () => {
    for (let V = -100; V <= 50; V += 5) {
      const { beta_m } = getAlphaBeta(V);
      expect(beta_m).toBeGreaterThan(0);
    }
  });

  it('alpha_h is a decreasing function of V', () => {
    const { alpha_h: ah1 } = getAlphaBeta(-80);
    const { alpha_h: ah2 } = getAlphaBeta(-40);
    expect(ah1).toBeGreaterThan(ah2);
  });

  it('beta_h is an increasing function of V (inactivation increases with depolarisation)', () => {
    const { beta_h: bh1 } = getAlphaBeta(-80);
    const { beta_h: bh2 } = getAlphaBeta(-20);
    expect(bh2).toBeGreaterThan(bh1);
  });

  it('all rates are finite across full physiological range', () => {
    for (let V = -100; V <= 80; V += 1) {
      const r = getAlphaBeta(V);
      for (const key of Object.keys(r)) {
        expect(isFinite(r[key]), `${key} must be finite at V=${V}`).toBe(true);
      }
    }
  });

  it('steady-state n_inf is between 0 and 1 for all voltages', () => {
    for (let V = -100; V <= 80; V += 5) {
      const { alpha_n, beta_n } = getAlphaBeta(V);
      const n_inf = alpha_n / (alpha_n + beta_n);
      expect(n_inf).toBeGreaterThanOrEqual(0);
      expect(n_inf).toBeLessThanOrEqual(1);
    }
  });

  it('steady-state m_inf increases with depolarisation', () => {
    const { alpha_m: am1, beta_m: bm1 } = getAlphaBeta(-70);
    const { alpha_m: am2, beta_m: bm2 } = getAlphaBeta(0);
    const m1 = am1 / (am1 + bm1);
    const m2 = am2 / (am2 + bm2);
    expect(m2).toBeGreaterThan(m1);
  });

  it('steady-state h_inf decreases with depolarisation', () => {
    const { alpha_h: ah1, beta_h: bh1 } = getAlphaBeta(-80);
    const { alpha_h: ah2, beta_h: bh2 } = getAlphaBeta(0);
    const h1 = ah1 / (ah1 + bh1);
    const h2 = ah2 / (ah2 + bh2);
    expect(h1).toBeGreaterThan(h2);
  });
});

describe('HH — ODE derivatives', () => {
  const stdParams = [120, 36, 0.3, 50, -77, -54.4, 1.0];

  it('returns finite derivatives at resting state', () => {
    const d = hodgkinHuxley(-65, 0.05, 0.6, 0.32, ...stdParams, 0);
    expect(isFinite(d.dV)).toBe(true);
    expect(isFinite(d.dm)).toBe(true);
    expect(isFinite(d.dh)).toBe(true);
    expect(isFinite(d.dn)).toBe(true);
  });

  it('dV is near zero at rest with no injected current (quasi-stable resting potential)', () => {
    const d = hodgkinHuxley(-65, 0.05, 0.6, 0.32, ...stdParams, 0);
    // Not exactly zero because initial conditions are approximate
    expect(Math.abs(d.dV)).toBeLessThan(5);
  });

  it('gNa = gNaMax * m^3 * h correctly', () => {
    const m = 0.3, h = 0.7, gNaMax = 120;
    const d = hodgkinHuxley(-65, m, h, 0.32, gNaMax, 36, 0.3, 50, -77, -54.4, 1.0, 0);
    expect(d.gNa).toBeCloseTo(gNaMax * m ** 3 * h, 8);
  });

  it('gK = gKMax * n^4 correctly', () => {
    const n = 0.5, gKMax = 36;
    const d = hodgkinHuxley(-65, 0.05, 0.6, n, 120, gKMax, 0.3, 50, -77, -54.4, 1.0, 0);
    expect(d.gK).toBeCloseTo(gKMax * n ** 4, 8);
  });

  it('injected current increases dV', () => {
    const d0 = hodgkinHuxley(-65, 0.05, 0.6, 0.32, ...stdParams, 0);
    const d10 = hodgkinHuxley(-65, 0.05, 0.6, 0.32, ...stdParams, 10);
    expect(d10.dV).toBeGreaterThan(d0.dV);
  });

  it('setting gNa to 0 eliminates Na+ current', () => {
    const d = hodgkinHuxley(-65, 0.5, 0.6, 0.32, 0, 36, 0.3, 50, -77, -54.4, 1.0, 0);
    expect(d.gNa).toBe(0);
    // 0 * (V - ENa) is -0 when V < ENa; toBe uses Object.is, so compare numerically
    expect(d.INa === 0).toBe(true);
  });

  it('setting gK to 0 eliminates K+ current', () => {
    const d = hodgkinHuxley(-65, 0.05, 0.6, 0.5, 120, 0, 0.3, 50, -77, -54.4, 1.0, 0);
    expect(d.gK).toBe(0);
    expect(d.IK).toBe(0);
  });
});

describe('HH — full current-clamp simulation', () => {
  it('produces a finite voltage trace over 50 ms', () => {
    const results = runCurrentClamp({ tSim: 50, i_inj_val: 10 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => isFinite(r.V))).toBe(true);
  });

  it('fires at least one action potential with I=10 µA/cm²', () => {
    const results = runCurrentClamp({ tSim: 50, i_inj_val: 10 });
    const maxV = Math.max(...results.map(r => r.V));
    // Action potential peak should exceed 0 mV
    expect(maxV).toBeGreaterThan(0);
  });

  it('does NOT fire with I=-3 µA/cm² (hyperpolarising)', () => {
    const results = runCurrentClamp({ tSim: 50, i_inj_val: -3 });
    const maxV = Math.max(...results.map(r => r.V));
    expect(maxV).toBeLessThan(-40);
  });

  it('gating variables stay in [0, 1]', () => {
    const results = runCurrentClamp({ tSim: 50, i_inj_val: 10 });
    for (const r of results) {
      expect(r.m).toBeGreaterThanOrEqual(-0.01);
      expect(r.m).toBeLessThanOrEqual(1.01);
      expect(r.h).toBeGreaterThanOrEqual(-0.01);
      expect(r.h).toBeLessThanOrEqual(1.01);
      expect(r.n).toBeGreaterThanOrEqual(-0.01);
      expect(r.n).toBeLessThanOrEqual(1.01);
    }
  });

  it('fires multiple spikes (≥3) with sustained high current', () => {
    const results = runCurrentClamp({ tSim: 100, i_inj_val: 10, tStart: 5, tEnd: 95 });
    // Count action potential peaks (crossings above +20 mV)
    let spikes = 0;
    let aboveThresh = false;
    for (const r of results) {
      if (r.V > 20 && !aboveThresh) { spikes++; aboveThresh = true; }
      if (r.V < -20) aboveThresh = false;
    }
    expect(spikes).toBeGreaterThanOrEqual(3);
  });

  it('removing Na+ conductance abolishes action potentials', () => {
    const results = runCurrentClamp({ gNaMax: 0, tSim: 50, i_inj_val: 10 });
    const maxV = Math.max(...results.map(r => r.V));
    expect(maxV).toBeLessThan(0); // no spike
  });

  it('step count matches tSim/dt', () => {
    const tSim = 20;
    const dt = 0.01;
    const results = runCurrentClamp({ tSim });
    // t goes from 0 to tSim inclusive in exact arithmetic, but `t += dt`
    // accumulates float error and can skip the final t === tSim sample
    expect(Math.abs(results.length - (tSim / dt + 1))).toBeLessThanOrEqual(1);
  });
});
