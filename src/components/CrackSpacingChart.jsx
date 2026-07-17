import React from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';

const CrackSpacingChart = ({ cracks, surveyDays, sections }) => {
    if (!cracks || cracks.length === 0 || sections.length === 0 || surveyDays.length === 0) return null;

    // Filter out "ACC" day for the chart display
    const chartSurveyDays = surveyDays.filter(day => day.name !== 'ACC');

    // X-axis: Survey Day Names
    const xValues = chartSurveyDays.map(day => day.name);

    const data = sections.map((sec, idx) => {
        const secCracks = cracks.filter(c => c.distance >= sec.start_station && c.distance <= sec.end_station);

        // Calculate average spacing for each day
        const yValues = chartSurveyDays.map((day) => {
            const originalIndex = surveyDays.findIndex(d => d.id === day.id);
            const daysUpToCurrent = surveyDays.slice(0, originalIndex + 1).map(d => parseInt(d.id, 10));
            const cracksUpToDay = secCracks
                .filter(c => daysUpToCurrent.includes(parseInt(c.day_id, 10)))
                .sort((a, b) => a.distance - b.distance);

            if (cracksUpToDay.length < 2) return null;

            let totalSpacing = 0;
            for (let i = 1; i < cracksUpToDay.length; i++) {
                totalSpacing += (cracksUpToDay[i].distance - cracksUpToDay[i - 1].distance);
            }
            return totalSpacing / (cracksUpToDay.length - 1);
        });

        const colors = ['#2563eb', '#dc2626', '#16a34a', '#8b5cf6', '#f59e0b', '#0ea5e9', '#db2777', '#14b8a6'];

        return {
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'lines+markers',
            name: sec.name,
            line: { width: 3, color: sec.color || colors[idx % colors.length] },
            marker: { size: 8 },
            connectgaps: true // connect lines even if some days have no spacing (e.g. < 2 cracks)
        };
    });

    return (
        <div className="card">
            <h2 className="title">Crack Spacing</h2>
            <Plot
                data={data}
                layout={{
                    autosize: true,
                    margin: { l: 60, r: 30, t: 30, b: 70 },
                    xaxis: {
                        title: { text: '<b>Age (Survey Days)</b>', font: { size: 16, color: 'black' } },
                        tickfont: { size: 14, color: 'black' },
                        showline: true, linewidth: 1, linecolor: 'black', mirror: 'all', ticks: 'inside',
                    },
                    yaxis: {
                        title: { text: '<b>Average Crack Spacing (ft)</b>', font: { size: 16, color: 'black' } },
                        tickfont: { size: 14, color: 'black' },
                        showline: true, linewidth: 1, linecolor: 'black', mirror: 'all', ticks: 'inside',
                        rangemode: 'tozero'
                    },
                    legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center', font: { color: 'black', size: 14 }, bordercolor: 'black', borderwidth: 1 }
                }}
                useResizeHandler={true}
                config={{
                    modeBarButtonsToRemove: ['toImage'],
                    modeBarButtonsToAdd: [{
                        name: 'Download plot as a png',
                        icon: Plotly.Icons.camera,
                        click: function(gd) {
                            const visibleData = gd.data.filter(d => d.visible !== 'legendonly');
                            Plotly.downloadImage(
                                { data: visibleData, layout: gd.layout }, 
                                { format: 'png', filename: 'chart' }
                            );
                        }
                    }]
                }}

                style={{ width: "100%", height: "450px" }}
            />
        </div>
    );
};

export default CrackSpacingChart;
