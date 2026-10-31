document.addEventListener('DOMContentLoaded', () => {
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
        individualCanvas: document.getElementById('individual-plot-k'),
        openChannelsCanvas: document.getElementById('open-channels-plot-k'),
        totalCanvas: document.getElementById('total-plot-k'),
        abPlotCanvas: document.getElementById('ab_plot_k'),
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
            ChannelPlots.rates(this.abPlotCanvas, HH.alpha_n, HH.beta_n, '--alpha-m-color', '--beta-m-color', 'α_{n}', 'β_{n}', 1, V);
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
            ChannelPlots.raster(this.individualCanvas, individualTraces, duration, 'Individual Channel Activity');
            
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
                { trace: openChannelsTrace, color: '--open-channel-color', label: 'Stochastic' },
                { trace: openChannelsTraceODE.map(p => ({ t: p.t, value: p.value * N })), color: '--ode-color', label: 'ODE', dash: [6, 4] } // Multiply by N for ODE open channels
            ];
            ChannelPlots.traces(this.openChannelsCanvas, {
                title: 'Open Channels', yLabel: 'Open channels', duration, integer: true,
                series: combinedOpenChannelsTraces,
            });

            // Combine stochastic and ODE total current for plotting
            const combinedTotalCurrentTraces = [
                { trace: totalCurrentTrace, color: '--current-color', label: 'Stochastic' },
                { trace: totalCurrentTraceODE, color: '--ode-color', label: 'ODE', dash: [6, 4] }
            ];
            ChannelPlots.traces(this.totalCanvas, {
                title: 'Total K⁺ Current', yLabel: 'I (pA)', duration,
                series: combinedTotalCurrentTraces,
            });
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
});
