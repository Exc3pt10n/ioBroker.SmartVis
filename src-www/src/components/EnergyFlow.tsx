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

export function EnergyFlow({ flow }: { flow: FlowSnapshot }): React.JSX.Element {
    const gridIn = (flow.gridImport ?? 0) >= (flow.gridExport ?? 0);
    const gridPower = gridIn ? (flow.gridImport ?? 0) : (flow.gridExport ?? 0);
    const batOut = (flow.batteryDischarge ?? 0) >= (flow.batteryCharge ?? 0);
    const batPower = batOut ? (flow.batteryDischarge ?? 0) : (flow.batteryCharge ?? 0);

    const hasCar = flow.car !== undefined;
    const nodes = Object.values(NODES).filter(n => n.key !== 'car' || hasCar);
    const values: Record<string, { value: string; sub?: string }> = {
        car: {
            value: `${flow.carEstimated ? '≈ ' : ''}${formatPower(flow.car)}`,
            sub: (flow.car ?? 0) >= THRESHOLD_W ? 'lädt' : undefined,
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
                        className={`flow__node flow__node--${n.key}`}
                    >
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
