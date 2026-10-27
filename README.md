# NeuroEdTools

Interactive, browser-based simulators for teaching how neurons and ion channels work.

Each tool runs a model of neuronal dynamics in the browser and plots the results as you move the sliders, so students can build intuition by changing parameters and watching what happens. 

## The tools

| Tool | What it teaches |
| --- | --- |
| **Hodgkin–Huxley Model** (`hh.html`) | Action potential generation. Run it in current-clamp or voltage-clamp mode, adjust Na⁺/K⁺/leak conductances, reversal potentials and the stimulus, and view the membrane potential, gating variables, currents, steady-state curves and time constants. |
| **Stochastic Channel Simulation** (`channel.html`) | How smooth macroscopic currents emerge from random single-channel gating, in four steps: a two-state gate with constant rates, a single voltage-dependent gate, the K⁺ channel, and the Na⁺ channel. |
| **Zoo of Ion Channels** (`channelzoo.html`) | Side-by-side kinetics of K⁺, Na⁺, persistent Na⁺ (NaP) and HCN channels. |
| **FitzHugh–Nagumo Model** (`fhn.html`) | A reduced 2D neuron model, with time series and phase-plane analysis (nullclines and trajectories). |
| **Izhikevich Model** (`izhikevich.html`) | Reproducing ~20 canonical cortical firing patterns (regular spiking, bursting, chattering, fast spiking, …) from a simple two-variable model. |

All pages share a site header with navigation and a light/dark theme toggle.

## Running locally

Because the site is static, any web server works. With Node.js installed:

```bash
npm install
npm run serve
```

Then open <http://localhost:3131>.

Opening `docs/index.html` directly from disk can also work, but some browsers restrict scripts and images on `file://` URLs, so the local server is more reliable.

## Project structure

```
docs/               The website (can be published as-is, e.g. with GitHub Pages)
  index.html        Landing page linking to each tool
  *.html            One page per tool
  js/               Simulation and plotting code (one file per tool, plus header.js)
  css/              Shared styles (common.css, tools.css) and per-tool styles
  assets/images/    Model equations and channel state diagrams
tests/
  unit/             Vitest tests of the model math (no browser needed)
  e2e/              Playwright tests that drive the real pages in Chromium
```

## Tests

```bash
npm test                 # unit tests, then end-to-end tests
npm run test:unit        # Vitest only
npm run test:e2e         # Playwright only (starts its own server on port 3131)
```

First-time setup for the end-to-end tests:

```bash
npx playwright install chromium
```

- **Unit tests** check the numerical models: Hodgkin–Huxley rate functions and integration, stochastic channel gating statistics, FitzHugh–Nagumo dynamics, and Izhikevich spiking. The model functions are copied into each test file so the tests stay self-contained; keep them in sync with `docs/js/` when you change a model.
- **End-to-end tests** load each page and check its layout, that the plots render, that sliders and presets work, plus navigation and the theme toggle.

Playwright writes its HTML report to `tests/reports/playwright/`.
