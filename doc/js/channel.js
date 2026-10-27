document.addEventListener('DOMContentLoaded', () => {
    // --- General Helper Functions ---
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

    function drawTotalTracePlot(ctx, trace, duration, title, yLabel, color) {
        const canvas = ctx.canvas;
        const padding = { top: 40, right: 20, bottom: 40, left: 70 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;
        
        const allValues = trace.map(p => p.value);
        let minVal = Math.min(...allValues);
        let maxVal = Math.max(...allValues);
        if (minVal === maxVal) {
            minVal -= 1;
            maxVal += 1;
        }

        drawAxis(ctx, padding, plotWidth, plotHeight, title, 'Time (ms)', yLabel);
        drawXAxisTicks(ctx, duration, padding, plotWidth);

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
        individualCtx: document.getElementById('individual-plot-p1').getContext('2d'),
        totalCtx: document.getElementById('total-plot-p1').getContext('2d'),

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
            drawIndividualChannelsPlot(this.individualCtx, individualTraces, duration, N, 'Individual Channel Activity');
            drawTotalTracePlot(this.totalCtx, totalTrace, duration, 'Total Open Channels', '# Open', '--open-channel-color');
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
        individualCtx: document.getElementById('individual-plot-p2').getContext('2d'),
        openChannelsCtx: document.getElementById('open-channels-plot-p2').getContext('2d'),
        totalCtx: document.getElementById('total-plot-p2').getContext('2d'),
        abPlotCtx: document.getElementById('ab_plot_p2').getContext('2d'),
        E_K: -77.0, g_K_single: 2,

        init() { sim1.setup.bind(this)(); },
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
            drawIndividualChannelsPlot(this.individualCtx, individualTraces, duration, N, 'Individual Gate Activity');
            drawTotalTracePlot(this.openChannelsCtx, openChannelsTrace, duration, 'Open Channels', '# Open', '--open-channel-color');
            drawTotalTracePlot(this.totalCtx, totalCurrentTrace, duration, 'Total K+ Current', 'Current (pA)', '--current-color');
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
        individualCtx: document.getElementById('individual-plot-p3').getContext('2d'),
        openChannelsCtx: document.getElementById('open-channels-plot-p3').getContext('2d'),
        totalCtx: document.getElementById('total-plot-p3').getContext('2d'),
        abPlotCtx: document.getElementById('ab_plot_p3').getContext('2d'),
        E_K: -77.0, g_K_single: 2,

        init() { sim1.setup.bind(this)(); },
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
            drawIndividualChannelsPlot(this.individualCtx, individualTraces, duration, N, 'Individual Channel Activity');
            drawTotalTracePlot(this.openChannelsCtx, openChannelsTrace, duration, 'Open Channels', '# Open', '--open-channel-color');
            drawTotalTracePlot(this.totalCtx, totalCurrentTrace, duration, 'Total K+ Current', 'Current (pA)', '--current-color');
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
        individualCtx: document.getElementById('individual-plot-p4').getContext('2d'),
        openChannelsCtx: document.getElementById('open-channels-plot-p4').getContext('2d'),
        totalCtx: document.getElementById('total-plot-p4').getContext('2d'),
        abPlotCtx_m: document.getElementById('ab_plot_p4_m').getContext('2d'),
        abPlotCtx_h: document.getElementById('ab_plot_p4_h').getContext('2d'),
        E_Na: 50.0, g_Na_single: 1.5,

        init() { sim1.setup.bind(this)(); },
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
            drawIndividualChannelsPlot(this.individualCtx, individualTraces, duration, N, 'Individual Channel Activity');
            drawTotalTracePlot(this.openChannelsCtx, openChannelsTrace, duration, 'Open Channels', '# Open', '--open-channel-color');
            drawTotalTracePlot(this.totalCtx, totalCurrentTrace, duration, 'Total Na+ Current', 'Current (pA)', '--current-color');
        }
    };

    sim1.init();
    sim2.init();
    sim3.init();
    sim4.init();

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === "data-theme") {
                sim1.runSimulation();
                sim2.runSimulation();
                sim3.runSimulation();
                sim4.runSimulation();
                sim2.updateSliderValues();
                sim3.updateSliderValues();
                sim4.updateSliderValues();
            }
        });
    });

    observer.observe(document.documentElement, {
        attributes: true
    });
});