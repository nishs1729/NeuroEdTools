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

            // Canvases and contexts
            const plots = {
                v: { ctx: document.getElementById('plot-v').getContext('2d'), legend: document.getElementById('legend-v') },
                gating: { ctx: document.getElementById('plot-gating').getContext('2d'), legend: document.getElementById('legend-gating') },
                conductances: { ctx: document.getElementById('plot-conductances').getContext('2d'), legend: document.getElementById('legend-conductances') },
                currents: { ctx: document.getElementById('plot-currents').getContext('2d'), legend: document.getElementById('legend-currents') },
                steadyState: { ctx: document.getElementById('plot-steady-state').getContext('2d'), legend: document.getElementById('legend-steady-state') },
                timeConstants: { ctx: document.getElementById('plot-time-constants').getContext('2d'), legend: document.getElementById('legend-time-constants') },
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
                    document.getElementById('current-clamp-controls').style.display = 'flex';
                    document.getElementById('voltage-clamp-controls').style.display = 'none';
                } else {
                    document.getElementById('current-clamp-controls').style.display = 'none';
                    document.getElementById('voltage-clamp-controls').style.display = 'block';
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
                let minCalculatedIinj = Infinity;
                let maxCalculatedIinj = -Infinity;

                for (let t = 0; t <= tSim; t += dt) {
                    const V = (t >= tStart && t <= tEnd) ? vClamp : vHold;
                    const { dV, dm, dh, dn, gNa, gK, INa, IK, IL } = hodgkinHuxley(V, m, h, n, gNaMax, gKMax, gL, ENa, EK, EL, Cm, 0);

                    m += dt * dm;
                    h += dt * dh;
                    n += dt * dn;

                    const calculated_i_inj = dV * Cm;
                    results.push({ t, V, m, h, n, gNa, gK, INa, IK, IL, i_inj: calculated_i_inj, totalCurrent: INa + IK + IL });

                    if (calculated_i_inj < minCalculatedIinj) minCalculatedIinj = calculated_i_inj;
                    if (calculated_i_inj > maxCalculatedIinj) maxCalculatedIinj = calculated_i_inj;
                }
                // Handle case where min/max are still Infinity/-Infinity (e.g., no data)
                if (minCalculatedIinj === Infinity) minCalculatedIinj = -1; // Default or sensible value
                if (maxCalculatedIinj === -Infinity) maxCalculatedIinj = 1; // Default or sensible value

                // Add a small buffer if min and max are the same
                if (minCalculatedIinj === maxCalculatedIinj) {
                    minCalculatedIinj -= 1;
                    maxCalculatedIinj += 1;
                }

                plotResults(results, tSim, minCalculatedIinj, maxCalculatedIinj);
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

            function plotResults(results, t_max, minIinjRange = null, maxIinjRange = null) {
                drawPlot(plots.v.ctx, plots.v.legend, results,
                    [{ key: 'V', color: '#007bff', label: 'V' }], 'Membrane Potential', 'Time (ms)', 'mV', t_max, 't',
                    [{ key: 'i_inj', color: '#00cc7b', label: 'I_inj' }], 'uA/cm^2', minIinjRange, maxIinjRange
                );
                drawPlot(plots.gating.ctx, plots.gating.legend, results, [
                    { key: 'm', color: 'red', label: 'm' },
                    { key: 'h', color: 'green', label: 'h' },
                    { key: 'n', color: 'blue', label: 'n' }
                ], 'Gating Variables', 'Time (ms)', 'Probability', t_max, 't');
                drawPlot(plots.conductances.ctx, plots.conductances.legend, results, [
                    { key: 'gNa', color: 'orange', label: 'g_Na' },
                    { key: 'gK', color: 'purple', label: 'g_K' }
                ], 'Conductances', 'Time (ms)', 'mS/cm^2', t_max, 't');
                drawPlot(plots.currents.ctx, plots.currents.legend, results, [
                    { key: 'INa', color: 'cyan', label: 'I_Na' },
                    { key: 'IK', color: 'magenta', label: 'I_K' },
                    { key: 'IL', color: 'brown', label: 'I_L' },
                    { key: 'totalCurrent', color: 'black', label: 'I_total' }
                ], 'Ionic Currents', 'Time (ms)', 'uA/cm^2', t_max, 't');
            }

            function drawPlot(ctx, legendEl, results, primaryPlots, title, xLabel, primaryYLabel, x_max, x_key, secondaryPlots = [], secondaryYLabel = '', minSecondaryY = null, maxSecondaryY = null, voltageLine = null) {
                const canvas = ctx.canvas;
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const paddingLeft = 60;
                const paddingRight = 55; // Increased for secondary Y-axis
                const paddingTop = 30;
                const paddingBottom = 40;

                // Calculate min/max for primary Y-axis
                const allPrimaryData = primaryPlots.flatMap(p => results.map(r => r[p.key]));
                let maxVal1 = Math.max(...allPrimaryData);
                let minVal1 = Math.min(...allPrimaryData);
                if (maxVal1 === minVal1) { maxVal1 += 1; minVal1 -= 1; }

                // Calculate min/max for secondary Y-axis
                let minVal2, maxVal2;
                if (minSecondaryY !== null && maxSecondaryY !== null) {
                    minVal2 = minSecondaryY;
                    maxVal2 = maxSecondaryY;
                } else {
                    const allSecondaryData = secondaryPlots.flatMap(p => results.map(r => r[p.key]));
                    maxVal2 = Math.max(...allSecondaryData);
                    minVal2 = Math.min(...allSecondaryData);
                    if (maxVal2 === minVal2) { maxVal2 += 1; minVal2 -= 1; }
                }

                // Draw Title
                ctx.fillStyle = '#333';
                ctx.textAlign = 'center';
                ctx.font = 'bold 16px sans-serif';
                ctx.fillText(title, canvas.width / 2, paddingTop / 2 + 5); // Adjusted Y position for title

                // Draw Axes
                ctx.beginPath();
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                // Primary Y-axis
                ctx.moveTo(paddingLeft, paddingTop);
                ctx.lineTo(paddingLeft, canvas.height - paddingBottom);
                // X-axis
                ctx.lineTo(canvas.width - paddingRight, canvas.height - paddingBottom);
                // Secondary Y-axis
                if (secondaryPlots.length > 0) {
                    ctx.moveTo(canvas.width - paddingRight, canvas.height - paddingBottom);
                    ctx.lineTo(canvas.width - paddingRight, paddingTop);
                }
                ctx.stroke();

                // Draw Labels and Ticks
                ctx.fillStyle = '#333';
                ctx.textAlign = 'center';
                ctx.font = 'bold 14px sans-serif';
                ctx.fillText(xLabel, paddingLeft + (canvas.width - paddingLeft - paddingRight) / 2, canvas.height - paddingBottom + 35);

                // Primary Y-axis label
                ctx.save();
                ctx.translate(paddingLeft / 2 - 10, paddingTop + (canvas.height - paddingTop - paddingBottom) / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(primaryYLabel, 0, 0);
                ctx.restore();

                // Secondary Y-axis label
                if (secondaryPlots.length > 0) {
                    ctx.save();
                    ctx.translate(canvas.width - paddingRight / 2 + 10, paddingTop + (canvas.height - paddingTop - paddingBottom) / 2);
                    ctx.rotate(Math.PI / 2);
                    ctx.fillText(secondaryYLabel, 0, 0);
                    ctx.restore();
                }

                ctx.font = '14px sans-serif';
                const x_min = results.length > 0 ? results[0][x_key] : 0;
                const x_range = x_max - x_min;
                const plotWidth = canvas.width - paddingLeft - paddingRight;
                const plotHeight = canvas.height - paddingTop - paddingBottom;

                // Primary Y-axis ticks
                ctx.textAlign = 'right';
                for (let i = 0; i <= 4; i++) {
                    const val = minVal1 + (maxVal1 - minVal1) * (i / 4);
                    const y = canvas.height - paddingBottom - (i / 4) * plotHeight;
                    ctx.fillText(val.toFixed(1), paddingLeft - 5, y + 5);
                    ctx.beginPath();
                    ctx.moveTo(paddingLeft, y);
                    ctx.lineTo(paddingLeft + 5, y);
                    ctx.stroke();
                }

                // Secondary Y-axis ticks
                if (secondaryPlots.length > 0) {
                    ctx.textAlign = 'left';
                    for (let i = 0; i <= 4; i++) {
                        const val = minVal2 + (maxVal2 - minVal2) * (i / 4);
                        const y = canvas.height - paddingBottom - (i / 4) * plotHeight;
                        ctx.fillText(val.toFixed(1), canvas.width - paddingRight + 5, y + 5);
                        ctx.beginPath();
                        ctx.moveTo(canvas.width - paddingRight, y);
                        ctx.lineTo(canvas.width - paddingRight - 5, y);
                        ctx.stroke();
                    }
                }

                // X-axis ticks
                ctx.textAlign = 'center';
                for (let i = 0; i <= 5; i++) {
                    const val = x_min + (x_range / 5) * i;
                    const x = paddingLeft + (i / 5) * plotWidth;
                    ctx.fillText(val.toFixed(0), x, canvas.height - paddingBottom + 15);
                    ctx.beginPath();
                    ctx.moveTo(x, canvas.height - paddingBottom);
                    ctx.lineTo(x, canvas.height - paddingBottom - 5);
                    ctx.stroke();
                }

                // Draw Primary Plots
                primaryPlots.forEach(plot => {
                    ctx.beginPath();
                    ctx.strokeStyle = plot.color;
                    ctx.lineWidth = 1.5;
                    let firstPoint = true;
                    results.forEach(point => {
                        const x = paddingLeft + ((point[x_key] - x_min) / x_range) * plotWidth;
                        const y = (canvas.height - paddingBottom) - ((point[plot.key] - minVal1) / (maxVal1 - minVal1)) * plotHeight;
                        if (firstPoint) {
                            ctx.moveTo(x, y);
                            firstPoint = false;
                        } else {
                            ctx.lineTo(x, y);
                        }
                    });
                    ctx.stroke();
                });

                // Draw Secondary Plots
                secondaryPlots.forEach(plot => {
                    ctx.beginPath();
                    ctx.strokeStyle = plot.color;
                    ctx.lineWidth = 1.5;
                    let firstPoint = true;
                    results.forEach(point => {
                        const x = paddingLeft + ((point[x_key] - x_min) / x_range) * plotWidth;
                        const y = (canvas.height - paddingBottom) - ((point[plot.key] - minVal2) / (maxVal2 - minVal2)) * plotHeight;
                        if (firstPoint) {
                            ctx.moveTo(x, y);
                            firstPoint = false;
                        } else {
                            ctx.lineTo(x, y);
                        }
                    });
                    ctx.stroke();
                });

                // Draw Legend
                legendEl.innerHTML = [...primaryPlots, ...secondaryPlots].map(p => `
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: ${p.color}"></div>
                        <span>${p.label}</span>
                    </div>
                `).join('');

                // Draw vertical line for clamp voltage
                if (voltageLine !== null && x_key === 'v') {
                    const x = paddingLeft + ((voltageLine - x_min) / x_range) * plotWidth;
                    if (x >= paddingLeft && x <= canvas.width - paddingRight) {
                        ctx.beginPath();
                        ctx.strokeStyle = '#333';
                        ctx.lineWidth = 1;
                        ctx.setLineDash([2, 2]);
                        ctx.moveTo(x, paddingTop);
                        ctx.lineTo(x, canvas.height - paddingBottom);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }
                }
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

                drawPlot(plots.steadyState.ctx, plots.steadyState.legend, steadyStateResults, [
                    { key: 'm', color: 'red', label: 'm_&infin;' },
                    { key: 'h', color: 'green', label: 'h_&infin;' },
                    { key: 'n', color: 'blue', label: 'n_&infin;' }
                ], 'Steady-State Gating Vars', 'Voltage (mV)', 'Probability', v_max, 'v', [], '', null, null, voltageLine);

                drawPlot(plots.timeConstants.ctx, plots.timeConstants.legend, timeConstantResults, [
                    { key: 'm', color: 'red', label: '&tau;_m' },
                    { key: 'h', color: 'green', label: '&tau;_h' },
                    { key: 'n', color: 'blue', label: '&tau;_n' }
                ], 'Gating Time Constants', 'Voltage (mV)', 'Time (ms)', v_max, 'v', [], '', null, null, voltageLine);
            }

            // Initial run
            switchMode();
            updateSteadyStatePlots();
        });