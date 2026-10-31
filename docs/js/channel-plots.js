/**
 * channel-plots.js — plots shared by the Stochastic Channels and Channel Zoo pages,
 * built on NeuroPlot (plot.js must be loaded first).
 */
(function () {
    // Open/closed state of each channel over time, one row per channel
    function raster(canvas, traces, duration, title) {
        NeuroPlot.render(canvas, {
            title, xLabel: 'Time (ms)', yLabel: 'Channel #',
            x: { min: 0, max: duration },
            raster: { rows: traces, color: '--raster-color' },
        });
    }

    // One or more time traces: series = [{ trace: [{ t, value }], color, label, dash }]
    function traces(canvas, { title, yLabel, duration, integer = false, series }) {
        NeuroPlot.render(canvas, {
            title, xLabel: 'Time (ms)', yLabel,
            x: { min: 0, max: duration },
            y: { integer },
            legend: series.length > 1,
            series: series.map(s => ({
                x: s.trace.map(p => p.t),
                y: s.trace.map(p => p.value),
                color: s.color, label: s.label, dash: s.dash,
            })),
        });
    }

    // Opening (alpha) and closing (beta) rates against voltage, with the current voltage marked
    function rates(canvas, alphaFn, betaFn, color1, color2, label1, label2, rateMax, currentV = null) {
        const vMin = -100, vMax = 100;
        const v = [];
        for (let x = vMin; x <= vMax; x += 1) v.push(x);
        NeuroPlot.render(canvas, {
            compact: true, xLabel: 'Voltage (mV)', yLabel: 'Rate (1/ms)',
            x: { min: vMin, max: vMax }, y: { min: 0, max: rateMax },
            vlines: [{ x: currentV }],
            series: [
                { x: v, y: v.map(alphaFn), color: color1, label: label1, width: 2 },
                { x: v, y: v.map(betaFn), color: color2, label: label2, width: 2 },
            ],
        });
    }

    window.ChannelPlots = { raster, traces, rates };
})();
