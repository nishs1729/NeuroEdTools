document.addEventListener('DOMContentLoaded', function () {
    const firing_pattern_select = document.getElementById('firing_pattern');
    const a_slider = document.getElementById('param_a');
    const b_slider = document.getElementById('param_b');
    const c_slider = document.getElementById('param_c');
    const d_slider = document.getElementById('param_d');
    const i_slider = document.getElementById('param_i');
    const duration_slider = document.getElementById('duration');
    const v_init_slider = document.getElementById('v_init');
    const u_init_slider = document.getElementById('u_init');

    const a_value_span = document.getElementById('param_a-value');
    const b_value_span = document.getElementById('param_b-value');
    const c_value_span = document.getElementById('param_c-value');
    const d_value_span = document.getElementById('param_d-value');
    const i_value_span = document.getElementById('param_i-value');
    const duration_value_span = document.getElementById('duration-value');
    const v_init_value_span = document.getElementById('v_init-value');
    const u_init_value_span = document.getElementById('u_init-value');

    const vuPlotCanvas = document.getElementById('v-w-plot');
    const phasePlotCanvas = document.getElementById('phase-plot');
    const vuPlotCtx = vuPlotCanvas.getContext('2d');
    const phasePlotCtx = phasePlotCanvas.getContext('2d');

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

    function drawLegend(ctx, legends, padding) {
        ctx.font = '12px sans-serif';
        let x_offset = padding.left + 20;
        legends.forEach(legend => {
            ctx.fillStyle = getCssVariable(legend.color);
            ctx.fillRect(x_offset, padding.top, 10, 10);
            ctx.fillStyle = getCssVariable('--text-color');
            ctx.textAlign = 'left';
            ctx.fillText(legend.label, x_offset + 15, padding.top + 10);
            x_offset += ctx.measureText(legend.label).width + 40;
        });
    }

    function simulateIzhikevich(a, b, c, d, i, duration, v_init, u_init) {
        let v = v_init;
        let u = u_init;
        const dt = 0.1;
        const steps = Math.floor(duration / dt);

        const v_trace = [];
        const u_trace = [];
        const t_trace = [];

        for (let step = 0; step < steps; step++) {
            const dv = (0.04 * v * v) + (5 * v) + 140 - u + i;
            const du = a * ((b * v) - u);

            v += dt * dv;
            u += dt * du;

            if (v >= 30) {
                v = c;
                u += d;
            }

            if (!isFinite(v) || !isFinite(u)) {
                break; // Stop simulation if values become non-finite
            }

            v_trace.push(v);
            u_trace.push(u);
            t_trace.push(step * dt);
        }
        return { t_trace, v_trace, u_trace };
    }

    function drawVUPlot(ctx, t_trace, v_trace, u_trace, duration) {
        const canvas = ctx.canvas;
        const padding = { top: 40, right: 20, bottom: 40, left: 70 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;

        drawAxis(ctx, padding, plotWidth, plotHeight, 'Membrane Potential (V) and Recovery (U)', 'Time (ms)', 'Value');
        drawXAxisTicks(ctx, duration, padding, plotWidth);

        const legends = [
            { label: 'V', color: '--v-color' },
            { label: 'U', color: '--u-color' }
        ];
        drawLegend(ctx, legends, padding);

        const finite_v = v_trace.filter(isFinite);
        const finite_u = u_trace.filter(isFinite);
        if (finite_v.length === 0 && finite_u.length === 0) return;

        const allValues = finite_v.concat(finite_u);
        let minVal = Math.min(...allValues);
        let maxVal = Math.max(...allValues);
        if (minVal === maxVal) {
            minVal -= 1;
            maxVal += 1;
        }

        function plotTrace(trace, color) {
            ctx.strokeStyle = getCssVariable(color);
            ctx.beginPath();
            ctx.lineWidth = 1.5;
            let firstPoint = true;
            trace.forEach((val, i) => {
                if (!isFinite(val)) return;
                const x = padding.left + (t_trace[i] / duration) * plotWidth;
                const y_val = (val - minVal) / (maxVal - minVal || 1);
                const y = padding.top + plotHeight - y_val * plotHeight;
                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();
        }

        plotTrace(v_trace, '--v-color');
        plotTrace(u_trace, '--u-color');

        ctx.textAlign = 'right';
        ctx.fillStyle = getCssVariable('--text-color');
        for (let i = 0; i <= 4; i++) {
            const val = minVal + (maxVal - minVal) * (i / 4);
            const y = padding.top + plotHeight - (i / 4) * plotHeight;
            ctx.fillText(val.toFixed(1), padding.left - 8, y + 4);
        }
    }

    function drawPhasePlot(ctx, v_trace, u_trace, a, b, c, d, i) {
        const canvas = ctx.canvas;
        const padding = { top: 40, right: 20, bottom: 40, left: 70 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;

        drawAxis(ctx, padding, plotWidth, plotHeight, 'Phase Portrait', 'V', 'U');

        const legends = [
            { label: 'Trajectory', color: '--accent-color' },
            { label: 'V-nullcline', color: '--v-nullcline-color' },
            { label: 'U-nullcline', color: '--u-nullcline-color' }
        ];
        drawLegend(ctx, legends, padding);

        let minV = -100, maxV = 50; // Adjusted for Izhikevich model
        let minU = -30, maxU = 30; // Adjusted for Izhikevich model

        // Plot trajectory
        ctx.beginPath();
        ctx.strokeStyle = getCssVariable('--accent-color');
        ctx.lineWidth = 1.5;
        let firstPoint = true;
        v_trace.forEach((v, index) => {
            if (!isFinite(v) || !isFinite(u_trace[index])) return;
            const u = u_trace[index];
            const x = padding.left + ((v - minV) / (maxV - minV)) * plotWidth;
            const y = padding.top + plotHeight - ((u - minU) / (maxU - minU)) * plotHeight;
            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Plot nullclines
        function plotNullcline(x_coords, y_coords, color) {
            ctx.beginPath();
            ctx.strokeStyle = getCssVariable(color);
            ctx.lineWidth = 1.5;
            let last_y_in_bounds = false;
            x_coords.forEach((v, index) => {
                const u = y_coords[index];
                if (!isFinite(v) || !isFinite(u)) return;
                const x = padding.left + ((v - minV) / (maxV - minV)) * plotWidth;
                const y = padding.top + plotHeight - ((u - minU) / (maxU - minU)) * plotHeight;
                
                const y_in_bounds = y >= padding.top && y <= padding.top + plotHeight;

                if (y_in_bounds) {
                    if (last_y_in_bounds) {
                        ctx.lineTo(x, y);
                    } else {
                        ctx.moveTo(x, y);
                    }
                }
                last_y_in_bounds = y_in_bounds;
            });
            ctx.stroke();
        }

        const v_nullcline_x = [];
        const v_nullcline_y = [];
        for (let v_val = minV; v_val <= maxV; v_val += 0.1) { // Increased resolution
            v_nullcline_x.push(v_val);
            v_nullcline_y.push(0.04 * v_val * v_val + 5 * v_val + 140 + i);
        }
        plotNullcline(v_nullcline_x, v_nullcline_y, '--v-nullcline-color');

        const u_nullcline_x = [];
        const u_nullcline_y = [];
        for (let v_val = minV; v_val <= maxV; v_val += 0.1) {
            u_nullcline_x.push(v_val);
            u_nullcline_y.push(b * v_val);
        }
        plotNullcline(u_nullcline_x, u_nullcline_y, '--u-nullcline-color');

        // Draw axes labels for phase plot
        ctx.textAlign = 'center';
        ctx.fillStyle = getCssVariable('--text-color');
        for (let i_val = 0; i_val <= 4; i_val++) {
            const val = minV + (maxV - minV) * (i_val / 4);
            const x = padding.left + (i_val / 4) * plotWidth;
            ctx.fillText(val.toFixed(1), x, padding.top + plotHeight + 20);
        }

        ctx.textAlign = 'right';
        for (let i_val = 0; i_val <= 4; i_val++) {
            const val = minU + (maxU - minU) * (i_val / 4);
            const y = padding.top + plotHeight - (i_val / 4) * plotHeight;
            ctx.fillText(val.toFixed(1), padding.left - 8, y + 4);
        }
    }

    function plotData() {
        let a = parseFloat(a_slider.value);
        let b = parseFloat(b_slider.value);
        let c = parseFloat(c_slider.value);
        let d = parseFloat(d_slider.value);
        let i = parseFloat(i_slider.value);
        const duration = parseFloat(duration_slider.value);
        let v_init = parseFloat(v_init_slider.value);
        let u_init = parseFloat(u_init_slider.value);

        const pattern = firing_pattern_select.value;

        // Update parameters based on selected firing pattern
        if (pattern !== 'custom') {
            switch (pattern) {
                case 'rs': // Regular Spiking
                    a = 0.02; b = 0.2; c = -65; d = 8; i = 10;
                    break;
                case 'ib': // Intrinsically Bursting
                    a = 0.02; b = 0.2; c = -55; d = 4; i = 10;
                    break;
                case 'ch': // Chattering
                    a = 0.02; b = 0.2; c = -50; d = 2; i = 10;
                    break;
                case 'fs': // Fast Spiking
                    a = 0.1; b = 0.2; c = -65; d = 2; i = 10;
                    break;
                case 'lts': // Low-Threshold Spiking
                    a = 0.02; b = 0.25; c = -65; d = 2; i = 10;
                    break;
                case 'tc': // Thalamo-Cortical
                    a = 0.02; b = 0.25; c = -65; d = 0.05; i = 0.5; // Example I for rebound
                    break;
                case 'rz': // Resonator
                    a = 0.1; b = 0.26; c = -65; d = 2; i = 0.5; // Example I for resonance
                    break;
                case 'sfa': // Spike Frequency Adaptation
                    a = 0.01; b = 0.2; c = -65; d = 8; i = 10;
                    break;
                case 'class1': // Class 1 Excitability
                    a = 0.02; b = 0.2; c = -65; d = 6; i = 0.5;
                    break;
                case 'class2': // Class 2 Excitability
                    a = 0.02; b = 0.25; c = -65; d = 6; i = 0.5;
                    break;
                case 'sl': // Spike Latency
                    a = 0.02; b = 0.2; c = -65; d = 6; i = 0.5;
                    break;
                case 'so': // Subthreshold Oscillations
                    a = 0.05; b = 0.26; c = -65; d = 2; i = 0;
                    break;
                case 'res': // Rebound Spike
                    a = 0.02; b = 0.25; c = -65; d = 0.05; i = -1; // Hyperpolarizing current
                    break;
                case 'reb': // Rebound Burst
                    a = 0.02; b = 0.25; c = -55; d = 0.05; i = -1; // Hyperpolarizing current
                    break;
                case 'tv': // Threshold Variability
                    a = 0.02; b = 0.2; c = -65; d = 6; i = 10;
                    break;
                case 'bs': // Bistability
                    a = 0.1; b = 0.26; c = -65; d = 0; i = 0;
                    break;
                case 'dap': // Depolarizing After-Potential
                    a = 0.02; b = 0.2; c = -55; d = 1; i = 10;
                    break;
                case 'ac': // Accommodation
                    a = 0.02; b = 0.25; c = -65; d = 6; i = 0.5;
                    break;
                case 'iis': // Inhibition-Induced Spiking
                    a = 0.02; b = 0.25; c = -65; d = 0.05; i = -5;
                    break;
                case 'iib': // Inhibition-Induced Bursting
                    a = 0.02; b = 0.25; c = -55; d = 0.05; i = -5;
                    break;
            }
            // Update sliders to reflect the new values
            a_slider.value = a;
            b_slider.value = b;
            c_slider.value = c;
            d_slider.value = d;
            i_slider.value = i;
        }

        a_value_span.textContent = a.toFixed(2);
        b_value_span.textContent = b.toFixed(2);
        c_value_span.textContent = c.toFixed(2);
        d_value_span.textContent = d.toFixed(2);
        i_value_span.textContent = i.toFixed(2);
        duration_value_span.textContent = duration.toFixed(0);
        v_init_value_span.textContent = v_init.toFixed(0);
        u_init_value_span.textContent = u_init.toFixed(0);

        const { t_trace, v_trace, u_trace } = simulateIzhikevich(a, b, c, d, i, duration, v_init, u_init);

        drawVUPlot(vuPlotCtx, t_trace, v_trace, u_trace, duration);
        drawPhasePlot(phasePlotCtx, v_trace, u_trace, a, b, c, d, i);
    }

    [firing_pattern_select].forEach(element => {
        element.addEventListener('input', plotData);
    });

    [a_slider, b_slider, c_slider, d_slider, i_slider, v_init_slider, u_init_slider].forEach(slider => {
        slider.addEventListener('input', () => {
            firing_pattern_select.value = 'custom';
            plotData();
        });
    });

    plotData();

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === "data-theme") {
                plotData();
            }
        });
    });

    observer.observe(document.documentElement, {
        attributes: true
    });
});
