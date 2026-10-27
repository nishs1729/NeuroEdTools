document.addEventListener('DOMContentLoaded', () => {
    // --- General Helper Functions (Copied from potassium.js) ---
    function getCssVariable(variable) {
        return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    }

    function drawAxis(ctx, padding, plotWidth, plotHeight, title, xLabel, yLabel) {
        const canvas = ctx.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = getCssVariable('--text-color');
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(title, padding.left + plotWidth / 2, padding.top - 10);
        ctx.font = '14px sans-serif';
        ctx.fillText(xLabel, padding.left + plotWidth / 2, padding.top + plotHeight + 35);

        ctx.save();
        ctx.translate(padding.left - 50, padding.top + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();

        ctx.beginPath();
        ctx.strokeStyle = getCssVariable('--text-color');
        ctx.lineWidth = 1;
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + plotHeight);
        ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight);
        ctx.stroke();
    }

    function drawXAxisTicks(ctx, duration, padding, plotWidth, plotHeight) {
        ctx.textAlign = 'center';
        ctx.fillStyle = getCssVariable('--text-color');
        for (let i = 0; i <= 5; i++) {
            const val = (duration / 5) * i;
            const x = padding.left + (i / 5) * plotWidth;
            ctx.fillText(val.toFixed(0), x, padding.top + plotHeight + 20);
        }
    }
    
    function drawIndividualChannelsPlot(ctx, traces, duration, N, title) {
        const canvas = ctx.canvas;
        const padding = { top: 40, right: 20, bottom: 40, left: 70 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;

        drawAxis(ctx, padding, plotWidth, plotHeight, title, 'Time (ms)', 'Channel #');
        drawXAxisTicks(ctx, duration, padding, plotWidth, plotHeight);

        ctx.strokeStyle = getCssVariable('--accent-color');
        ctx.lineWidth = 2;
        traces.forEach((trace, i) => {
            const y = padding.top + (plotHeight * (i + 0.5)) / N;
            trace.forEach(point => {
                if (point.state === 1) {
                    const x = padding.left + (point.t / duration) * plotWidth;
                    ctx.beginPath();
                    ctx.moveTo(x, y - 2);
                    ctx.lineTo(x, y + 2);
                    ctx.stroke();
                }
            });
        });

        ctx.textAlign = 'right';
        ctx.fillStyle = getCssVariable('--text-color');
        for (let i = 0; i < N; i++) {
            if (N <= 20 || (i + 1) % 10 === 0 || N < 10) {
                const y = padding.top + (plotHeight * (i + 0.5)) / N;
                ctx.fillText(i + 1, padding.left - 8, y + 4);
            }
        }
    }

    function drawTotalTracePlot(ctx, traces, duration, title, yLabel) {
        const canvas = ctx.canvas;
        const padding = { top: 40, right: 20, bottom: 40, left: 70 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;
        
        // Flatten all values from all traces to determine min/max for scaling
        let allValues = [];
        traces.forEach(t => allValues = allValues.concat(t.trace.map(p => p.value)));

        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas at the beginning

        if (allValues.length === 0) {
            // If no data, just clear and return
            return;
        }

        let minVal = Math.min(...allValues);
        let maxVal = Math.max(...allValues);
        if (minVal === maxVal) {
            minVal -= 1;
            maxVal += 1;
        }

        drawAxis(ctx, padding, plotWidth, plotHeight, title, 'Time (ms)', yLabel);
        drawXAxisTicks(ctx, duration, padding, plotWidth, plotHeight);

        traces.forEach(t_obj => {
            const trace = t_obj.trace;
            const color = t_obj.color;
            ctx.beginPath();
            ctx.strokeStyle = getCssVariable(color);
            ctx.lineWidth = 1.5;
            trace.forEach((point, i) => {
                const x = padding.left + (point.t / duration) * plotWidth;
                const y_val = (point.value - minVal) / (maxVal - minVal || 1);
                const y = padding.top + plotHeight - y_val * plotHeight;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });

        ctx.textAlign = 'right';
        ctx.fillStyle = getCssVariable('--text-color');
        for (let i = 0; i <= 4; i++) {
            const val = minVal + (maxVal - minVal) * (i / 4);
            const y = padding.top + plotHeight - (i / 4) * plotHeight;
            ctx.fillText(val.toFixed(yLabel.includes('(pA)') ? 1 : 0), padding.left - 8, y + 4);
        }
    }
    
    function drawAlphaBetaPlot(ctx, alphaFn, betaFn, color1, color2, label1, label2, rateMax, currentV = null) {
        const canvas = ctx.canvas;
        const padding = { top: 20, right: 15, bottom: 40, left: 45 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;

        const vMin = -100, vMax = 100;
        const rateMin = 0;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = getCssVariable('--text-color');
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('Voltage (mV)', padding.left + plotWidth / 2, padding.top + plotHeight + 30);
        
        ctx.save();
        ctx.translate(padding.left - 35, padding.top + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Rate', 0, 0);
        ctx.restore();

        ctx.beginPath();
        ctx.strokeStyle = getCssVariable('--text-color');
        ctx.lineWidth = 1;
        ctx.moveTo(padding.left, padding.top + plotHeight);
        ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight);
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + plotHeight);
        ctx.stroke();

        const alphaPoints = [];
        const betaPoints = [];
        for (let v = vMin; v <= vMax; v += 2) {
            alphaPoints.push({v, rate: alphaFn(v)});
            betaPoints.push({v, rate: betaFn(v)});
        }

        function plotCurve(points, color) {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            points.forEach((p, i) => {
                const x = padding.left + ((p.v - vMin) / (vMax - vMin)) * plotWidth;
                const y = padding.top + plotHeight - ((p.rate - rateMin) / (rateMax - rateMin)) * plotHeight;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }

        plotCurve(alphaPoints, getCssVariable(color1));
        plotCurve(betaPoints, getCssVariable(color2));

        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = getCssVariable(color1);
        ctx.fillText(label1, padding.left + plotWidth - 10, padding.top + 10);
        ctx.fillStyle = getCssVariable(color2);
        ctx.fillText(label2, padding.left + plotWidth - 10, padding.top + 25);
        
        ctx.textAlign = 'right';
        ctx.fillStyle = getCssVariable('--text-color');
        ctx.font = '10px sans-serif';
        for (let i = 0; i <= 2; i++) {
            const val = rateMin + (rateMax - rateMin) * (i / 2);
            const y = padding.top + plotHeight - (i / 2) * plotHeight;
            ctx.fillText(val.toFixed(2), padding.left - 5, y + 3);
        }

        ctx.textAlign = 'center';
        for (let i = 0; i <= 4; i++) {
            const val = vMin + (vMax - vMin) * (i / 4);
            const x = padding.left + (plotWidth * i / 4);
            ctx.fillText(val.toFixed(0), x, padding.top + plotHeight + 15);
        }

        if (currentV !== null) {
            const x = padding.left + ((currentV - vMin) / (vMax - vMin)) * plotWidth;
            ctx.beginPath();
            ctx.strokeStyle = getCssVariable('--text-color');
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + plotHeight);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    
    // --- Hodgkin-Huxley Rate Functions (Updated from jnk/pot.md) ---
    const HH = {
        alpha_n: V => {
            if (Math.abs(V + 55) < 1e-6) return 0.1;
            return (0.01 * (V + 55)) / (1 - Math.exp(-(V + 55) / 10));
        },
        beta_n: V => 0.125 * Math.exp(-(V + 65) / 80),
        alpha_m: V => (V === -40.0) ? 1.0 : (0.1 * (V + 40)) / (1 - Math.exp(-0.1 * (V + 40))),
        beta_m: V => 4 * Math.exp(-0.0556 * (V + 65)),
        alpha_h: V => 0.07 * Math.exp(-0.05 * (V + 65)),
        beta_h: V => 1 / (1 + Math.exp(-0.1 * (V + 35)))
    };

    // --- RK4 Solver ---
    function rk4(f, y0, t0, dt, V) {
        const k1 = dt * f(t0, y0, V);
        const k2 = dt * f(t0 + dt / 2, y0 + k1 / 2, V);
        const k3 = dt * f(t0 + dt / 2, y0 + k2 / 2, V);
        const k4 = dt * f(t0 + dt, y0 + k3, V);
        return y0 + (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    }

    // --- Sodium Channel Simulation ---
    const sim_sodium = {
        sliders: {
            voltage: document.getElementById('voltage_na'),
            numChannels: document.getElementById('num_channels_na'),
            duration: document.getElementById('duration_na'),
        },
        values: {
            voltage: document.getElementById('voltage_na-value'),
            numChannels: document.getElementById('num_channels_na-value'),
            duration: document.getElementById('duration_na-value'),
        },
        individualCtx: document.getElementById('individual-plot-na').getContext('2d'),
        openChannelsCtx: document.getElementById('open-channels-plot-na').getContext('2d'),
        totalCtx: document.getElementById('total-plot-na').getContext('2d'),
        abPlotCtx_m: document.getElementById('ab_plot_na_m').getContext('2d'),
        abPlotCtx_h: document.getElementById('ab_plot_na_h').getContext('2d'),
        E_Na: 50.0, // Sodium reversal potential (mV)
        g_Na_max: 120, // Maximum sodium conductance (mS/cm^2)
        g_Na_single: 1.2, // Single channel conductance (pS), scaled for N=100 to match g_Na_max

        init() {
            const container = document.getElementById('sodium-container');
            if (container && container.style.display !== 'none') {
                this.setup();
            }
        },
        setup() {
            for (const key in this.sliders) {
                this.sliders[key].addEventListener('input', () => {
                    this.updateSliderValues();
                    this.runSimulation();
                });
            }
            this.updateSliderValues();
            this.runSimulation();
        },
        updateSliderValues() {
            for (const key in this.sliders) { this.values[key].textContent = this.sliders[key].value; }
            const V = parseFloat(this.sliders.voltage.value);
            drawAlphaBetaPlot(this.abPlotCtx_m, HH.alpha_m, HH.beta_m, '--alpha-m-color', '--beta-m-color', 'αm', 'βm', 5, V);
            drawAlphaBetaPlot(this.abPlotCtx_h, HH.alpha_h, HH.beta_h, '--alpha-h-color', '--beta-h-color', 'αh', 'βh', 1, V);
        },
        runSimulation() {
            const N = parseInt(this.sliders.numChannels.value);
            const V = parseFloat(this.sliders.voltage.value);
            const duration = parseFloat(this.sliders.duration.value);
            const dt = 0.1;

            // Stochastic Simulation
            const p_m_open = HH.alpha_m(V) * dt;
            const p_m_close = HH.beta_m(V) * dt;
            const p_h_open = HH.alpha_h(V) * dt;
            const p_h_close = HH.beta_h(V) * dt;

            let channels = Array.from({ length: N }, () => ({ m: [0, 0, 0], h: 1 })); // 3 m gates, 1 h gate
            const individualTraces = Array.from({ length: N }, () => []);
            const openChannelsTrace = [];
            const totalCurrentTrace = [];

            for (let t = 0; t <= duration; t += dt) {
                let openCount = 0;
                for (let i = 0; i < N; i++) {
                    // Update m gates
                    for (let j = 0; j < 3; j++) {
                        const rand = Math.random();
                        if (channels[i].m[j] === 0) {
                            if (rand < p_m_open) channels[i].m[j] = 1;
                        } else {
                            if (rand < p_m_close) channels[i].m[j] = 0;
                        }
                    }
                    // Update h gate
                    const rand_h = Math.random();
                    if (channels[i].h === 0) {
                        if (rand_h < p_h_open) channels[i].h = 1;
                    } else {
                        if (rand_h < p_h_close) channels[i].h = 0;
                    }

                    const isOpen = channels[i].m.every(gate => gate === 1) && channels[i].h === 1;
                    individualTraces[i].push({ t, state: isOpen ? 1 : 0 });
                    if (isOpen) openCount++;
                }
                const totalCurrent = openCount * this.g_Na_single * (V - this.E_Na);
                openChannelsTrace.push({ t, value: openCount });
                totalCurrentTrace.push({ t, value: totalCurrent });
            }
            drawIndividualChannelsPlot(this.individualCtx, individualTraces, duration, N, 'Individual Channel Activity (Stochastic)');
            
            // ODE Simulation (RK4)
            const openChannelsTraceODE = [];
            const totalCurrentTraceODE = [];

            // ODE for m gate: dm/dt = alpha_m * (1 - m) - beta_m * m
            const dm_dt_func = (t, m_val, voltage) => {
                const alpha_m_val = HH.alpha_m(voltage);
                const beta_m_val = HH.beta_m(voltage);
                return alpha_m_val * (1 - m_val) - beta_m_val * m_val;
            };

            // ODE for h gate: dh/dt = alpha_h * (1 - h) - beta_h * h
            const dh_dt_func = (t, h_val, voltage) => {
                const alpha_h_val = HH.alpha_h(voltage);
                const beta_h_val = HH.beta_h(voltage);
                return alpha_h_val * (1 - h_val) - beta_h_val * h_val;
            };

            const V_resting = -65; // Resting potential for initial m_ode, h_ode calculation (no longer used for initialization, but kept for context)
            let m_ode = 0; // Initialize m_ode to 0, similar to stochastic m gates
            let h_ode = 1; // Initialize h_ode to 1, similar to stochastic h gate
            // if (isNaN(m_ode)) m_ode = 0; // No longer needed as m_ode is explicitly set
            // if (isNaN(h_ode)) h_ode = 0; // No longer needed as h_ode is explicitly set

            for (let t = 0; t <= duration; t += dt) {
                // V is the constant voltage from the slider, applied throughout the ODE simulation
                m_ode = rk4(dm_dt_func, m_ode, t, dt, V);
                h_ode = rk4(dh_dt_func, h_ode, t, dt, V);
                m_ode = Math.max(0, Math.min(1, m_ode)); // Clamp m between 0 and 1
                h_ode = Math.max(0, Math.min(1, h_ode)); // Clamp h between 0 and 1

                const open_prob_ode = Math.pow(m_ode, 3) * h_ode;
                const openCountODE = open_prob_ode * N;
                const totalCurrentODE = N * this.g_Na_single * open_prob_ode * (V - this.E_Na);

                openChannelsTraceODE.push({ t, value: openCountODE });
                totalCurrentTraceODE.push({ t, value: totalCurrentODE });
            }

            // Combine stochastic and ODE open channels for plotting
            const combinedOpenChannelsTraces = [
                { trace: openChannelsTrace, color: '--open-channel-color' },
                { trace: openChannelsTraceODE, color: '--ode-color' }
            ];
            drawTotalTracePlot(this.openChannelsCtx, combinedOpenChannelsTraces, duration, 'Open Channels (Stochastic and ODE models)', '# Open');

            // Combine stochastic and ODE total current for plotting
            const combinedTotalCurrentTraces = [
                { trace: totalCurrentTrace, color: '--current-color' },
                { trace: totalCurrentTraceODE, color: '--ode-color' }
            ];
            drawTotalTracePlot(this.totalCtx, combinedTotalCurrentTraces, duration, 'Total Na+ Current (Stochastic and ODE models)', 'Current (pA)');
        }
    };

    // Initial call to setup if the container is visible by default
    sim_sodium.init();

    // Add event listener for the sodium checkbox
    const sodiumCheckbox = document.querySelector('input[name="channel"][value="sodium"]');
    if (sodiumCheckbox) {
        sodiumCheckbox.addEventListener('change', function() {
            const container = document.getElementById('sodium-container');
            if (this.checked) {
                container.style.display = 'flex';
                sim_sodium.setup(); // Re-run setup when shown
            } else {
                container.style.display = 'none';
            }
        });
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === "data-theme") {
                const container = document.getElementById('sodium-container');
                if (container && container.style.display !== 'none') {
                    sim_sodium.runSimulation();
                    sim_sodium.updateSliderValues();
                }
            }
        });
    });

    observer.observe(document.documentElement, {
        attributes: true
    });
});