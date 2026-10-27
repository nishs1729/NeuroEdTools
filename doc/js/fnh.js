document.addEventListener('DOMContentLoaded', function () {
    const i_slider = document.getElementById('param_i');
    const a_slider = document.getElementById('param_a');
    const b_slider = document.getElementById('param_b');
    const epsilon_slider = document.getElementById('param_epsilon');
    const duration_slider = document.getElementById('duration');
    const v_init_slider = document.getElementById('v_init');
    const w_init_slider = document.getElementById('w_init');

    const i_value_span = document.getElementById('param_i-value');
    const a_value_span = document.getElementById('param_a-value');
    const b_value_span = document.getElementById('param_b-value');
    const epsilon_value_span = document.getElementById('param_epsilon-value');
    const duration_value_span = document.getElementById('duration-value');
    const v_init_value_span = document.getElementById('v_init-value');
    const w_init_value_span = document.getElementById('w_init-value');

    const vwPlotCanvas = document.getElementById('v-w-plot');
    const phasePlotCanvas = document.getElementById('phase-plot');
    const vwPlotCtx = vwPlotCanvas.getContext('2d');
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

    function simulateFHN(i, a, b, epsilon, duration, v_init, w_init) {
        let v = v_init;
        let w = w_init;
        const dt = 0.1;
        const steps = Math.floor(duration / dt);

        const v_trace = [];
        const w_trace = [];
        const t_trace = [];

        for (let step = 0; step < steps; step++) {
            const dv = v - (v * v * v) / 3 - w + i;
            const dw = epsilon * (v + a - b * w);

            v += dt * dv;
            w += dt * dw;

            if (!isFinite(v) || !isFinite(w)) {
                break; // Stop simulation if values become non-finite
            }

            v_trace.push(v);
            w_trace.push(w);
            t_trace.push(step * dt);
        }
        return { t_trace, v_trace, w_trace };
    }

    function drawVWPlot(ctx, t_trace, v_trace, w_trace, duration) {
        const canvas = ctx.canvas;
        const padding = { top: 40, right: 20, bottom: 40, left: 70 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;

        drawAxis(ctx, padding, plotWidth, plotHeight, 'Membrane Potential (V) and Recovery (W)', 'Time (ms)', 'Value');
        drawXAxisTicks(ctx, duration, padding, plotWidth);

        const legends = [
            { label: 'V', color: '--v-color' },
            { label: 'W', color: '--w-color' }
        ];
        drawLegend(ctx, legends, padding);

        const finite_v = v_trace.filter(isFinite);
        const finite_w = w_trace.filter(isFinite);
        if (finite_v.length === 0 && finite_w.length === 0) return;

        const allValues = finite_v.concat(finite_w);
        let minVal = Math.min(...allValues);
        let maxVal = Math.max(...allValues);
        if (minVal === maxVal) {
            minVal -= 1;
            maxVal += 1;
        }

        function plotTrace(trace, color) {
            ctx.beginPath();
            ctx.strokeStyle = getCssVariable(color);
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
        plotTrace(w_trace, '--w-color');

        ctx.textAlign = 'right';
        ctx.fillStyle = getCssVariable('--text-color');
        for (let i = 0; i <= 4; i++) {
            const val = minVal + (maxVal - minVal) * (i / 4);
            const y = padding.top + plotHeight - (i / 4) * plotHeight;
            ctx.fillText(val.toFixed(1), padding.left - 8, y + 4);
        }
    }

    function drawPhasePlot(ctx, v_trace, w_trace, i, a, b) {
        const canvas = ctx.canvas;
        const padding = { top: 40, right: 20, bottom: 40, left: 70 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;

        drawAxis(ctx, padding, plotWidth, plotHeight, 'Phase Portrait', 'V', 'W');

        const legends = [
            { label: 'Trajectory', color: '--accent-color' },
            { label: 'V-nullcline', color: '--v-nullcline-color' },
            { label: 'W-nullcline', color: '--w-nullcline-color' }
        ];
        drawLegend(ctx, legends, padding);

        let minV = -3, maxV = 3;
        let minW = -3, maxW = 3;

        // Plot trajectory
        ctx.beginPath();
        ctx.strokeStyle = getCssVariable('--accent-color');
        ctx.lineWidth = 1.5;
        let firstPoint = true;
        v_trace.forEach((v, index) => {
            if (!isFinite(v) || !isFinite(w_trace[index])) return;
            const w = w_trace[index];
            const x = padding.left + ((v - minV) / (maxV - minV)) * plotWidth;
            const y = padding.top + plotHeight - ((w - minW) / (maxW - minW)) * plotHeight;
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
                const w = y_coords[index];
                if (!isFinite(v) || !isFinite(w)) return;
                const x = padding.left + ((v - minV) / (maxV - minV)) * plotWidth;
                const y = padding.top + plotHeight - ((w - minW) / (maxW - minW)) * plotHeight;
                
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
        for (let v = minV; v <= maxV; v += 0.01) { // Increased resolution
            v_nullcline_x.push(v);
            v_nullcline_y.push(v - (v * v * v) / 3 + i);
        }
        plotNullcline(v_nullcline_x, v_nullcline_y, '--v-nullcline-color');

        const w_nullcline_x = [];
        const w_nullcline_y = [];
        for (let v = minV; v <= maxV; v += 0.01) {
            w_nullcline_x.push(v);
            w_nullcline_y.push((v + a) / b);
        }
        plotNullcline(w_nullcline_x, w_nullcline_y, '--w-nullcline-color');

        // Draw axes labels for phase plot
        ctx.textAlign = 'center';
        ctx.fillStyle = getCssVariable('--text-color');
        for (let i = 0; i <= 4; i++) {
            const val = minV + (maxV - minV) * (i / 4);
            const x = padding.left + (i / 4) * plotWidth;
            ctx.fillText(val.toFixed(1), x, padding.top + plotHeight + 20);
        }

        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const val = minW + (maxW - minW) * (i / 4);
            const y = padding.top + plotHeight - (i / 4) * plotHeight;
            ctx.fillText(val.toFixed(1), padding.left - 8, y + 4);
        }
    }

    function plotData() {
        const i = parseFloat(i_slider.value);
        const a = parseFloat(a_slider.value);
        const b = parseFloat(b_slider.value);
        const epsilon = parseFloat(epsilon_slider.value);
        const duration = parseFloat(duration_slider.value);
        const v_init = parseFloat(v_init_slider.value);
        const w_init = parseFloat(w_init_slider.value);

        i_value_span.textContent = i.toFixed(2);
        a_value_span.textContent = a.toFixed(2);
        b_value_span.textContent = b.toFixed(2);
        epsilon_value_span.textContent = epsilon.toFixed(2);
        duration_value_span.textContent = duration.toFixed(2);
        v_init_value_span.textContent = v_init.toFixed(2);
        w_init_value_span.textContent = w_init.toFixed(2);

        const { t_trace, v_trace, w_trace } = simulateFHN(i, a, b, epsilon, duration, v_init, w_init);

        drawVWPlot(vwPlotCtx, t_trace, v_trace, w_trace, duration);
        drawPhasePlot(phasePlotCtx, v_trace, w_trace, i, a, b);
    }

    [i_slider, a_slider, b_slider, epsilon_slider, duration_slider, v_init_slider, w_init_slider].forEach(slider => {
        slider.addEventListener('input', plotData);
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