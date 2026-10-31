document.addEventListener('DOMContentLoaded', () => {
            // Sliders and controls
            const sliders = {
                gNa: document.getElementById('gNa'),
                gK: document.getElementById('gK'),
                gL: document.getElementById('gL'),
                iInj: document.getElementById('i_inj'),
                vClamp: document.getElementById('v_clamp'),
                vHold: document.getElementById('v_hold'),
                tSim: document.getElementById('t_sim'),
                tStart: document.getElementById('t_start'),
                tEnd: document.getElementById('t_end'),
                eNa: document.getElementById('eNa'),
                eK: document.getElementById('eK'),
                eL: document.getElementById('eL'),
            };
            const modeCurrentRadio = document.getElementById('mode-current');
            const modeVoltageRadio = document.getElementById('mode-voltage');

            // Value displays
            const values = {
                gNa: document.getElementById('gNa-value'),
                gK: document.getElementById('gK-value'),
                gL: document.getElementById('gL-value'),
                iInj: document.getElementById('i_inj-value'),
                vClamp: document.getElementById('v_clamp-value'),
                vHold: document.getElementById('v_hold-value'),
                tSim: document.getElementById('t_sim-value'),
                tStart: document.getElementById('t_start-value'),
                tEnd: document.getElementById('t_end-value'),
                eNa: document.getElementById('eNa-value'),
                eK: document.getElementById('eK-value'),
                eL: document.getElementById('eL-value'),
            };

            // Canvases and their HTML legends
            const plots = {
                v: { canvas: document.getElementById('plot-v'), legend: document.getElementById('legend-v') },
                gating: { canvas: document.getElementById('plot-gating'), legend: document.getElementById('legend-gating') },
                conductances: { canvas: document.getElementById('plot-conductances'), legend: document.getElementById('legend-conductances') },
                currents: { canvas: document.getElementById('plot-currents'), legend: document.getElementById('legend-currents') },
                steadyState: { canvas: document.getElementById('plot-steady-state'), legend: document.getElementById('legend-steady-state') },
                timeConstants: { canvas: document.getElementById('plot-time-constants'), legend: document.getElementById('legend-time-constants') },
            };

            function updateSteadyStatePlots() {
                const showLine = modeVoltageRadio.checked;
                const vClampValue = showLine ? parseFloat(sliders.vClamp.value) : null;
                calculateAndDrawSteadyStatePlots(vClampValue);
            }

            // Add event listeners to all sliders
            for (const key in sliders) {
                sliders[key].addEventListener('input', () => {
                    values[key].textContent = sliders[key].value;
                    if (key === 'tSim') {
                        const simTime = sliders.tSim.value;
                        sliders.tStart.max = simTime;
                        sliders.tEnd.max = simTime;
                        if (parseFloat(sliders.tStart.value) > simTime) {
                            sliders.tStart.value = simTime;
                            values.tStart.textContent = simTime;
                        }
                        if (parseFloat(sliders.tEnd.value) > simTime) {
                            sliders.tEnd.value = simTime;
                            values.tEnd.textContent = simTime;
                        }
                    }
                    runSimulation();
                    if (key === 'vClamp') {
                        updateSteadyStatePlots();
                    }
                });
            }

            modeCurrentRadio.addEventListener('change', switchMode);
            modeVoltageRadio.addEventListener('change', switchMode);

            function switchMode() {
                if (modeCurrentRadio.checked) {
                    document.getElementById('current-clamp-controls').style.display = '';
                    document.getElementById('voltage-clamp-controls').style.display = 'none';
                } else {
                    document.getElementById('current-clamp-controls').style.display = 'none';
                    document.getElementById('voltage-clamp-controls').style.display = '';
                }
                runSimulation();
                updateSteadyStatePlots();
            }

            function runSimulation() {
                if (modeCurrentRadio.checked) {
                    runCurrentClamp();
                } else {
                    runVoltageClamp();
                }
            }

            function runCurrentClamp() {
                const gNaMax = parseFloat(sliders.gNa.value);
                const gKMax = parseFloat(sliders.gK.value);
                const gL = parseFloat(sliders.gL.value);
                const i_inj_val = parseFloat(sliders.iInj.value);
                const tSim = parseFloat(sliders.tSim.value);
                const tStart = parseFloat(sliders.tStart.value);
                const tEnd = parseFloat(sliders.tEnd.value);

                const minIinjRange = parseFloat(sliders.iInj.min);
                const maxIinjRange = parseFloat(sliders.iInj.max);

                const Cm = 1.0;
                const ENa = parseFloat(sliders.eNa.value);
                const EK = parseFloat(sliders.eK.value);
                const EL = parseFloat(sliders.eL.value);

                let V = -65.0, m = 0.05, h = 0.6, n = 0.32;

                const dt = 0.01;
                const results = [];

                for (let t = 0; t <= tSim; t += dt) {
                    const i_inj = (t >= tStart && t <= tEnd) ? i_inj_val : 0.0;
                    const { dV, dm, dh, dn, gNa, gK, INa, IK, IL } = hodgkinHuxley(V, m, h, n, gNaMax, gKMax, gL, ENa, EK, EL, Cm, i_inj);

                    V += dt * dV;
                    m += dt * dm;
                    h += dt * dh;
                    n += dt * dn;

                    results.push({ t, V, m, h, n, gNa, gK, INa, IK, IL, i_inj, totalCurrent: INa + IK + IL });
                }
                plotResults(results, tSim, minIinjRange, maxIinjRange);
            }

            function runVoltageClamp() {
                const gNaMax = parseFloat(sliders.gNa.value);
                const gKMax = parseFloat(sliders.gK.value);
                const gL = parseFloat(sliders.gL.value);
                const vClamp = parseFloat(sliders.vClamp.value);
                const vHold = parseFloat(sliders.vHold.value);
                const tSim = parseFloat(sliders.tSim.value);
                const tStart = parseFloat(sliders.tStart.value);
                const tEnd = parseFloat(sliders.tEnd.value);

                const Cm = 1.0;
                const ENa = parseFloat(sliders.eNa.value);
                const EK = parseFloat(sliders.eK.value);
                const EL = parseFloat(sliders.eL.value);

                let m = 0.05, h = 0.6, n = 0.32;

                const dt = 0.01;
                const results = [];

                for (let t = 0; t <= tSim; t += dt) {
                    const V = (t >= tStart && t <= tEnd) ? vClamp : vHold;
                    const { dV, dm, dh, dn, gNa, gK, INa, IK, IL } = hodgkinHuxley(V, m, h, n, gNaMax, gKMax, gL, ENa, EK, EL, Cm, 0);

                    m += dt * dm;
                    h += dt * dh;
                    n += dt * dn;

                    const calculated_i_inj = dV * Cm;
                    results.push({ t, V, m, h, n, gNa, gK, INa, IK, IL, i_inj: calculated_i_inj, totalCurrent: INa + IK + IL });
                }
                plotResults(results, tSim);
            }

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

                const gNa = gNaMax * m**3 * h;
                const gK = gKMax * n**4;

                const INa = gNa * (V - ENa);
                const IK = gK * (V - EK);
                const IL = gL * (V - EL);

                const dV = (i_inj - (INa + IK + IL));
                const dn = alpha_n * (1 - n) - beta_n * n;
                const dm = alpha_m * (1 - m) - beta_m * m;
                const dh = alpha_h * (1 - h) - beta_h * h;

                return { dV: dV / Cm, dm, dh, dn, gNa, gK, INa, IK, IL };
            }

            function plotResults(results, t_max, minIinjRange, maxIinjRange) {
                const t = results.map(r => r.t);
                const col = key => results.map(r => r[key]);
                const x = { min: 0, max: t_max };

                NeuroPlot.render(plots.v.canvas, {
                    title: 'Membrane Potential', xLabel: 'Time (ms)', yLabel: 'V (mV)', y2Label: 'I_{inj} (µA/cm²)',
                    x, y2: { min: minIinjRange, max: maxIinjRange }, legend: plots.v.legend,
                    series: [
                        { x: t, y: col('V'), color: '--v-color', label: 'V' },
                        { x: t, y: col('i_inj'), color: '--iinj-color', label: 'I_{inj}', axis: 'y2', width: 1.25 },
                    ],
                });
                NeuroPlot.render(plots.gating.canvas, {
                    title: 'Gating Variables', xLabel: 'Time (ms)', yLabel: 'Probability',
                    x, y: { min: 0, max: 1 }, legend: plots.gating.legend,
                    series: [
                        { x: t, y: col('m'), color: '--m-color', label: 'm' },
                        { x: t, y: col('h'), color: '--h-color', label: 'h' },
                        { x: t, y: col('n'), color: '--n-color', label: 'n' },
                    ],
                });
                NeuroPlot.render(plots.conductances.canvas, {
                    title: 'Conductances', xLabel: 'Time (ms)', yLabel: 'g (mS/cm²)',
                    x, y: { min: 0 }, legend: plots.conductances.legend,
                    series: [
                        { x: t, y: col('gNa'), color: '--na-color', label: 'g_{Na}' },
                        { x: t, y: col('gK'), color: '--k-color', label: 'g_{K}' },
                    ],
                });
                NeuroPlot.render(plots.currents.canvas, {
                    title: 'Ionic Currents', xLabel: 'Time (ms)', yLabel: 'I (µA/cm²)',
                    x, legend: plots.currents.legend,
                    series: [
                        { x: t, y: col('INa'), color: '--na-color', label: 'I_{Na}' },
                        { x: t, y: col('IK'), color: '--k-color', label: 'I_{K}' },
                        { x: t, y: col('IL'), color: '--leak-color', label: 'I_{L}' },
                        { x: t, y: col('totalCurrent'), color: '--total-color', label: 'I_{total}', dash: [5, 3] },
                    ],
                });
            }

            function calculateAndDrawSteadyStatePlots(voltageLine = null) {
                const steadyStateResults = [];
                const timeConstantResults = [];
                const v_min = -100, v_max = 50, dv = 0.5;

                for (let v = v_min; v <= v_max; v += dv) {
                    const { alpha_n, beta_n, alpha_m, beta_m, alpha_h, beta_h } = getAlphaBeta(v);

                    const m_inf = alpha_m / (alpha_m + beta_m);
                    const h_inf = alpha_h / (alpha_h + beta_h);
                    const n_inf = alpha_n / (alpha_n + beta_n);

                    const tau_m = 1 / (alpha_m + beta_m);
                    const tau_h = 1 / (alpha_h + beta_h);
                    const tau_n = 1 / (alpha_n + beta_n);

                    steadyStateResults.push({ v, m: m_inf, h: h_inf, n: n_inf });
                    timeConstantResults.push({ v, m: tau_m, h: tau_h, n: tau_n });
                }

                const v = steadyStateResults.map(r => r.v);
                const gates = (rows, prefix, suffix) => ['m', 'h', 'n'].map(g => ({
                    x: v, y: rows.map(r => r[g]), color: `--${g}-color`, label: prefix + g + suffix,
                }));
                const x = { min: v_min, max: v_max };
                const vlines = [{ x: voltageLine }];

                NeuroPlot.render(plots.steadyState.canvas, {
                    title: 'Steady-State Gating', xLabel: 'Voltage (mV)', yLabel: 'Probability',
                    x, y: { min: 0, max: 1 }, vlines, legend: plots.steadyState.legend,
                    series: gates(steadyStateResults, '', '_∞'),
                });
                NeuroPlot.render(plots.timeConstants.canvas, {
                    title: 'Gating Time Constants', xLabel: 'Voltage (mV)', yLabel: 'τ (ms)',
                    x, y: { min: 0 }, vlines, legend: plots.timeConstants.legend,
                    series: gates(timeConstantResults, 'τ_', ''),
                });
            }

            // Initial run
            switchMode();
            updateSteadyStatePlots();
        });