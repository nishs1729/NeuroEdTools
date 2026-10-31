document.addEventListener('DOMContentLoaded', () => {
    // --- Hodgkin-Huxley Rate Functions ---
    const HH = {
        alpha_n: V => (V === -55.0) ? 0.1 : (0.01 * (V + 55)) / (1 - Math.exp(-0.1 * (V + 55))),
        beta_n: V => 0.125 * Math.exp(-0.0125 * (V + 65)),
        alpha_m: V => (V === -40.0) ? 1.0 : (0.1 * (V + 40)) / (1 - Math.exp(-0.1 * (V + 40))),
        beta_m: V => 4 * Math.exp(-0.0556 * (V + 65)),
        alpha_h: V => 0.07 * Math.exp(-0.05 * (V + 65)),
        beta_h: V => 1 / (1 + Math.exp(-0.1 * (V + 35)))
    };

    // --- Part 1 Simulation ---
    const sim1 = {
        sliders: {
            alpha: document.getElementById('alpha_p1'),
            beta: document.getElementById('beta_p1'),
            numChannels: document.getElementById('num_channels_p1'),
            duration: document.getElementById('duration_p1'),
        },
        values: {
            alpha: document.getElementById('alpha_p1-value'),
            beta: document.getElementById('beta_p1-value'),
            numChannels: document.getElementById('num_channels_p1-value'),
            duration: document.getElementById('duration_p1-value'),
        },
        individualCanvas: document.getElementById('individual-plot-p1'),
        totalCanvas: document.getElementById('total-plot-p1'),

        init() { this.setup(); },
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
            for (const key in this.sliders) {
                this.values[key].textContent = this.sliders[key].value;
            }
        },
        runSimulation() {
            const N = parseInt(this.sliders.numChannels.value);
            const duration = parseFloat(this.sliders.duration.value);
            const alpha = parseFloat(this.sliders.alpha.value);
            const beta = parseFloat(this.sliders.beta.value);
            const dt = 0.1;
            const p_open = alpha * dt;
            const p_close = beta * dt;

            let channels = new Array(N).fill(0);
            const individualTraces = Array.from({ length: N }, () => []);
            const totalTrace = [];

            for (let t = 0; t <= duration; t += dt) {
                let openCount = 0;
                for (let i = 0; i < N; i++) {
                    const rand = Math.random();
                    if (channels[i] === 0) {
                        if (rand < p_open) channels[i] = 1;
                    } else {
                        if (rand < p_close) channels[i] = 0;
                    }
                    individualTraces[i].push({ t, state: channels[i] });
                    if (channels[i] === 1) openCount++;
                }
                totalTrace.push({ t, value: openCount });
            }
            ChannelPlots.raster(this.individualCanvas, individualTraces, duration, 'Individual Channel Activity');
            ChannelPlots.traces(this.totalCanvas, {
                title: 'Total Open Channels', yLabel: 'Open channels', duration, integer: true,
                series: [{ trace: totalTrace, color: '--open-channel-color' }],
            });
        }
    };

    // --- Part 2 Simulation ---
    const sim2 = {
        sliders: {
            voltage: document.getElementById('voltage_p2'),
            numChannels: document.getElementById('num_channels_p2'),
            duration: document.getElementById('duration_p2'),
        },
        values: {
            voltage: document.getElementById('voltage_p2-value'),
            numChannels: document.getElementById('num_channels_p2-value'),
            duration: document.getElementById('duration_p2-value'),
        },
        individualCanvas: document.getElementById('individual-plot-p2'),
        openChannelsCanvas: document.getElementById('open-channels-plot-p2'),
        totalCanvas: document.getElementById('total-plot-p2'),
        abPlotCanvas: document.getElementById('ab_plot_p2'),
        E_K: -77.0, g_K_single: 2,

        init() { sim1.setup.bind(this)(); },
        updateSliderValues() {
            for (const key in this.sliders) { this.values[key].textContent = this.sliders[key].value; }
            const V = parseFloat(this.sliders.voltage.value);
            ChannelPlots.rates(this.abPlotCanvas, HH.alpha_n, HH.beta_n, '--alpha-m-color', '--beta-m-color', 'α_n', 'β_n', 1, V);
        },
        runSimulation() {
            const N = parseInt(this.sliders.numChannels.value);
            const V = parseFloat(this.sliders.voltage.value);
            const duration = parseFloat(this.sliders.duration.value);
            const dt = 0.1;
            const p_open = HH.alpha_n(V) * dt;
            const p_close = HH.beta_n(V) * dt;

            let channels = new Array(N).fill(0);
            const individualTraces = Array.from({ length: N }, () => []);
            const openChannelsTrace = [];
            const totalCurrentTrace = [];

            for (let t = 0; t <= duration; t += dt) {
                let openCount = 0;
                for (let i = 0; i < N; i++) {
                    const rand = Math.random();
                    if (channels[i] === 0) {
                        if (rand < p_open) channels[i] = 1;
                    } else {
                        if (rand < p_close) channels[i] = 0;
                    }
                    individualTraces[i].push({ t, state: channels[i] });
                    if (channels[i] === 1) openCount++;
                }
                const totalCurrent = openCount * this.g_K_single * (V - this.E_K);
                openChannelsTrace.push({ t, value: openCount });
                totalCurrentTrace.push({ t, value: totalCurrent });
            }
            ChannelPlots.raster(this.individualCanvas, individualTraces, duration, 'Individual Gate Activity');
            ChannelPlots.traces(this.openChannelsCanvas, {
                title: 'Open Channels', yLabel: 'Open channels', duration, integer: true,
                series: [{ trace: openChannelsTrace, color: '--open-channel-color' }],
            });
            ChannelPlots.traces(this.totalCanvas, {
                title: 'Total K⁺ Current', yLabel: 'I (pA)', duration,
                series: [{ trace: totalCurrentTrace, color: '--current-color' }],
            });
        }
    };

    // --- Part 3 Simulation ---
    const sim3 = {
        sliders: {
            voltage: document.getElementById('voltage_p3'),
            numChannels: document.getElementById('num_channels_p3'),
            duration: document.getElementById('duration_p3'),
        },
        values: {
            voltage: document.getElementById('voltage_p3-value'),
            numChannels: document.getElementById('num_channels_p3-value'),
            duration: document.getElementById('duration_p3-value'),
        },
        individualCanvas: document.getElementById('individual-plot-p3'),
        openChannelsCanvas: document.getElementById('open-channels-plot-p3'),
        totalCanvas: document.getElementById('total-plot-p3'),
        abPlotCanvas: document.getElementById('ab_plot_p3'),
        E_K: -77.0, g_K_single: 2,

        init() { sim1.setup.bind(this)(); },
        updateSliderValues() {
            for (const key in this.sliders) { this.values[key].textContent = this.sliders[key].value; }
            const V = parseFloat(this.sliders.voltage.value);
            ChannelPlots.rates(this.abPlotCanvas, HH.alpha_n, HH.beta_n, '--alpha-m-color', '--beta-m-color', 'α_n', 'β_n', 1, V);
        },
        runSimulation() {
            const N = parseInt(this.sliders.numChannels.value);
            const V = parseFloat(this.sliders.voltage.value);
            const duration = parseFloat(this.sliders.duration.value);
            const dt = 0.1;
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
            ChannelPlots.traces(this.openChannelsCanvas, {
                title: 'Open Channels', yLabel: 'Open channels', duration, integer: true,
                series: [{ trace: openChannelsTrace, color: '--open-channel-color' }],
            });
            ChannelPlots.traces(this.totalCanvas, {
                title: 'Total K⁺ Current', yLabel: 'I (pA)', duration,
                series: [{ trace: totalCurrentTrace, color: '--current-color' }],
            });
        }
    };

    // --- Part 4 Simulation ---
    const sim4 = {
        sliders: {
            voltage: document.getElementById('voltage_p4'),
            numChannels: document.getElementById('num_channels_p4'),
            duration: document.getElementById('duration_p4'),
        },
        values: {
            voltage: document.getElementById('voltage_p4-value'),
            numChannels: document.getElementById('num_channels_p4-value'),
            duration: document.getElementById('duration_p4-value'),
        },
        individualCanvas: document.getElementById('individual-plot-p4'),
        openChannelsCanvas: document.getElementById('open-channels-plot-p4'),
        totalCanvas: document.getElementById('total-plot-p4'),
        abPlotCanvas_m: document.getElementById('ab_plot_p4_m'),
        abPlotCanvas_h: document.getElementById('ab_plot_p4_h'),
        E_Na: 50.0, g_Na_single: 1.5,

        init() { sim1.setup.bind(this)(); },
        updateSliderValues() {
            for (const key in this.sliders) { this.values[key].textContent = this.sliders[key].value; }
            const V = parseFloat(this.sliders.voltage.value);
            ChannelPlots.rates(this.abPlotCanvas_m, HH.alpha_m, HH.beta_m, '--alpha-m-color', '--beta-m-color', 'α_m', 'β_m', 5, V);
            ChannelPlots.rates(this.abPlotCanvas_h, HH.alpha_h, HH.beta_h, '--alpha-h-color', '--beta-h-color', 'α_h', 'β_h', 1, V);
        },
        runSimulation() {
            const N = parseInt(this.sliders.numChannels.value);
            const V = parseFloat(this.sliders.voltage.value);
            const duration = parseFloat(this.sliders.duration.value);
            const dt = 0.02;

            const p_m_open = HH.alpha_m(V) * dt;
            const p_m_close = HH.beta_m(V) * dt;
            const p_h_activate = HH.alpha_h(V) * dt;
            const p_h_inactivate = HH.beta_h(V) * dt;

            let channels = Array.from({ length: N }, () => ({ m: [0, 0, 0], h: 1 }));
            const individualTraces = Array.from({ length: N }, () => []);
            const openChannelsTrace = [];
            const totalCurrentTrace = [];

            for (let t = 0; t <= duration; t += dt) {
                let openCount = 0;
                for (let i = 0; i < N; i++) {
                    for (let j = 0; j < 3; j++) {
                        const rand = Math.random();
                        if (channels[i].m[j] === 0) {
                            if (rand < p_m_open) channels[i].m[j] = 1;
                        } else {
                            if (rand < p_m_close) channels[i].m[j] = 0;
                        }
                    }
                    const rand_h = Math.random();
                    if (channels[i].h === 1) {
                        if (rand_h < p_h_inactivate) channels[i].h = 0;
                    } else {
                        if (rand_h < p_h_activate) channels[i].h = 1;
                    }

                    const isOpen = channels[i].m.every(g => g === 1) && channels[i].h === 1;
                    individualTraces[i].push({ t, state: isOpen ? 1 : 0 });
                    if (isOpen) openCount++;
                }
                const totalCurrent = openCount * this.g_Na_single * (V - this.E_Na);
                openChannelsTrace.push({ t, value: openCount });
                totalCurrentTrace.push({ t, value: totalCurrent });
            }
            ChannelPlots.raster(this.individualCanvas, individualTraces, duration, 'Individual Channel Activity');
            ChannelPlots.traces(this.openChannelsCanvas, {
                title: 'Open Channels', yLabel: 'Open channels', duration, integer: true,
                series: [{ trace: openChannelsTrace, color: '--open-channel-color' }],
            });
            ChannelPlots.traces(this.totalCanvas, {
                title: 'Total Na⁺ Current', yLabel: 'I (pA)', duration,
                series: [{ trace: totalCurrentTrace, color: '--current-color' }],
            });
        }
    };

    sim1.init();
    sim2.init();
    sim3.init();
    sim4.init();
});
