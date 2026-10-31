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

    // --- Persistent Sodium Channel Simulation ---
    const sim_persistent_sodium = {
        sliders: {
            voltage: document.getElementById('voltage_nap'),
            numChannels: document.getElementById('num_channels_nap'),
            duration: document.getElementById('duration_nap'),
        },
        values: {
            voltage: document.getElementById('voltage_nap-value'),
            numChannels: document.getElementById('num_channels_nap-value'),
            duration: document.getElementById('duration_nap-value'),
        },
        individualCanvas: document.getElementById('individual-plot-nap'),
        openChannelsCanvas: document.getElementById('open-channels-plot-nap'),
        totalCanvas: document.getElementById('total-plot-nap'),
        abPlotCanvas: document.getElementById('ab_plot_nap'),
        E_Na: 55.0, // Sodium reversal potential (mV) for persistent sodium
        g_NaP_max: 0.5, // Maximum persistent sodium conductance (mS/cm^2)
        g_NaP_single: 0.005, // Single channel conductance (pS), scaled for N=100 to match g_NaP_max

        // Parameters for m_infinity and tau_m from jnk/info.md
        V_half: -52.5, // Half-activation voltage
        k_slope: 7,    // Slope factor
        tau_min: 1,    // Minimum time constant (ms)
        tau_max: 10,   // Maximum time constant (ms)
        V_tau: -40,    // Voltage for time constant midpoint
        k_tau: 10,     // Slope factor for time constant

        // Rate functions for persistent sodium (derived from m_infinity and tau_m)
        m_infinity(V) {
            return 1 / (1 + Math.exp((this.V_half - V) / this.k_slope));
        },
        tau_m(V) {
            return this.tau_min + (this.tau_max - this.tau_min) / (1 + Math.exp((V - this.V_tau) / this.k_tau));
        },
        alpha_mp(V) {
            return this.m_infinity(V) / this.tau_m(V);
        },
        beta_mp(V) {
            return (1 - this.m_infinity(V)) / this.tau_m(V);
        },

        init() {
            const container = document.getElementById('persistent-sodium-container');
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
            // For persistent sodium, we only have one activation gate (m_p)
            ChannelPlots.rates(this.abPlotCanvas, this.alpha_mp.bind(this), this.beta_mp.bind(this), '--alpha-m-color', '--beta-m-color', 'α_{mp}', 'β_{mp}', 1, V);
        },
        runSimulation() {
            const N = parseInt(this.sliders.numChannels.value);
            const V = parseFloat(this.sliders.voltage.value);
            const duration = parseFloat(this.sliders.duration.value);
            const dt = 0.1;

            // Stochastic Simulation
            const p_mp_open = this.alpha_mp(V) * dt;
            const p_mp_close = this.beta_mp(V) * dt;

            let channels = Array.from({ length: N }, () => [0, 0, 0]); // 3 m_p gates
            const individualTraces = Array.from({ length: N }, () => []);
            const openChannelsTrace = [];
            const totalCurrentTrace = [];

            for (let t = 0; t <= duration; t += dt) {
                let openCount = 0;
                for (let i = 0; i < N; i++) {
                    // Update m_p gates
                    for (let j = 0; j < 3; j++) {
                        const rand = Math.random();
                        if (channels[i][j] === 0) {
                            if (rand < p_mp_open) channels[i][j] = 1;
                        } else {
                            if (rand < p_mp_close) channels[i][j] = 0;
                        }
                    }
                    const isOpen = channels[i].every(gate => gate === 1);
                    individualTraces[i].push({ t, state: isOpen ? 1 : 0 });
                    if (isOpen) openCount++;
                }
                const totalCurrent = openCount * this.g_NaP_single * (V - this.E_Na);
                openChannelsTrace.push({ t, value: openCount });
                totalCurrentTrace.push({ t, value: totalCurrent });
            }
            ChannelPlots.raster(this.individualCanvas, individualTraces, duration, 'Individual Channel Activity');
            
            // ODE Simulation (RK4)
            const openChannelsTraceODE = [];
            const totalCurrentTraceODE = [];

            // ODE for m_p gate: dm_p/dt = alpha_mp * (1 - m_p) - beta_mp * m_p
            const dmp_dt_func = (t, mp_val, voltage) => {
                const alpha_mp_val = this.alpha_mp(voltage);
                const beta_mp_val = this.beta_mp(voltage);
                return alpha_mp_val * (1 - mp_val) - beta_mp_val * mp_val;
            };

            let mp_ode = 0; // Initialize mp_ode to 0, similar to stochastic m_p gates
            if (isNaN(mp_ode)) mp_ode = 0;

            for (let t = 0; t <= duration; t += dt) {
                mp_ode = rk4(dmp_dt_func, mp_ode, t, dt, V);
                mp_ode = Math.max(0, Math.min(1, mp_ode)); // Clamp mp between 0 and 1

                const open_prob_ode = Math.pow(mp_ode, 3);
                const openCountODE = open_prob_ode * N;
                const totalCurrentODE = N * this.g_NaP_single * open_prob_ode * (V - this.E_Na);

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
                title: 'Total NaP Current', yLabel: 'I (pA)', duration,
                series: combinedTotalCurrentTraces,
            });
        }
    };

    // Initial call to setup if the container is visible by default
    sim_persistent_sodium.init();

    // Add event listener for the persistent sodium checkbox
    const persistentSodiumCheckbox = document.querySelector('input[name="channel"][value="persistent-sodium"]');
    if (persistentSodiumCheckbox) {
        persistentSodiumCheckbox.addEventListener('change', function() {
            const container = document.getElementById('persistent-sodium-container');
            if (this.checked) {
                container.style.display = 'flex';
                sim_persistent_sodium.setup(); // Re-run setup when shown
            } else {
                container.style.display = 'none';
            }
        });
    }
});
