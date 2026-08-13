export const exportPlotlyDataToCsv = (gd, filenamePrefix) => {
    if (!gd || !gd.data || gd.data.length === 0) return;
    
    const visibleData = gd.data.filter(d => d.visible !== 'legendonly');
    if (visibleData.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    const isBoxPlot = visibleData[0].type === 'box';
    
    if (isBoxPlot) {
        const headers = visibleData.map(d => `"${(d.name || 'Value').replace(/"/g, '""')}"`);
        csvContent += headers.join(",") + "\n";
        
        let maxLen = 0;
        visibleData.forEach(d => {
            if (d.y && d.y.length > maxLen) maxLen = d.y.length;
        });
        
        for (let i = 0; i < maxLen; i++) {
            const row = visibleData.map(d => (d.y && d.y[i] !== undefined && d.y[i] !== null) ? d.y[i] : "");
            csvContent += row.join(",") + "\n";
        }
    } else {
        const xTitle = (gd.layout && gd.layout.xaxis && gd.layout.xaxis.title && gd.layout.xaxis.title.text) 
            ? gd.layout.xaxis.title.text.replace(/<[^>]+>/g, '') // remove HTML tags
            : "X";
            
        const headers = [xTitle, ...visibleData.map(d => (d.name || 'Value'))].map(h => `"${h.replace(/"/g, '""')}"`);
        csvContent += headers.join(",") + "\n";
        
        const xValues = visibleData[0].x || [];
        for (let i = 0; i < xValues.length; i++) {
            const row = [`"${String(xValues[i]).replace(/"/g, '""')}"`];
            for (let j = 0; j < visibleData.length; j++) {
                const yVal = (visibleData[j].y && visibleData[j].y[i] !== undefined && visibleData[j].y[i] !== null) ? visibleData[j].y[i] : "";
                row.push(yVal);
            }
            csvContent += row.join(",") + "\n";
        }
    }
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = `${filenamePrefix.replace(/\s+/g, '-').toLowerCase()}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const exportCracksToCsv = (cracks, surveyDays, sections, visibleDays, filenamePrefix) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["Crack ID", "Distance (DMI)", "Survey Day", "Section"];
    csvContent += headers.map(h => `"${h}"`).join(",") + "\n";

    // Filter cracks by visible days
    const activeCracks = cracks.filter(c => visibleDays.includes(c.day_id));
    
    activeCracks.forEach(c => {
        const day = surveyDays.find(d => d.id === c.day_id);
        const section = sections.find(s => c.distance >= s.start_station && c.distance <= s.end_station);
        
        const row = [
            c.id || "",
            c.distance,
            day ? day.name : c.day_id,
            section ? section.name : "N/A"
        ];
        csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = `${filenamePrefix.replace(/\s+/g, '-').toLowerCase()}-data.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
