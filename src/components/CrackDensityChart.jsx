import React from 'react';
import Plot from 'react-plotly.js';

const CrackDensityChart = ({ cracks, surveyDays, sections }) => {
    if (!cracks || cracks.length === 0 || sections.length === 0 || surveyDays.length === 0) return null;

    const sectionNames = sections.map(sec => sec.name);

    // Create a trace for each survey day
    const data = surveyDays.map((day, dayIndex) => {
        // Calculate the crack count for this specific day across all sections
        const yValues = sections.map(sec => {
            // Count ONLY the cracks that occurred ON this survey day, not cumulative?
            // User requested: "total number of cracks per section, segmented by Survey Day."
            // This usually implies a stacked bar chart showing new cracks per day, OR grouped bars.
            // Let's do cumulative up to that day as grouped bars to be safe, or just discrete counts.
            // Let's make it the absolute count of cracks added ON that day, stacking them to show total growth.
            // Grouped bars: discrete or cumulative? Discrete per day is easiest to read for density.
            const secCracks = cracks.filter(c =>
                c.distance >= sec.start_station &&
                c.distance <= sec.end_station &&
                String(c.day_id) === String(day.id)
            );
            return secCracks.length;
        });

        return {
            x: sectionNames,
            y: yValues,
            name: day.name,
            type: 'bar',
            marker: { color: day.color }
        };
    });

    return (
        <div className="card">
            <h2 className="title">Crack Density per Section (Stacked)</h2>
            <Plot
                data={data}
                layout={{
                    autosize: true,
                    barmode: 'stack', // Stacked bars make it easy to see total + what day contributed what
                    margin: { l: 60, r: 30, t: 30, b: 70 },
                    xaxis: {
                        title: { text: '<b>Pavement Section</b>', font: { size: 16 } },
                    },
                    yaxis: {
                        title: { text: '<b>Number of Cracks</b>', font: { size: 16 } },
                    },
                    legend: { orientation: 'h', y: -0.25 }
                }}
                useResizeHandler={true}
                style={{ width: "100%", height: "450px" }}
            />
        </div>
    );
};

export default CrackDensityChart;
