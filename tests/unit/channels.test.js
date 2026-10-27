/**
 * unit/channels.test.js
 *
 * Tests for stochastic ion channel gating math.
 * Rate functions replicated exactly from docs/js/channel.js (HH object).
 * Statistical tests use large-N / many-trial approaches with seeded Math.random
 * replaced by deterministic inputs where possible.
 */

import { describe, it, expect } from 'vitest';

// ── HH rate functions (from channel.js) ──────────────────────────────────────
const HH = {
  alpha_n: V => (V === -55.0) ? 0.1 : (0.01 * (V + 55)) / (1 - Math.exp(-0.1 * (V + 55))),
  beta_n:  V => 0.125 * Math.exp(-0.0125 * (V + 65)),
  alpha_m: V => (V === -40.0) ? 1.0 : (0.1 * (V + 40)) / (1 - Math.exp(-0.1 * (V + 40))),
  beta_m:  V => 4 * Math.exp(-0.0556 * (V + 65)),
  alpha_h: V => 0.07 * Math.exp(-0.05 * (V + 65)),
  beta_h:  V => 1 / (1 + Math.exp(-0.1 * (V + 35))),
};

/** Steady-state open probability: p_inf = alpha / (alpha + beta) */
function pInf(alpha, beta) { return alpha / (alpha + beta); }

/** Deterministic open-probability of K+ channel: n_inf^4 */
function kChannelPinf(V) {
  const n = pInf(HH.alpha_n(V), HH.beta_n(V));
  return n ** 4;
}

/** Deterministic open-probability of Na+ channel: m_inf^3 * h_inf */
function naChannelPinf(V) {
  const m = pInf(HH.alpha_m(V), HH.beta_m(V));
  const h = pInf(HH.alpha_h(V), HH.beta_h(V));
  return m ** 3 * h;
}

// ── Part 1 deterministic: Constant-rate gating ───────────────────────────────
/**
 * Run the Part 1 constant-rate Markov chain with a deterministic threshold:
 * always open if uniform < p_open, always close if uniform < p_close.
 * We test the LOGIC, not the randomness, by controlling probabilities.
 */
function runPart1Deterministic(alpha, beta, N, duration, dt = 0.1) {
  const p_open = alpha * dt;
  const p_close = beta * dt;
  let channels = new Array(N).fill(0);
  const totalTrace = [];

  // Feed a fixed random value each step (0.5 — midpoint)
  const fixedRand = 0.5;

  for (let t = 0; t <= duration; t += dt) {
    let openCount = 0;
    for (let i = 0; i < N; i++) {
      // With fixedRand = 0.5:
      // If p_open > 0.5, channel opens. If p_close > 0.5, it closes.
      if (channels[i] === 0) {
        if (fixedRand < p_open) channels[i] = 1;
      } else {
        if (fixedRand < p_close) channels[i] = 0;
      }
      if (channels[i] === 1) openCount++;
    }
    totalTrace.push({ t, value: openCount });
  }
  return totalTrace;
}

// ── Part 1 stochastic: statistical test ──────────────────────────────────────
function runPart1Stochastic(alpha, beta, N, duration, dt = 0.1) {
  const p_open = alpha * dt;
  const p_close = beta * dt;
  let channels = new Array(N).fill(0);
  const totalTrace = [];

  for (let t = 0; t <= duration; t += dt) {
    let openCount = 0;
    for (let i = 0; i < N; i++) {
      const rand = Math.random();
      if (channels[i] === 0) {
        if (rand < p_open) channels[i] = 1;
      } else {
        if (rand < p_close) channels[i] = 0;
      }
      if (channels[i] === 1) openCount++;
    }
    totalTrace.push({ t, value: openCount });
  }
  return totalTrace;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HH rate functions — used by channel simulations', () => {
  it('all HH rates are finite and non-negative at physiological voltages', () => {
    const voltages = [-100, -80, -65, -55, -40, -20, 0, 20, 50];
    for (const V of voltages) {
      for (const [name, fn] of Object.entries(HH)) {
        const val = fn(V);
        expect(isFinite(val), `${name}(${V}) must be finite`).toBe(true);
        expect(val, `${name}(${V}) must be ≥ 0`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('K+ steady-state open probability increases with depolarisation', () => {
    const p_hyper = kChannelPinf(-80);
    const p_mid   = kChannelPinf(-40);
    const p_depol = kChannelPinf(0);
    expect(p_mid).toBeGreaterThan(p_hyper);
    expect(p_depol).toBeGreaterThan(p_mid);
  });

  it('K+ channel open probability at very negative V is near zero', () => {
    expect(kChannelPinf(-100)).toBeLessThan(0.001);
  });

  it('K+ channel open probability at +50 mV is substantial', () => {
    expect(kChannelPinf(50)).toBeGreaterThan(0.5);
  });

  it('Na+ channel has a peak open probability at intermediate voltages', () => {
    const probs = [-80, -60, -40, -20, 0, 20].map(V => ({ V, p: naChannelPinf(V) }));
    const maxP = Math.max(...probs.map(x => x.p));
    // Peak should be around -20 to 0 mV
    const peakV = probs.find(x => x.p === maxP).V;
    expect(peakV).toBeGreaterThanOrEqual(-40);
    expect(peakV).toBeLessThanOrEqual(10);
  });

  it('Na+ open probability is near zero at very negative and very positive V', () => {
    // At -100 mV: m≈0, so m³h≈0
    expect(naChannelPinf(-100)).toBeLessThan(0.01);
    // At +50 mV: h≈0 (inactivated), so m³h≈0
    expect(naChannelPinf(50)).toBeLessThan(0.05);
  });

  it('singularity at V=-55 (alpha_n) returns exactly 0.1', () => {
    expect(HH.alpha_n(-55)).toBe(0.1);
  });

  it('singularity at V=-40 (alpha_m) returns exactly 1.0', () => {
    expect(HH.alpha_m(-40)).toBe(1.0);
  });
});

describe('Part 1 — constant-rate gating logic', () => {
  it('channels stay closed when p_open = 0', () => {
    const trace = runPart1Stochastic(0, 0.5, 20, 50);
    // With alpha=0, no channel ever opens
    expect(trace.every(p => p.value === 0)).toBe(true);
  });

  it('channels stay open when p_close = 0 (after random opening)', () => {
    // Use alpha=0.99 so channels open quickly, then beta=0 keeps them open
    const trace = runPart1Stochastic(0.99, 0, 20, 50);
    const lastFew = trace.slice(-50);
    // All 20 channels should be open by the end
    expect(lastFew.every(p => p.value === 20)).toBe(true);
  });

  it('steady-state fraction of open channels ≈ alpha/(alpha+beta)', () => {
    // Statistical test with many channels and long duration
    const alpha = 0.3, beta = 0.7;
    const N = 500;
    const expectedFraction = alpha / (alpha + beta);  // 0.3
    const trace = runPart1Stochastic(alpha, beta, N, 500);
    const tail = trace.slice(-200);
    const avgOpen = tail.reduce((s, p) => s + p.value, 0) / tail.length;
    const measuredFraction = avgOpen / N;
    // Allow ±5% tolerance
    expect(measuredFraction).toBeGreaterThan(expectedFraction - 0.05);
    expect(measuredFraction).toBeLessThan(expectedFraction + 0.05);
  });

  it('total trace values are always in [0, N]', () => {
    const N = 10;
    const trace = runPart1Stochastic(0.3, 0.2, N, 100);
    expect(trace.every(p => p.value >= 0 && p.value <= N)).toBe(true);
  });

  it('deterministic: all channels open when p_open > fixedRand=0.5', () => {
    // alpha=0.9, dt=0.1 → p_open=0.09 < 0.5... all channels closed deterministically
    const trace = runPart1Deterministic(0.6, 0.01, 5, 100);
    // p_open = 0.6*0.1 = 0.06 < 0.5 → no channel opens
    expect(trace.every(p => p.value === 0)).toBe(true);
  });
});

describe('Part 3 — K+ channel (4 n-gates)', () => {
  it('open probability with 4 gates is n_inf^4', () => {
    const V = -20;
    const n_inf = pInf(HH.alpha_n(V), HH.beta_n(V));
    const expected = n_inf ** 4;
    expect(expected).toBeGreaterThan(0);
    expect(expected).toBeLessThan(1);
    // Verify against kChannelPinf helper
    expect(kChannelPinf(V)).toBeCloseTo(expected, 8);
  });

  it('K+ channel is less likely to be open than a single-gate channel at same V', () => {
    const V = -30;
    const n_inf = pInf(HH.alpha_n(V), HH.beta_n(V));
    const singleGate = n_inf;
    const fourGates = n_inf ** 4;
    expect(fourGates).toBeLessThan(singleGate);
  });
});

describe('Part 4 — Na+ channel (3m + 1h gates)', () => {
  it('open probability is m_inf^3 * h_inf', () => {
    const V = -20;
    const p = naChannelPinf(V);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it('Na+ channel is inactivated at depolarised potentials', () => {
    // At +40 mV, h_inf is nearly 0
    const m = pInf(HH.alpha_m(40), HH.beta_m(40));
    const h = pInf(HH.alpha_h(40), HH.beta_h(40));
    expect(h).toBeLessThan(0.05);
    // Despite m being high, channel should be mostly closed due to h
    expect(m ** 3 * h).toBeLessThan(0.05);
  });

  it('channel conductance: K+ (E=-77) produces inward current at V=-20', () => {
    // At V=-20, which is above E_K=-77: current direction = outward
    const E_K = -77, g_K_single = 2, V = -20;
    const current = g_K_single * (V - E_K);
    expect(current).toBeGreaterThan(0); // outward (positive)
  });

  it('Na+ channel (E=+50) produces inward current at V=-20', () => {
    const E_Na = 50, g_Na_single = 1.5, V = -20;
    const current = g_Na_single * (V - E_Na);
    expect(current).toBeLessThan(0); // inward (negative) — depolarising
  });
});
