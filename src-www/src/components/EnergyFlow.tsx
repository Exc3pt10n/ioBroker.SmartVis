import { formatPower, type FlowSnapshot } from '../energy';

/** Ab dieser Leistung gilt eine Leitung als "aktiv" (Rauschen ausblenden) */
const THRESHOLD_W = 20;

interface Node {
    key: string;
    label: string;
    x: number;
    y: number;
    icon: string;
}

// Layout: PV oben, Netz links, Haus rechts, Batterie unten, Knoten in der Mitte
const NODES: Record<string, Node> = {
    pv: { key: 'pv', label: 'PV', x: 160, y: 46, icon: '☀️' },
    grid: { key: 'grid', label: 'Netz', x: 46, y: 160, icon: '🔌' },
    home: { key: 'home', label: 'Haus', x: 274, y: 160, icon: '🏠' },
    battery: { key: 'battery', label: 'Batterie', x: 160, y: 274, icon: '🔋' },
    car: { key: 'car', label: 'Auto', x: 274, y: 274, icon: '🚗' },
};
const HUB = { x: 160, y: 160 };
const R = 40;

/** Leitung zwischen Knoten und Mitte; direction: 'in' = zum Hub, 'out' = vom Hub weg */
function Line({ node, power, direction }: { node: Node; power: number; direction: 'in' | 'out' }): React.JSX.Element {
    const active = power >= THRESHOLD_W;
    const dx = HUB.x - node.x;
    const dy = HUB.y - node.y;
    const len = Math.hypot(dx, dy);
    const sx = node.x + (dx / len) * R;
    const sy = node.y + (dy / len) * R;
    const [x1, y1, x2, y2] = direction === 'in' ? [sx, sy, HUB.x, HUB.y] : [HUB.x, HUB.y, sx, sy];
    return (
        <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={`flow__line${active ? ' flow__line--active' : ''} flow__line--${node.key}`}
        />
    );
}

/** Kurzfassung der Lage: Überschuss, Bezug oder ausgeglichen – mit Autarkie jetzt und Batterie */
export function flowSummary(
    flow: FlowSnapshot,
    remainingMin?: number,
): { tone: 'surplus' | 'import' | 'neutral'; text: string; details: string[] } {
    const gi = flow.gridImport ?? 0;
    const ge = flow.gridExport ?? 0;
    const charge = flow.batteryCharge ?? 0;
    const discharge = flow.batteryDischarge ?? 0;
    const consumption = (flow.home ?? 0) + (flow.car ?? 0);
    let tone: 'surplus' | 'import' | 'neutral' = 'neutral';
    let text: string;
    if (gi >= 50) {
        tone = 'import';
        text = `⚡ Netzbezug ${formatPower(gi)}`;
    } else if (ge >= 50) {
        tone = 'surplus';
        text = `☀️ Überschuss ${formatPower(ge)} wird eingespeist`;
    } else if (charge >= 50 && (flow.pv ?? 0) >= 50) {
        tone = 'surplus';
        text = `☀️ Überschuss lädt die Batterie`;
    } else if ((flow.pv ?? 0) >= 50) {
        text = '☀️ Solarstrom deckt den Verbrauch';
    } else if (discharge >= 50) {
        text = '🔋 Batterie versorgt das Haus';
    } else {
        text = '⚖️ Ausgeglichen';
    }
    const details: string[] = [];
    if (consumption >= THRESHOLD_W) {
        details.push(`Autarkie jetzt ${Math.round((1 - Math.min(gi, consumption) / consumption) * 100)} %`);
    }
    if (charge >= THRESHOLD_W || discharge >= THRESHOLD_W) {
        const charging = charge >= discharge;
        const time =
            remainingMin && remainingMin > 0
                ? ` · ${charging ? 'voll' : 'leer'} in ca. ${
                      remainingMin >= 60
                          ? `${Math.floor(remainingMin / 60)} h ${Math.round(remainingMin % 60)} min`
                          : `${Math.round(remainingMin)} min`
                  }`
                : '';
        details.push(`🔋 ${charging ? 'lädt' : 'entlädt'}${time}`);
    }
    return { tone, text, details };
}

export function FlowStatus({ flow, remainingMin }: { flow: FlowSnapshot; remainingMin?: number }): React.JSX.Element {
    const { tone, text, details } = flowSummary(flow, remainingMin);
    return (
        <div
            className={`flowstatus flowstatus--${tone}`}
            role="status"
        >
            <span className="flowstatus__main">{text}</span>
            {details.length > 0 && <span className="flowstatus__details">{details.join(' · ')}</span>}
        </div>
    );
}

const NODE_TITLES: Record<string, string> = {
    pv: 'PV-Verlauf anzeigen',
    grid: 'Netz-Verlauf anzeigen',
    home: 'Verbrauchs-Verlauf anzeigen',
    battery: 'Batterie-Verlauf anzeigen',
    car: 'Wallbox-Verlauf anzeigen',
};

export function EnergyFlow({
    flow,
    onSelect,
}: {
    flow: FlowSnapshot;
    /** Antippen eines Kreises (z. B. passenden Verlauf zeigen) */
    onSelect?: (node: 'pv' | 'grid' | 'home' | 'battery' | 'car') => void;
}): React.JSX.Element {
    const gridIn = (flow.gridImport ?? 0) >= (flow.gridExport ?? 0);
    const gridPower = gridIn ? (flow.gridImport ?? 0) : (flow.gridExport ?? 0);
    const batOut = (flow.batteryDischarge ?? 0) >= (flow.batteryCharge ?? 0);
    const batPower = batOut ? (flow.batteryDischarge ?? 0) : (flow.batteryCharge ?? 0);

    const hasCar = flow.car !== undefined;
    const nodes = Object.values(NODES).filter(n => n.key !== 'car' || hasCar);
    const values: Record<string, { value: string; sub?: string }> = {
        car: {
            value: `${flow.carEstimated ? '≈ ' : ''}${formatPower(flow.car)}`,
            sub: (flow.car ?? 0) >= THRESHOLD_W ? (flow.carEstimated ? 'lädt · geschätzt' : 'lädt') : undefined,
        },
        pv: { value: formatPower(flow.pv) },
        grid: {
            value: formatPower(gridPower),
            sub: gridPower < THRESHOLD_W ? undefined : gridIn ? 'Bezug' : 'Einspeisung',
        },
        home: { value: formatPower(flow.home) },
        battery: {
            value: flow.soc !== undefined ? `${Math.round(flow.soc)} %` : formatPower(batPower),
            sub: batPower < THRESHOLD_W ? undefined : `${batOut ? 'entlädt' : 'lädt'} ${formatPower(batPower)}`,
        },
    };

    return (
        <>
            {flowSvg()}
            {flow.pvParts && flow.pvParts.length > 1 && (
                <p className="flow__split">☀️ {flow.pvParts.map(p => `${p.label} ${formatPower(p.w)}`).join(' · ')}</p>
            )}
        </>
    );

    function flowSvg(): React.JSX.Element {
        return (
            <svg
                viewBox="0 0 320 320"
                className="flow"
                role="img"
                aria-label="Energiefluss"
            >
                <Line
                    node={NODES.pv}
                    power={flow.pv ?? 0}
                    direction="in"
                />
                <Line
                    node={NODES.grid}
                    power={gridPower}
                    direction={gridIn ? 'in' : 'out'}
                />
                <Line
                    node={NODES.battery}
                    power={batPower}
                    direction={batOut ? 'in' : 'out'}
                />
                <Line
                    node={NODES.home}
                    power={flow.home ?? 0}
                    direction="out"
                />
                {hasCar && (
                    <Line
                        node={NODES.car}
                        power={flow.car ?? 0}
                        direction="out"
                    />
                )}
                <circle
                    cx={HUB.x}
                    cy={HUB.y}
                    r={5}
                    className="flow__hub"
                />
                {nodes.map(n => (
                    <g
                        key={n.key}
                        className={`flow__node flow__node--${n.key}${onSelect ? ' flow__node--link' : ''}`}
                        {...(onSelect
                            ? {
                                  role: 'button',
                                  tabIndex: 0,
                                  'aria-label': `${n.label} ${values[n.key].value}: ${NODE_TITLES[n.key]}`,
                                  onClick: () => onSelect(n.key as 'pv'),
                                  onKeyDown: (e: React.KeyboardEvent) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          onSelect(n.key as 'pv');
                                      }
                                  },
                              }
                            : {})}
                    >
                        {onSelect && <title>{NODE_TITLES[n.key]}</title>}
                        <circle
                            cx={n.x}
                            cy={n.y}
                            r={R}
                        />
                        <text
                            x={n.x}
                            y={n.y - 12}
                            className="flow__icon"
                        >
                            {n.icon}
                        </text>
                        <text
                            x={n.x}
                            y={n.y + 8}
                            className="flow__value"
                        >
                            {values[n.key].value}
                        </text>
                        <text
                            x={n.x}
                            y={n.y + 22}
                            className="flow__label"
                        >
                            {values[n.key].sub ?? n.label}
                        </text>
                    </g>
                ))}
            </svg>
        );
    }
}
