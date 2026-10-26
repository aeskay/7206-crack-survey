export const calculateSpacingStats = (cracks, startStation, endStation) => {
    if (!cracks || cracks.length === 0) {
        return { avgSpacing: "-", stdDev: "-" };
    }

    let sortedDists = cracks.map(c => c.distance);
    sortedDists = Array.from(new Set(sortedDists)).sort((a, b) => a - b);
    
    if (startStation !== undefined && endStation !== undefined && startStation !== null && endStation !== null) {
        const distsSet = new Set(sortedDists);
        if (!distsSet.has(startStation)) sortedDists.unshift(startStation);
        if (!distsSet.has(endStation)) sortedDists.push(endStation);
        sortedDists.sort((a, b) => a - b);
    }

    const spacings = [];
    for (let i = 1; i < sortedDists.length; i++) {
        const sp = sortedDists[i] - sortedDists[i - 1];
        if (sp > 0) spacings.push(sp);
    }

    if (spacings.length === 0) {
        return { avgSpacing: "-", stdDev: "-" };
    }

    const avg = spacings.reduce((a, b) => a + b, 0) / spacings.length;
    let stdDev = 0;

    if (spacings.length > 1) {
        const squareDiffs = spacings.map(s => Math.pow(s - avg, 2));
        const variance = squareDiffs.reduce((a, b) => a + b, 0) / (spacings.length - 1);
        stdDev = Math.sqrt(variance);
    }

    return {
        avgSpacing: avg.toFixed(1),
        stdDev: stdDev.toFixed(1)
    };
};
