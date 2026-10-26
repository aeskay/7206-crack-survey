/**
 * Extract an elapsed day number from a survey day object.
 * Checks day.name for digits (e.g. "Day 7" -> 7).
 * If no digits, calculates elapsed days between startDateTime and day.date.
 * Fallbacks to defaultIndex.
 *
 * @param {Object} day
 * @param {number} defaultIndex
 * @param {string} [startDateTime]
 * @returns {number}
 */
export function getSurveyDayNumber(day, defaultIndex, startDateTime) {
    if (!day) return defaultIndex;

    // Check name for numbers (e.g. "Day 2", "Day 138")
    const match = String(day.name).match(/\d+/);
    if (match) {
        return parseInt(match[0], 10);
    }

    // If day has date attribute and startDateTime is provided
    if (day.date && startDateTime) {
        const startDateOnly = startDateTime.split(' ')[0];
        const startMs = new Date(startDateOnly + 'T00:00:00').getTime();
        const dayMs = new Date(day.date + 'T00:00:00').getTime();
        if (!isNaN(startMs) && !isNaN(dayMs)) {
            const diffDays = Math.round((dayMs - startMs) / (24 * 60 * 60 * 1000));
            return Math.max(0, diffDays);
        }
    }

    return defaultIndex;
}

/**
 * Map elapsed day D to the X-axis coordinate matching survey days.
 * @param {number} dayVal - Elapsed days of the temperature reading (e.g. 2.0, 2.5, 7.0)
 * @param {Array<{ index: number, dayNum: number }>} surveyDayMapping
 * @returns {number|null} X coordinate on the chart
 */
export function mapDayToChartX(dayVal, surveyDayMapping) {
    if (!surveyDayMapping || surveyDayMapping.length === 0) return null;
    if (surveyDayMapping.length === 1) return surveyDayMapping[0].index;

    const first = surveyDayMapping[0];
    const last = surveyDayMapping[surveyDayMapping.length - 1];

    // Before first survey day: extrapolate backwards
    if (dayVal <= first.dayNum) {
        const next = surveyDayMapping[1];
        const span = next.dayNum - first.dayNum;
        if (span <= 0) return first.index;
        return first.index - ((first.dayNum - dayVal) / span) * (next.index - first.index);
    }

    // After last survey day: extrapolate forwards
    if (dayVal >= last.dayNum) {
        const prev = surveyDayMapping[surveyDayMapping.length - 2];
        const span = last.dayNum - prev.dayNum;
        if (span <= 0) return last.index;
        return last.index + ((dayVal - last.dayNum) / span) * (last.index - prev.index);
    }

    // Between two survey days: find segment
    for (let i = 0; i < surveyDayMapping.length - 1; i++) {
        const d0 = surveyDayMapping[i];
        const d1 = surveyDayMapping[i + 1];
        if (dayVal >= d0.dayNum && dayVal <= d1.dayNum) {
            const span = d1.dayNum - d0.dayNum;
            const fraction = span > 0 ? (dayVal - d0.dayNum) / span : 0;
            return d0.index + fraction * (d1.index - d0.index);
        }
    }

    return null;
}
