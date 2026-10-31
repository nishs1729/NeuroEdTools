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

    function drawVWPlot(t_trace, v_trace, w_trace, duration) {
        NeuroPlot.render(vwPlotCanvas, {
            title: 'Membrane Potential (V) and Recovery (W)', xLabel: 'Time (ms)', yLabel: 'Value',
            x: { min: 0, max: duration },
            series: [
                { x: t_trace, y: v_trace, color: '--v-color', label: 'V' },
                { x: t_trace, y: w_trace, color: '--w-color', label: 'W' },
            ],
        });
    }

    function drawPhasePlot(v_trace, w_trace, i, a, b) {
        const minV = -3, maxV = 3;
        const minW = -3, maxW = 3;

        const v_null = [];
        const v_nullcline = [];
        const w_nullcline = [];
        for (let v = minV; v <= maxV; v += 0.01) {
            v_null.push(v);
            v_nullcline.push(v - (v * v * v) / 3 + i);
            w_nullcline.push((v + a) / b);
        }

        NeuroPlot.render(phasePlotCanvas, {
            title: 'Phase Portrait', xLabel: 'V', yLabel: 'W',
            x: { min: minV, max: maxV }, y: { min: minW, max: maxW },
            series: [
                { x: v_null, y: v_nullcline, color: '--v-nullcline-color', label: 'V-nullcline', width: 1.5 },
                { x: v_null, y: w_nullcline, color: '--w-nullcline-color', label: 'W-nullcline', width: 1.5 },
                { x: v_trace, y: w_trace, color: '--trajectory-color', label: 'Trajectory' },
            ],
        });
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

        drawVWPlot(t_trace, v_trace, w_trace, duration);
        drawPhasePlot(v_trace, w_trace, i, a, b);
    }

    [i_slider, a_slider, b_slider, epsilon_slider, duration_slider, v_init_slider, w_init_slider].forEach(slider => {
        slider.addEventListener('input', plotData);
    });

    plotData();
});
