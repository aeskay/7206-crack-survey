import React, { useState, useRef } from 'react';

// --- Constants for the internal SVG coordinate system ---
const VB_WIDTH = 1000;      // viewBox internal width (scales to container)
const VB_HEIGHT = 215;      // enough to fit labels above and below bar
const PADDING = 40;
const BAR_Y = 50;           // top gap for two-line section labels
const BAR_HEIGHT = 100;     // bar height
const LABEL_Y = BAR_Y - 22; // section name (line 1)
const STEEL_Y = BAR_Y - 10; // steel ratio (line 2)
const STATION_Y = BAR_Y + BAR_HEIGHT + 28;  // numbers well below bar
const AXIS_LABEL_Y = STATION_Y + 22;        // 'Station (ft)' below numbers
const CRACK_STROKE = 0.8;   // thin enough to stay crisp at any zoom


// Mini chart constants
const MINI_VB_WIDTH = 1000;
const MINI_VB_HEIGHT = 200;
const MINI_PADDING = 40;
const MINI_BAR_Y = 50;
const MINI_BAR_H = 100;
const MINI_STATION_Y = MINI_BAR_Y + MINI_BAR_H + 26;
const MINI_AXIS_Y = MINI_STATION_Y + 20;


const scale = (dist, total) =>
    (dist / total) * (VB_WIDTH - 2 * PADDING) + PADDING;

// Pick a round tick interval based on the span being displayed
const getTickInterval = (span) => {
    if (span <= 50) return 5;
    if (span <= 150) return 10;
    if (span <= 400) return 20;
    if (span <= 1000) return 50;
    if (span <= 3000) return 100;
    return 200;
};

// Generate an array of tick values covering [start, end] at given interval
const getTicks = (start, end, interval) => {
    const first = Math.ceil(start / interval) * interval;
    const ticks = [];
    for (let t = first; t <= end; t += interval) ticks.push(t);
    return ticks;
};

// ── Per-section mini chart (ref forwarded to SVG for download) ────────────
const SectionMiniChart = React.forwardRef(({ section, cracks, surveyDays, visibleDays, zoom = 1 }, ref) => {
    const secLength = section.end_station - section.start_station;
    const TICK_Y = MINI_BAR_Y + MINI_BAR_H + 16;
    const COUNT_Y = MINI_BAR_Y + MINI_BAR_H + 34;

    const miniScale = (dist) =>
        ((dist - section.start_station) / secLength) *
        (MINI_VB_WIDTH - 2 * MINI_PADDING) + MINI_PADDING;

    const sectionCracks = cracks.filter(
        (c) =>
            c.distance >= section.start_station &&
            c.distance <= section.end_station &&
            visibleDays.includes(c.day_id)
    );

    const interval = getTickInterval(secLength);
    const ticks = getTicks(section.start_station, section.end_station, interval);

    return (
        <div style={{ overflowX: zoom > 1 ? 'auto' : 'hidden', borderRadius: '6px' }}>
            <svg
                ref={ref}
                width={`${zoom * 100}%`}
                viewBox={`0 0 ${MINI_VB_WIDTH} ${MINI_BAR_Y + MINI_BAR_H + 44}`}
                style={{ display: 'block', background: '#f8fafc', minWidth: zoom > 1 ? `${zoom * 100}%` : undefined }}
                preserveAspectRatio="none"
            >
                <rect
                    x={MINI_PADDING} y={MINI_BAR_Y}
                    width={MINI_VB_WIDTH - 2 * MINI_PADDING}
                    height={MINI_BAR_H}
                    fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" rx="4"
                />
                {ticks.map(t => (
                    <g key={t}>
                        <line x1={miniScale(t)} y1={MINI_BAR_Y} x2={miniScale(t)} y2={MINI_BAR_Y + MINI_BAR_H}
                            stroke="rgba(0,0,0,0.1)" strokeWidth="0.6" />
                        <text x={miniScale(t)} y={TICK_Y} fontSize="11" textAnchor="middle" fill="#64748b">{t}</text>
                    </g>
                ))}
                <text x={MINI_PADDING} y={TICK_Y} fontSize="11" textAnchor="middle" fill="#94a3b8">{section.start_station}</text>
                <text x={MINI_VB_WIDTH - MINI_PADDING} y={TICK_Y} fontSize="11" textAnchor="middle" fill="#94a3b8">{section.end_station}</text>
                {sectionCracks.map((crack, idx) => {
                    const day = surveyDays.find((d) => d.id === crack.day_id);
                    return (
                        <line key={idx}
                            x1={miniScale(crack.distance)} y1={MINI_BAR_Y + 6}
                            x2={miniScale(crack.distance)} y2={MINI_BAR_Y + MINI_BAR_H - 6}
                            stroke={day ? day.color : '#000'} strokeWidth={CRACK_STROKE}
                        />
                    );
                })}
                <text x={MINI_VB_WIDTH / 2} y={COUNT_Y} fontSize="12" textAnchor="middle" fill="#94a3b8">
                    Station (ft)
                </text>
            </svg>
        </div>
    );
});


const drawLegendOntoCanvas = (ctx, startX, startY, scale, surveyDays, visibleDays) => {
    const daysToDraw = surveyDays.filter(d => visibleDays.includes(d.id));
    if (daysToDraw.length === 0) return;

    let currentX = startX;

    ctx.font = `bold ${12 * scale}px sans-serif`;
    ctx.fillStyle = "#475569";
    ctx.fillText("Days:", currentX, startY + (13 * scale));
    currentX += 45 * scale;

    daysToDraw.forEach(day => {
        ctx.font = `bold ${10 * scale}px sans-serif`;
        const tw = ctx.measureText(day.name).width;
        const boxW = tw + (20 * scale);
        const boxH = 20 * scale;
        const r = 10 * scale;

        ctx.fillStyle = day.color || '#000';
        ctx.beginPath();
        ctx.roundRect(currentX, startY, boxW, boxH, r);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.fillText(day.name, currentX + (10 * scale), startY + (14 * scale));

        currentX += boxW + (8 * scale);
    });
};

// ── Main chart ──────────────────────────────────────────────────────────────
const PavementChart = ({ sections, cracks, surveyDays }) => {
    const totalLength =
        sections.length > 0 ? sections[sections.length - 1].end_station : 1000;

    const [visibleDays, setVisibleDays] = useState(() => surveyDays.map((d) => d.id));
    // expandedSections: { [idx]: { open: bool, zoom: number } }
    const [expandedSections, setExpandedSections] = useState({});
    const [zoom, setZoom] = useState(1);
    const svgRef = useRef(null);

    const downloadChart = () => {
        const svg = svgRef.current;
        if (!svg) return;
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(svg);
        const scale = 3;
        const w = VB_WIDTH * scale;
        const svgH = VB_HEIGHT * scale;
        const legendPad = 40 * scale;
        const h = svgH + legendPad;

        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, svgH);

            drawLegendOntoCanvas(ctx, 20 * scale, svgH + (10 * scale), scale, surveyDays, visibleDays);

            URL.revokeObjectURL(url);
            const link = document.createElement('a');
            link.download = 'crack-survey-overview.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = url;
    };

    // Per-section download refs & helper
    const sectionSvgRefs = useRef({});
    const downloadSectionChart = (idx, sectionName) => {
        const svg = sectionSvgRefs.current[idx];
        if (!svg) return;
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(svg);
        const scale = 3;
        const w = MINI_VB_WIDTH * scale;
        const svgH = (MINI_BAR_Y + MINI_BAR_H + 44) * scale;
        const legendPad = 40 * scale;
        const h = svgH + legendPad;

        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, svgH);

            drawLegendOntoCanvas(ctx, MINI_PADDING * scale, svgH + (10 * scale), scale, surveyDays, visibleDays);

            URL.revokeObjectURL(url);
            const link = document.createElement('a');
            link.download = `crack-survey-${sectionName.replace(/\s+/g, '-').toLowerCase()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = url;
    };

    // Keep newly-added days visible automatically
    React.useEffect(() => {
        setVisibleDays((prev) => {
            const newIds = surveyDays.map((d) => d.id).filter((id) => !prev.includes(id));
            return newIds.length ? [...prev, ...newIds] : prev;
        });
    }, [surveyDays]);

    const toggleDay = (dayId) =>
        setVisibleDays((prev) =>
            prev.includes(dayId) ? prev.filter((id) => id !== dayId) : [...prev, dayId]
        );

    const toggleSection = (idx) =>
        setExpandedSections((prev) => ({
            ...prev,
            [idx]: { open: !prev[idx]?.open, zoom: prev[idx]?.zoom ?? 1 }
        }));

    const setSectionZoom = (idx, z) =>
        setExpandedSections((prev) => ({
            ...prev,
            [idx]: { ...prev[idx], zoom: z }
        }));

    const visibleCracks = cracks.filter((c) => visibleDays.includes(c.day_id));
    const totalCracks = visibleCracks.length;
    const totalAvgSpacing = totalCracks > 0 ? (totalLength / totalCracks).toFixed(1) : '—';

    return (
        <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 className="title" style={{ margin: 0 }}>Project Overview</h2>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <span
                            style={{
                                background: '#3b82f6',
                                color: '#fff',
                                borderRadius: '999px',
                                padding: '0.1rem 0.6rem',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                            }}
                        >
                            {totalCracks} cracks
                        </span>
                        <span
                            style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#475569',
                                borderRadius: '999px',
                                padding: '0.1rem 0.6rem',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                            }}
                        >
                            Average Spacing: {totalAvgSpacing} ft
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Zoom slider + Download ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                    Zoom: {zoom}×
                </span>
                <input
                    type="range" min="1" max="20" step="0.5" value={zoom}
                    onChange={e => setZoom(Number(e.target.value))}
                    style={{ flex: 1, cursor: 'pointer', height: '4px', accentColor: 'var(--primary)' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Scroll →</span>
                <button
                    onClick={downloadChart}
                    title="Download chart as PNG"
                    style={{
                        padding: '0.3rem 0.75rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                    }}
                >
                    ⬇ Download PNG
                </button>
            </div>

            {/* ── Main overview chart — scrollable when zoomed ── */}
            <div style={{ overflowX: zoom > 1 ? 'auto' : 'hidden', borderRadius: '8px' }}>
                <svg
                    ref={svgRef}
                    width={`${zoom * 100}%`}
                    viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
                    style={{ display: 'block', background: '#f1f5f9', minWidth: zoom > 1 ? `${zoom * 100}%` : undefined }}
                    preserveAspectRatio="none"
                >
                    {/* Pavement bar */}
                    <rect
                        x={PADDING}
                        y={BAR_Y}
                        width={VB_WIDTH - 2 * PADDING}
                        height={BAR_HEIGHT}
                        fill="#ffffff"
                        stroke="#cbd5e1"
                        strokeWidth="1.5"
                        rx="4"
                    />

                    {/* Outer station labels */}
                    <text x={PADDING} y={BAR_Y - 10} fontSize="11" textAnchor="middle" fill="#475569">
                        0
                    </text>
                    <text x={VB_WIDTH - PADDING} y={BAR_Y - 10} fontSize="11" textAnchor="middle" fill="#475569">
                        {totalLength}
                    </text>

                    {/* Section boundaries & labels */}
                    {sections.map((sec, idx) => (
                        <g key={idx}>
                            <line
                                x1={scale(sec.end_station, totalLength)}
                                y1={BAR_Y - 12}
                                x2={scale(sec.end_station, totalLength)}
                                y2={BAR_Y + BAR_HEIGHT}
                                stroke="#1e293b"
                                strokeWidth="2"
                                strokeDasharray="5"
                            />
                            <text
                                x={scale(
                                    sec.start_station + (sec.end_station - sec.start_station) / 2,
                                    totalLength
                                )}
                                y={LABEL_Y}
                                fontSize="10"
                                textAnchor="middle"
                                fill="#475569"
                                fontWeight="600"
                            >
                                {sec.name}
                            </text>
                            <text
                                x={scale(
                                    sec.start_station + (sec.end_station - sec.start_station) / 2,
                                    totalLength
                                )}
                                y={STEEL_Y}
                                fontSize="8"
                                textAnchor="middle"
                                fill="#94a3b8"
                            >
                                Steel: {sec.steel_ratio ?? 0}%
                            </text>
                            <text
                                x={scale(sec.start_station, totalLength)}
                                y={STATION_Y}
                                fontSize="11"
                                textAnchor="middle"
                                fill="#64748b"
                            >
                                {sec.start_station}
                            </text>
                        </g>
                    ))}

                    {/* Station (ft) axis label */}
                    <text
                        x={VB_WIDTH / 2}
                        y={AXIS_LABEL_Y}
                        fontSize="12"
                        textAnchor="middle"
                        fill="#94a3b8"
                    >
                        Station (ft)
                    </text>

                    {/* Minor gridlines every 10 ft — no labels */}
                    {getTicks(0, totalLength, 10).map(t => (
                        <line
                            key={`minor-${t}`}
                            x1={scale(t, totalLength)} y1={BAR_Y}
                            x2={scale(t, totalLength)} y2={BAR_Y + BAR_HEIGHT}
                            stroke="rgba(0,0,0,0.05)" strokeWidth="0.4"
                        />
                    ))}

                    {/* Gridlines + tick labels for overview */}
                    {(() => {
                        const interval = getTickInterval(totalLength);
                        const ticks = getTicks(0, totalLength, interval);
                        return ticks.map(t => (
                            <g key={t}>
                                <line
                                    x1={scale(t, totalLength)} y1={BAR_Y}
                                    x2={scale(t, totalLength)} y2={BAR_Y + BAR_HEIGHT}
                                    stroke="rgba(0,0,0,0.08)" strokeWidth="0.5"
                                />
                                <text
                                    x={scale(t, totalLength)}
                                    y={BAR_Y + BAR_HEIGHT + 14}
                                    fontSize="9"
                                    textAnchor="middle"
                                    fill="#94a3b8"
                                >{t}</text>
                            </g>
                        ));
                    })()}

                    {/* Crack lines */}
                    {visibleCracks.map((crack, idx) => {
                        const day = surveyDays.find((d) => d.id === crack.day_id);
                        return (
                            <line
                                key={idx}
                                x1={scale(crack.distance, totalLength)}
                                y1={BAR_Y + 8}
                                x2={scale(crack.distance, totalLength)}
                                y2={BAR_Y + BAR_HEIGHT - 8}
                                stroke={day ? day.color : '#000'}
                                strokeWidth={CRACK_STROKE}
                            />
                        );
                    })}
                </svg>
            </div>

            {/* ── Day toggles ── */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: '#475569', fontWeight: 600 }}>
                    Days:
                </span>
                {surveyDays.map((day) => {
                    const isVisible = visibleDays.includes(day.id);
                    return (
                        <button
                            key={day.id}
                            onClick={() => toggleDay(day.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.3rem 0.9rem',
                                borderRadius: '999px',
                                border: `2px solid ${day.color}`,
                                background: isVisible ? day.color : 'transparent',
                                color: isVisible ? '#fff' : day.color,
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                                opacity: isVisible ? 1 : 0.55,
                            }}
                        >
                            {isVisible ? '✓' : '○'} {day.name}
                        </button>
                    );
                })}
            </div>

            {/* ── Collapsible per-section detail charts ── */}
            {sections.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                        Section Detail Views
                    </h3>
                    {sections.map((sec, idx) => {
                        const secState = expandedSections[idx] ?? { open: false, zoom: 1 };
                        const isOpen = secState.open;
                        const secZoom = secState.zoom;
                        const secCrackCount = cracks.filter(
                            (c) =>
                                c.distance >= sec.start_station &&
                                c.distance <= sec.end_station &&
                                visibleDays.includes(c.day_id)
                        ).length;

                        const avgSpacing = secCrackCount > 0 ? ((sec.end_station - sec.start_station) / secCrackCount).toFixed(1) : '—';

                        return (
                            <div
                                key={idx}
                                style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    marginBottom: '0.75rem',
                                    overflow: 'hidden',
                                }}
                            >
                                <button
                                    onClick={() => toggleSection(idx)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.75rem 1rem',
                                        background: isOpen ? '#e0f2fe' : '#f8fafc',
                                        border: 'none',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background 0.2s',
                                    }}
                                >

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{sec.name}</span>
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                            Sta. {sec.start_station} – {sec.end_station}
                                        </span>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <span
                                                style={{
                                                    background: '#10b981',
                                                    color: '#fff',
                                                    borderRadius: '999px',
                                                    padding: '0.1rem 0.5rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                Steel: {sec.steel_ratio ?? 0}%
                                            </span>
                                            <span
                                                style={{
                                                    background: '#3b82f6',
                                                    color: '#fff',
                                                    borderRadius: '999px',
                                                    padding: '0.1rem 0.5rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {secCrackCount} cracks
                                            </span>
                                            <span
                                                style={{
                                                    background: '#f8fafc',
                                                    border: '1px solid #cbd5e1',
                                                    color: '#475569',
                                                    borderRadius: '999px',
                                                    padding: '0.1rem 0.5rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                Average Spacing: {avgSpacing} ft
                                            </span>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '1.1rem', color: '#64748b' }}>
                                        {isOpen ? '▲' : '▼'}
                                    </span>
                                </button>

                                {isOpen && (
                                    <div style={{ padding: '0.75rem 1rem', background: '#fff' }}>
                                        {/* Per-section zoom slider + Download button */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                                                Zoom: {secZoom}×
                                            </span>
                                            <input
                                                type="range" min="1" max="20" step="0.5" value={secZoom}
                                                onChange={e => setSectionZoom(idx, Number(e.target.value))}
                                                style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--primary)' }}
                                            />
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Scroll →</span>
                                            <button
                                                onClick={() => downloadSectionChart(idx, sec.name)}
                                                style={{
                                                    padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 600,
                                                    background: '#2563eb', color: '#fff', border: 'none',
                                                    borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap'
                                                }}
                                            >
                                                ⬇ Download PNG
                                            </button>
                                        </div>
                                        <SectionMiniChart
                                            ref={el => sectionSvgRefs.current[idx] = el}
                                            section={sec}
                                            cracks={cracks}
                                            surveyDays={surveyDays}
                                            visibleDays={visibleDays}
                                            zoom={secZoom}
                                        />
                                        {/* Toggle Days — same controls as overview */}
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>Days:</span>
                                            {surveyDays.map(day => {
                                                const isVisible = visibleDays.includes(day.id);
                                                return (
                                                    <button
                                                        key={day.id}
                                                        onClick={() => toggleDay(day.id)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                            padding: '0.2rem 0.7rem', borderRadius: '999px',
                                                            border: `2px solid ${day.color}`,
                                                            background: isVisible ? day.color : 'transparent',
                                                            color: isVisible ? '#fff' : day.color,
                                                            cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                                            transition: 'all 0.2s ease',
                                                            opacity: isVisible ? 1 : 0.55,
                                                        }}
                                                    >
                                                        {isVisible ? '✓' : '○'} {day.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PavementChart;
