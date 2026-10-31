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
        individualCanvas: document.getElementById('individual-plot-na'),
        openChannelsCanvas: document.getElementById('open-channels-plot-na'),
        totalCanvas: document.getElementById('total-plot-na'),
        abPlotCanvas_m: document.getElementById('ab_plot_na_m'),
        abPlotCanvas_h: document.getElementById('ab_plot_na_h'),
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
            ChannelPlots.rates(this.abPlotCanvas_m, HH.alpha_m, HH.beta_m, '--alpha-m-color', '--beta-m-color', 'α_{m}', 'β_{m}', 5, V);
            ChannelPlots.rates(this.abPlotCanvas_h, HH.alpha_h, HH.beta_h, '--alpha-h-color', '--beta-h-color', 'α_{h}', 'β_{h}', 1, V);
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
            ChannelPlots.raster(this.individualCanvas, individualTraces, duration, 'Individual Channel Activity');
            
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
                { trace: openChannelsTrace, color: '--open-channel-color', label: 'Stochastic' },
                { trace: openChannelsTraceODE, color: '--ode-color', label: 'ODE', dash: [6, 4] }
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
                title: 'Total Na⁺ Current', yLabel: 'I (pA)', duration,
                series: combinedTotalCurrentTraces,
            });
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
});
