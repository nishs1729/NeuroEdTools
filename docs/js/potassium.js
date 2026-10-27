document.addEventListener('DOMContentLoaded', () => {
    // --- General Helper Functions (Copied from channel.js) ---
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

    function drawXAxisTicks(ctx, duration, padding, plotWidth) {
        ctx.textAlign = 'center';
        ctx.fillStyle = getCssVariable('--text-color');
        for (let i = 0; i <= 5; i++) {
            const val = (duration / 5) * i;
            const x = padding.left + (i / 5) * plotWidth;
            ctx.fillText(val.toFixed(0), x, padding.top + ctx.canvas.height - padding.top - padding.bottom + 20);
        }
    }
    
    function drawIndividualChannelsPlot(ctx, traces, duration, N, title) {
        const canvas = ctx.canvas;
        const padding = { top: 40, right: 20, bottom: 40, left: 70 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;

        drawAxis(ctx, padding, plotWidth, plotHeight, title, 'Time (ms)', 'Channel #');
        drawXAxisTicks(ctx, duration, padding, plotWidth);

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
        drawXAxisTicks(ctx, duration, padding, plotWidth);

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

    // --- Potassium Channel Simulation ---
    const sim_potassium = {
        sliders: {
            voltage: document.getElementById('voltage_k'),
            numChannels: document.getElementById('num_channels_k'),
            duration: document.getElementById('duration_k'),
        },
        values: {
            voltage: document.getElementById('voltage_k-value'),
            numChannels: document.getElementById('num_channels_k-value'),
            duration: document.getElementById('duration_k-value'),
        },
        individualCtx: document.getElementById('individual-plot-k').getContext('2d'),
        openChannelsCtx: document.getElementById('open-channels-plot-k').getContext('2d'),
        totalCtx: document.getElementById('total-plot-k').getContext('2d'),
        abPlotCtx: document.getElementById('ab_plot_k').getContext('2d'),
        E_K: -77.0, // Potassium reversal potential (mV)
        g_K_max: 36, // Maximum potassium conductance (mS/cm^2)
        g_K_single: 0.36, // Single channel conductance (pS), scaled for N=100 to match g_K_max

        init() {
            const container = document.getElementById('potassium-container');
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
            drawAlphaBetaPlot(this.abPlotCtx, HH.alpha_n, HH.beta_n, '--alpha-m-color', '--beta-m-color', 'αn', 'βn', 1, V);
        },
        runSimulation() {
            const N = parseInt(this.sliders.numChannels.value);
            const V = parseFloat(this.sliders.voltage.value);
            const duration = parseFloat(this.sliders.duration.value);
            const dt = 0.1;

            // Stochastic Simulation
            const p_open = HH.alpha_n(V) * dt;
            const p_close = HH.beta_n(V) * dt;

            let channels = Array.from({ length: N }, () => [0, 0, 0, 0]);
            const individualTraces = Array.from({ length: N }, () => []);
            const openChannelsTrace = [];
            const totalCurrentTrace = [];

            for (let t = 0; t <= duration; t += dt) {
                let openCount = 0;
                for (let i = 0; i < N; i++) {
                    for (let j = 0; j < 4; j++) {
                        const rand = Math.random();
                        if (channels[i][j] === 0) {
                            if (rand < p_open) channels[i][j] = 1;
                        } else {
                            if (rand < p_close) channels[i][j] = 0;
                        }
                    }
                    const isOpen = channels[i].every(gate => gate === 1);
                    individualTraces[i].push({ t, state: isOpen ? 1 : 0 });
                    if (isOpen) openCount++;
                }
                const totalCurrent = openCount * this.g_K_single * (V - this.E_K);
                openChannelsTrace.push({ t, value: openCount });
                totalCurrentTrace.push({ t, value: totalCurrent });
            }
            drawIndividualChannelsPlot(this.individualCtx, individualTraces, duration, N, 'Individual Channel Activity (Stochastic)');
            
            // ODE Simulation (RK4)
            const openChannelsTraceODE = [];
            const totalCurrentTraceODE = [];

            // ODE for n gate: dn/dt = alpha_n * (1 - n) - beta_n * n
            const dn_dt_func = (t, n_val, voltage) => {
                const alpha_n_val = HH.alpha_n(voltage);
                const beta_n_val = HH.beta_n(voltage);
                return alpha_n_val * (1 - n_val) - beta_n_val * n_val;
            };

            const V_resting = -65; // Resting potential for initial n_ode calculation
            let n_ode = HH.alpha_n(V_resting) / (HH.alpha_n(V_resting) + HH.beta_n(V_resting)); // Initialize n to steady-state at resting potential
            if (isNaN(n_ode)) n_ode = 0; // Handle potential NaN if alpha_n + beta_n is 0

            for (let t = 0; t <= duration; t += dt) {
                // V is the constant voltage from the slider, applied throughout the ODE simulation
                n_ode = rk4(dn_dt_func, n_ode, t, dt, V);
                n_ode = Math.max(0, Math.min(1, n_ode)); // Clamp n between 0 and 1

                const n_power_4_ode = Math.pow(n_ode, 4);
                const openFractionODE = n_power_4_ode;
                const totalCurrentODE = N * this.g_K_single * n_power_4_ode * (V - this.E_K);

                openChannelsTraceODE.push({ t, value: openFractionODE });
                totalCurrentTraceODE.push({ t, value: totalCurrentODE });
            }

            // Combine stochastic and ODE open channels for plotting
            const combinedOpenChannelsTraces = [
                { trace: openChannelsTrace, color: '--open-channel-color' },
                { trace: openChannelsTraceODE.map(p => ({ t: p.t, value: p.value * N })), color: '--ode-color' } // Multiply by N for ODE open channels
            ];
            drawTotalTracePlot(this.openChannelsCtx, combinedOpenChannelsTraces, duration, 'Open Channels (Stochastic and ODE models)', '# Open');

            // Combine stochastic and ODE total current for plotting
            const combinedTotalCurrentTraces = [
                { trace: totalCurrentTrace, color: '--current-color' },
                { trace: totalCurrentTraceODE, color: '--ode-color' }
            ];
            drawTotalTracePlot(this.totalCtx, combinedTotalCurrentTraces, duration, 'Total K+ Current (Stochastic and ODE models)', 'Current (pA)');
        }
    };

    // Initial call to setup if the container is visible by default
    sim_potassium.init();

    // Add event listener for the potassium checkbox
    const potassiumCheckbox = document.querySelector('input[name="channel"][value="potassium"]');
    if (potassiumCheckbox) {
        potassiumCheckbox.addEventListener('change', function() {
            const container = document.getElementById('potassium-container');
            if (this.checked) {
                container.style.display = 'flex';
                sim_potassium.setup(); // Re-run setup when shown
            } else {
                container.style.display = 'none';
            }
        });
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === "data-theme") {
                const container = document.getElementById('potassium-container');
                if (container && container.style.display !== 'none') {
                    sim_potassium.runSimulation();
                    sim_potassium.updateSliderValues();
                }
            }
        });
    });

    observer.observe(document.documentElement, {
        attributes: true
    });
});