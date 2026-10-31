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

    // --- HCN Channel Simulation ---
    const sim_hcn = {
        sliders: {
            voltage: document.getElementById('voltage_hcn'),
            numChannels: document.getElementById('num_channels_hcn'),
            duration: document.getElementById('duration_hcn'),
        },
        values: {
            voltage: document.getElementById('voltage_hcn-value'),
            numChannels: document.getElementById('num_channels_hcn-value'),
            duration: document.getElementById('duration_hcn-value'),
        },
        individualCanvas: document.getElementById('individual-plot-hcn'),
        openChannelsCanvas: document.getElementById('open-channels-plot-hcn'),
        totalCanvas: document.getElementById('total-plot-hcn'),
        abPlotCanvas: document.getElementById('ab_plot_hcn'),
        E_h: -35.0, // Reversal potential (mV)
        g_HCN_max: 0.5, // Maximum HCN conductance (mS/cm^2)
        g_HCN_single: 0.005, // Single channel conductance (pS), scaled for N=100 to match g_HCN_max

        // Parameters for m_infinity and tau_h from jnk/info.md
        V_half: -75, // Half-activation voltage
        k_slope: 6,    // Slope factor
        tau_min: 50,    // Minimum time constant (ms)
        tau_max: 400,   // Maximum time constant (ms)
        V_tau: -70,    // Voltage for time constant midpoint
        k_tau: 10,     // Slope factor for time constant

        // Rate functions for HCN (derived from m_infinity and tau_h)
        m_infinity(V) {
            return 1 / (1 + Math.exp((V - this.V_half) / this.k_slope));
        },
        tau_h(V) {
            return this.tau_min + (this.tau_max - this.tau_min) / (1 + Math.exp((V - this.V_tau) / this.k_tau));
        },
        alpha_mh(V) {
            return this.m_infinity(V) / this.tau_h(V);
        },
        beta_mh(V) {
            return (1 - this.m_infinity(V)) / this.tau_h(V);
        },

        init() {
            const container = document.getElementById('hcn-container');
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
            // For HCN, we only have one activation gate (m_h)
            ChannelPlots.rates(this.abPlotCanvas, this.alpha_mh.bind(this), this.beta_mh.bind(this), '--alpha-m-color', '--beta-m-color', 'α_{mh}', 'β_{mh}', 1, V);
        },
        runSimulation() {
            const N = parseInt(this.sliders.numChannels.value);
            const V = parseFloat(this.sliders.voltage.value);
            const duration = parseFloat(this.sliders.duration.value);
            const dt = 0.1;

            // Stochastic Simulation
            const p_mh_open = this.alpha_mh(V) * dt;
            const p_mh_close = this.beta_mh(V) * dt;

            let channels = Array.from({ length: N }, () => [0]); // 1 m_h gate
            const individualTraces = Array.from({ length: N }, () => []);
            const openChannelsTrace = [];
            const totalCurrentTrace = [];

            for (let t = 0; t <= duration; t += dt) {
                let openCount = 0;
                for (let i = 0; i < N; i++) {
                    // Update m_h gate
                    const rand = Math.random();
                    if (channels[i][0] === 0) {
                        if (rand < p_mh_open) channels[i][0] = 1;
                    } else {
                        if (rand < p_mh_close) channels[i][0] = 0;
                    }
                    const isOpen = channels[i][0] === 1;
                    individualTraces[i].push({ t, state: isOpen ? 1 : 0 });
                    if (isOpen) openCount++;
                }
                const totalCurrent = openCount * this.g_HCN_single * (V - this.E_h);
                openChannelsTrace.push({ t, value: openCount });
                totalCurrentTrace.push({ t, value: totalCurrent });
            }
            ChannelPlots.raster(this.individualCanvas, individualTraces, duration, 'Individual Channel Activity');
            
            // ODE Simulation (RK4)
            const openChannelsTraceODE = [];
            const totalCurrentTraceODE = [];

            // ODE for m_h gate: dm_h/dt = alpha_mh * (1 - m_h) - beta_mh * m_h
            const dmh_dt_func = (t, mh_val, voltage) => {
                const alpha_mh_val = this.alpha_mh(voltage);
                const beta_mh_val = this.beta_mh(voltage);
                return alpha_mh_val * (1 - mh_val) - beta_mh_val * mh_val;
            };

            let mh_ode = 0; // Initialize mh_ode to 0, similar to stochastic m_h gates
            if (isNaN(mh_ode)) mh_ode = 0;

            for (let t = 0; t <= duration; t += dt) {
                mh_ode = rk4(dmh_dt_func, mh_ode, t, dt, V);
                mh_ode = Math.max(0, Math.min(1, mh_ode)); // Clamp mh between 0 and 1

                const open_prob_ode = mh_ode; // Power is 1 for HCN
                const openCountODE = open_prob_ode * N;
                const totalCurrentODE = N * this.g_HCN_single * open_prob_ode * (V - this.E_h);

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
                title: 'Total HCN Current', yLabel: 'I (pA)', duration,
                series: combinedTotalCurrentTraces,
            });
        }
    };

    // Initial call to setup if the container is visible by default
    sim_hcn.init();

    // Add event listener for the HCN checkbox
    const hcnCheckbox = document.querySelector('input[name="channel"][value="hcn"]');
    if (hcnCheckbox) {
        hcnCheckbox.addEventListener('change', function() {
            const container = document.getElementById('hcn-container');
            if (this.checked) {
                container.style.display = 'flex';
                sim_hcn.setup(); // Re-run setup when shown
            } else {
                container.style.display = 'none';
            }
        });
    }
});
