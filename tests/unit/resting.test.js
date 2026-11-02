/**
 * unit/resting.test.js
 *
 * Tests for the resting-potential math (Nernst potential, GHK unidirectional fluxes,
 * charge needed to polarise the membrane). Functions are replicated here exactly as
 * implemented in docs/js/resting.js so tests are self-contained.
 */

import { describe, it, expect } from 'vitest';

// ── Exact copies of resting.js functions ─────────────────────────────────────

const R = 8.314;
const F = 96485;
const CM = 1e-2;
const CELL_RADIUS = 10e-6;

function thermalVoltage(tempC) {
  return R * (tempC + 273.15) / F * 1000;
}

function nernst(z, cin, cout, tempC) {
  return thermalVoltage(tempC) / z * Math.log(cout / cin);
}

function ghkFactor(u) {
  if (Math.abs(u) < 1e-6) return 1 + u / 2;
  return u / (1 - Math.exp(-u));
}

function relativeFluxes(z, cin, cout, V, tempC) {
  const vT = thermalVoltage(tempC);
  const u = z * V / vT;
  const uEq = Math.log(cout / cin);
  const norm = cin * ghkFactor(uEq);
  return {
    out: cin * ghkFactor(u) / norm,
    in: cout * ghkFactor(-u) / norm,
  };
}

function concentrationMoved(z, V) {
  return CM * Math.abs(V) / 1000 / (Math.abs(z) * F) * 3 / CELL_RADIUS;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Resting — Nernst potential', () => {
  it('RT/F is about 26.7 mV at 37 °C', () => {
    expect(thermalVoltage(37)).toBeCloseTo(26.73, 1);
  });

  it('E_K ≈ −89 mV for 140 mM in / 5 mM out at 37 °C', () => {
    expect(nernst(1, 140, 5, 37)).toBeCloseTo(-89.1, 0);
  });

  it('E_Na ≈ +67 mV for 12 mM in / 145 mM out', () => {
    expect(nernst(1, 12, 145, 37)).toBeCloseTo(66.6, 0);
  });

  it('E_Cl is negative when Cl⁻ is higher outside (anion)', () => {
    expect(nernst(-1, 10, 110, 37)).toBeCloseTo(-64.1, 0);
  });

  it('divalent Ca²⁺ halves the slope', () => {
    const e1 = nernst(1, 0.0001, 2, 37);
    const e2 = nernst(2, 0.0001, 2, 37);
    expect(e2).toBeCloseTo(e1 / 2, 6);
    expect(e2).toBeGreaterThan(120);
  });

  it('is 0 mV when concentrations are equal', () => {
    expect(nernst(1, 50, 50, 37)).toBe(0);
  });

  it('flips sign when concentrations are swapped', () => {
    expect(nernst(1, 5, 140, 37)).toBeCloseTo(-nernst(1, 140, 5, 37), 9);
  });

  it('grows in magnitude with temperature', () => {
    expect(Math.abs(nernst(1, 140, 5, 37))).toBeGreaterThan(Math.abs(nernst(1, 140, 5, 6)));
  });
});

describe('Resting — GHK unidirectional fluxes', () => {
  const cases = [
    { name: 'K', z: 1, cin: 140, cout: 5 },
    { name: 'Na', z: 1, cin: 12, cout: 145 },
    { name: 'Cl', z: -1, cin: 10, cout: 110 },
    { name: 'Ca', z: 2, cin: 0.0001, cout: 2 },
  ];

  cases.forEach(({ name, z, cin, cout }) => {
    it(`${name}: outward and inward fluxes are both 1 at the Nernst potential`, () => {
      const E = nernst(z, cin, cout, 37);
      const f = relativeFluxes(z, cin, cout, E, 37);
      expect(f.out).toBeCloseTo(1, 6);
      expect(f.in).toBeCloseTo(1, 6);
    });
  });

  it('K: at 0 mV the outward flux dominates', () => {
    const f = relativeFluxes(1, 140, 5, 0, 37);
    expect(f.out / f.in).toBeCloseTo(28, 6);
  });

  it('K: below E_K the net flux is inward, above it outward', () => {
    const E = nernst(1, 140, 5, 37);
    const below = relativeFluxes(1, 140, 5, E - 20, 37);
    const above = relativeFluxes(1, 140, 5, E + 20, 37);
    expect(below.in).toBeGreaterThan(below.out);
    expect(above.out).toBeGreaterThan(above.in);
  });

  it('Cl: making the inside more negative pushes Cl⁻ out', () => {
    const E = nernst(-1, 10, 110, 37);
    const f = relativeFluxes(-1, 10, 110, E - 20, 37);
    expect(f.out).toBeGreaterThan(f.in);
  });

  it('fluxes stay finite at extreme voltages', () => {
    const f = relativeFluxes(2, 0.0001, 2, 0, 37);
    expect(Number.isFinite(f.out)).toBe(true);
    expect(Number.isFinite(f.in)).toBe(true);
  });
});

describe('Resting — ions moved to charge the membrane', () => {
  it('about 2.8 µM of K⁺ for −89 mV in a 10 µm cell', () => {
    expect(concentrationMoved(1, -89)).toBeCloseTo(2.77e-3, 4);
  });

  it('is a tiny fraction (< 0.01%) of 140 mM K⁺', () => {
    expect(concentrationMoved(1, -89) / 140).toBeLessThan(1e-4);
  });

  it('halves for a divalent ion', () => {
    expect(concentrationMoved(2, 60)).toBeCloseTo(concentrationMoved(1, 60) / 2, 12);
  });
});
