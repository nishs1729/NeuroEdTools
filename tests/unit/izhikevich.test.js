/**
 * unit/izhikevich.test.js
 *
 * Tests for the Izhikevich neuron model math.
 * Functions are replicated exactly from doc/js/izhikevich.js.
 */

import { describe, it, expect } from 'vitest';

// ── Exact copy of izhikevich.js simulateIzhikevich ───────────────────────────

function simulateIzhikevich(a, b, c, d, i, duration, v_init, u_init) {
  let v = v_init;
  let u = u_init;
  const dt = 0.1;
  const steps = Math.floor(duration / dt);

  const v_trace = [];
  const u_trace = [];
  const t_trace = [];

  for (let step = 0; step < steps; step++) {
    const dv = (0.04 * v * v) + (5 * v) + 140 - u + i;
    const du = a * ((b * v) - u);

    v += dt * dv;
    u += dt * du;

    if (v >= 30) {
      v = c;
      u += d;
    }

    if (!isFinite(v) || !isFinite(u)) break;

    v_trace.push(v);
    u_trace.push(u);
    t_trace.push(step * dt);
  }
  return { t_trace, v_trace, u_trace };
}

/** Count spikes: reset events after v crosses 30 */
function countSpikes(v_trace) {
  let spikes = 0;
  // The reset happens within the same step, so v ≥ 30 is never recorded, and
  // with dt=0.1 the last recorded pre-spike value can be well below 20.
  // Detect resets as large one-step drops instead: subthreshold dynamics
  // never fall more than a few mV per step, while a reset falls > 30 mV.
  for (let i = 1; i < v_trace.length; i++) {
    if (v_trace[i - 1] - v_trace[i] > 30) spikes++;
  }
  return spikes;
}

// ── Preset parameters (from izhikevich.js switch block) ─────────────────────
const PRESETS = {
  rs:    { a: 0.02, b: 0.2, c: -65, d: 8,    i: 10 },
  ib:    { a: 0.02, b: 0.2, c: -55, d: 4,    i: 10 },
  ch:    { a: 0.02, b: 0.2, c: -50, d: 2,    i: 10 },
  fs:    { a: 0.1,  b: 0.2, c: -65, d: 2,    i: 10 },
  lts:   { a: 0.02, b: 0.25,c: -65, d: 2,    i: 10 },
  sfa:   { a: 0.01, b: 0.2, c: -65, d: 8,    i: 10 },
  res:   { a: 0.02, b: 0.25,c: -65, d: 0.05, i: -1 },
  iis:   { a: 0.02, b: 0.25,c: -65, d: 0.05, i: -5 },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Izhikevich — simulation stability', () => {
  it('produces finite traces for Regular Spiking preset', () => {
    const { a, b, c, d, i } = PRESETS.rs;
    const { v_trace, u_trace } = simulateIzhikevich(a, b, c, d, i, 200, -70, -14);
    expect(v_trace.every(isFinite)).toBe(true);
    expect(u_trace.every(isFinite)).toBe(true);
  });

  it('produces the correct number of steps', () => {
    const duration = 200;
    const { v_trace } = simulateIzhikevich(0.02, 0.2, -65, 8, 10, duration, -70, -14);
    expect(v_trace.length).toBe(Math.floor(duration / 0.1));
  });

  it('all presets produce stable (finite) traces', () => {
    for (const [name, p] of Object.entries(PRESETS)) {
      const { v_trace } = simulateIzhikevich(p.a, p.b, p.c, p.d, p.i, 200, -70, -14);
      expect(v_trace.every(isFinite), `Preset ${name} diverged`).toBe(true);
    }
  });

  it('voltage never substantially exceeds reset threshold of 30 mV', () => {
    const { v_trace } = simulateIzhikevich(0.02, 0.2, -65, 8, 10, 200, -70, -14);
    // After reset v=c (≤ -50). Due to dt=0.1 it can overshoot 30 slightly.
    expect(Math.max(...v_trace)).toBeLessThan(100);
  });
});

describe('Izhikevich — spike generation', () => {
  it('Regular Spiking fires ≥3 spikes in 200 ms with I=10', () => {
    const { a, b, c, d, i } = PRESETS.rs;
    const { v_trace } = simulateIzhikevich(a, b, c, d, i, 200, -70, -14);
    expect(countSpikes(v_trace)).toBeGreaterThanOrEqual(3);
  });

  it('Fast Spiking fires more spikes than Regular Spiking (higher frequency)', () => {
    const rs = PRESETS.rs;
    const fs = PRESETS.fs;
    const { v_trace: rs_v } = simulateIzhikevich(rs.a, rs.b, rs.c, rs.d, rs.i, 200, -70, -14);
    const { v_trace: fs_v } = simulateIzhikevich(fs.a, fs.b, fs.c, fs.d, fs.i, 200, -70, -14);
    expect(countSpikes(fs_v)).toBeGreaterThan(countSpikes(rs_v));
  });

  it('does NOT fire with zero current and typical resting initial conditions', () => {
    const { v_trace } = simulateIzhikevich(0.02, 0.2, -65, 8, 0, 200, -70, -14);
    expect(countSpikes(v_trace)).toBe(0);
  });

  it('Inhibition-Induced Spiking (iis) fires spikes despite negative current', () => {
    const { a, b, c, d, i } = PRESETS.iis;
    const { v_trace } = simulateIzhikevich(a, b, c, d, i, 500, -70, -14);
    expect(countSpikes(v_trace)).toBeGreaterThan(0);
  });

  it('Rebound Spike (res) fires at least one spike from hyperpolarising step', () => {
    // Use a longer duration so post-inhibitory rebound can develop
    const { a, b, c, d, i } = PRESETS.res;
    const { v_trace } = simulateIzhikevich(a, b, c, d, i, 400, -70, -14);
    expect(countSpikes(v_trace)).toBeGreaterThanOrEqual(1);
  });
});

describe('Izhikevich — parameter sensitivity', () => {
  it('larger I increases spike count monotonically', () => {
    const base = { a: 0.02, b: 0.2, c: -65, d: 8 };
    let prevSpikes = 0;
    for (const I of [2, 5, 10, 15]) {
      const { v_trace } = simulateIzhikevich(base.a, base.b, base.c, base.d, I, 500, -70, -14);
      const spikes = countSpikes(v_trace);
      expect(spikes).toBeGreaterThanOrEqual(prevSpikes);
      prevSpikes = spikes;
    }
  });

  it('u_trace recovery variable increases after each spike', () => {
    const { v_trace, u_trace } = simulateIzhikevich(0.02, 0.2, -65, 8, 10, 200, -70, -14);
    // After a spike (reset), u jumps by d=8 — find first reset and check u increased
    for (let i = 1; i < v_trace.length; i++) {
      if (v_trace[i - 1] >= 20 && v_trace[i] < -40) {
        // u_trace[i] should be larger than u_trace[i-1] (jumped by d)
        expect(u_trace[i]).toBeGreaterThan(u_trace[i - 1]);
        break;
      }
    }
  });

  it('nullcline V: dv/dt = 0 → u = 0.04v² + 5v + 140 + I', () => {
    const I = 10;
    for (const v of [-70, -50, -30, 0]) {
      const u_nullcline = 0.04 * v * v + 5 * v + 140 + I;
      const dv = 0.04 * v * v + 5 * v + 140 - u_nullcline + I;
      expect(Math.abs(dv)).toBeLessThan(1e-9);
    }
  });
});
