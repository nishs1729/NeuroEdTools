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

    function drawVUPlot(t_trace, v_trace, u_trace, duration) {
        NeuroPlot.render(vuPlotCanvas, {
            title: 'Membrane Potential (V) and Recovery (U)', xLabel: 'Time (ms)', yLabel: 'Value',
            x: { min: 0, max: duration },
            series: [
                { x: t_trace, y: v_trace, color: '--v-color', label: 'V' },
                { x: t_trace, y: u_trace, color: '--u-color', label: 'U' },
            ],
        });
    }

    function drawPhasePlot(v_trace, u_trace, b, i) {
        const minV = -100, maxV = 50;
        const minU = -30, maxU = 30;

        const v_null = [];
        const v_nullcline = [];
        const u_nullcline = [];
        for (let v = minV; v <= maxV; v += 0.1) {
            v_null.push(v);
            v_nullcline.push(0.04 * v * v + 5 * v + 140 + i);
            u_nullcline.push(b * v);
        }

        NeuroPlot.render(phasePlotCanvas, {
            title: 'Phase Portrait', xLabel: 'V (mV)', yLabel: 'U',
            x: { min: minV, max: maxV }, y: { min: minU, max: maxU },
            series: [
                { x: v_null, y: v_nullcline, color: '--v-nullcline-color', label: 'V-nullcline', width: 1.5 },
                { x: v_null, y: u_nullcline, color: '--u-nullcline-color', label: 'U-nullcline', width: 1.5 },
                { x: v_trace, y: u_trace, color: '--trajectory-color', label: 'Trajectory' },
            ],
        });
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

        drawVUPlot(t_trace, v_trace, u_trace, duration);
        drawPhasePlot(v_trace, u_trace, b, i);
    }

    [firing_pattern_select, duration_slider].forEach(element => {
        element.addEventListener('input', plotData);
    });

    [a_slider, b_slider, c_slider, d_slider, i_slider, v_init_slider, u_init_slider].forEach(slider => {
        slider.addEventListener('input', () => {
            firing_pattern_select.value = 'custom';
            plotData();
        });
    });

    plotData();
});
