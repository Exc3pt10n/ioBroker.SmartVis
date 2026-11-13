import type {
    SvHostStatus,
    SvInstanceStatus,
    SvStateRef,
    SvStateValue,
    SvSystemStatus,
} from '../../../src/shared/protocol';

type States = Record<string, SvStateValue | null>;

function num(ref: SvStateRef | undefined, states: States): number | undefined {
    const v = ref ? states[ref.id]?.val : undefined;
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? n : undefined;
}

function str(ref: SvStateRef | undefined, states: States): string | undefined {
    const v = ref ? states[ref.id]?.val : undefined;
    return v === null || v === undefined || v === '' ? undefined : String(v);
}

function bool(ref: SvStateRef | undefined, states: States): boolean | undefined {
    const v = ref ? states[ref.id]?.val : undefined;
    return typeof v === 'boolean' ? v : undefined;
}

/** Sekunden → "12 Tage 4 Std." bzw. "3 Std. 12 Min." */
export function formatUptime(seconds: number | undefined): string {
    if (seconds === undefined) {
        return '–';
    }
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) {
        return `${d} ${d === 1 ? 'Tag' : 'Tage'} ${h} Std.`;
    }
    return h > 0 ? `${h} Std. ${m} Min.` : `${m} Min.`;
}

function formatMb(mb: number | undefined): string {
    if (mb === undefined) {
        return '–';
    }
    return mb >= 1024
        ? `${(mb / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} GB`
        : `${Math.round(mb).toLocaleString('de-DE')} MB`;
}

export type InstanceState = 'running' | 'stopped' | 'disconnected' | 'disabled' | 'scheduled';

/**
 * Zustand einer Instanz: Dienste (daemon) müssen laufen; geplante/einmalige Adapter laufen
 * nur zeitweise und gelten deshalb nicht als gestört.
 */
export function instanceState(i: SvInstanceStatus, states: States): InstanceState {
    if (!i.enabled) {
        return 'disabled';
    }
    const alive = bool(i.alive, states);
    if (i.mode && i.mode !== 'daemon') {
        return alive ? 'running' : 'scheduled';
    }
    if (alive !== true) {
        return 'stopped';
    }
    if (bool(i.connected, states) === false || bool(i.connection, states) === false) {
        return 'disconnected';
    }
    return 'running';
}

const STATE_INFO: Record<InstanceState, { icon: string; label: string }> = {
    running: { icon: '🟢', label: 'läuft' },
    scheduled: { icon: '⏱️', label: 'geplant' },
    stopped: { icon: '🔴', label: 'läuft nicht' },
    disconnected: { icon: '🟠', label: 'keine Verbindung' },
    disabled: { icon: '⏸️', label: 'deaktiviert' },
};

/** Balken mit Wert; ab der Schwelle als Warnung (Farbe + ⚠️, nie Farbe allein) */
function Meter({
    label,
    percent,
    value,
    warnAt = 85,
}: {
    label: string;
    percent: number | undefined;
    value: string;
    warnAt?: number;
}): React.JSX.Element {
    const warn = percent !== undefined && percent >= warnAt;
    return (
        <div className={`meter${warn ? ' meter--warn' : ''}`}>
            <dt>{label}</dt>
            <dd>
                <span
                    className="meter__track"
                    aria-hidden="true"
                >
                    <span
                        className="meter__fill"
                        style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
                    />
                </span>
                <span className="meter__value">
                    {warn ? '⚠️ ' : ''}
                    {value}
                </span>
            </dd>
        </div>
    );
}

function HostStatus({ host, states }: { host: SvHostStatus; states: States }): React.JSX.Element {
    const alive = bool(host.alive, states);
    const cpu = num(host.cpu, states);
    const mem = num(host.mem, states);
    const memFree = num(host.memAvailable, states);
    const diskFree = num(host.diskFree, states);
    const diskSize = num(host.diskSize, states);
    const diskUsed = diskFree !== undefined && diskSize ? ((diskSize - diskFree) / diskSize) * 100 : undefined;
    const node = str(host.nodeVersion, states);
    const nodeNewest = str(host.nodeNewest, states);
    const load = num(host.load, states);

    return (
        <div className="host">
            <div className="host__head">
                <span className="host__name">
                    {alive === false ? '🔴' : '🟢'} {host.name}
                </span>
                <span className="host__meta">läuft seit {formatUptime(num(host.uptime, states))}</span>
            </div>
            <dl className="meters">
                {host.cpu && (
                    <Meter
                        label="Prozessor"
                        percent={cpu}
                        value={cpu !== undefined ? `${Math.round(cpu)} %` : '–'}
                    />
                )}
                {host.mem && (
                    <Meter
                        label="Arbeitsspeicher"
                        percent={mem}
                        value={`${mem !== undefined ? `${Math.round(mem)} %` : '–'}${memFree !== undefined ? ` · ${formatMb(memFree)} frei` : ''}`}
                    />
                )}
                {host.diskSize && (
                    <Meter
                        label="Festplatte"
                        percent={diskUsed}
                        warnAt={num(host.diskWarning, states) || 85}
                        value={`${diskUsed !== undefined ? `${Math.round(diskUsed)} %` : '–'}${diskFree !== undefined ? ` · ${formatMb(diskFree)} frei` : ''}`}
                    />
                )}
            </dl>
            <p className="host__versions">
                {host.controllerVersion && <span>js-controller {host.controllerVersion}</span>}
                {node && (
                    <span>
                        Node.js {node}
                        {nodeNewest && nodeNewest !== node ? ` (verfügbar: ${nodeNewest})` : ''}
                    </span>
                )}
                {load !== undefined && <span>Last {load.toLocaleString('de-DE', { maximumFractionDigits: 2 })}</span>}
            </p>
        </div>
    );
}

/** Karte "ioBroker": Hosts (Auslastung, Versionen) und Zustand der Adapter-Instanzen */
export function SystemCard({ system, states }: { system: SvSystemStatus; states: States }): React.JSX.Element {
    const rated = system.instances.map(i => ({ instance: i, state: instanceState(i, states) }));
    const problems = rated.filter(r => r.state === 'stopped' || r.state === 'disconnected');
    const active = rated.filter(r => r.state !== 'disabled');
    const running = rated.filter(r => r.state === 'running' || r.state === 'scheduled');
    const disabled = rated.length - active.length;

    return (
        <section className="card system">
            <h2 className="subtitle">ioBroker</h2>
            {system.hosts.map(h => (
                <HostStatus
                    key={h.id}
                    host={h}
                    states={states}
                />
            ))}
            <p className={`system__summary${problems.length ? ' system__summary--warn' : ''}`}>
                {problems.length
                    ? `⚠️ ${problems.length} ${problems.length === 1 ? 'Instanz mit Problem' : 'Instanzen mit Problemen'}`
                    : '✅ Alle Instanzen in Ordnung'}
                <span className="system__count">
                    {running.length} von {active.length} aktiven laufen
                    {disabled ? ` · ${disabled} deaktiviert` : ''}
                </span>
            </p>
            {system.instances.some(i => i.paused) && (
                <p className="system__paused">
                    ⏸️ In SmartVis pausiert:{' '}
                    {system.instances
                        .filter(i => i.paused)
                        .map(i => i.id)
                        .join(', ')}{' '}
                    <span className="system__count">(Einstellung „Pausierte Instanzen“ in der Instanz)</span>
                </p>
            )}
            {problems.length > 0 && (
                <ul className="instances instances--problems">
                    {problems.map(({ instance, state }) => (
                        <InstanceRow
                            key={instance.id}
                            instance={instance}
                            state={state}
                        />
                    ))}
                </ul>
            )}
            <details className="system__all">
                <summary>Alle Instanzen ({rated.length})</summary>
                <ul className="instances">
                    {rated.map(({ instance, state }) => (
                        <InstanceRow
                            key={instance.id}
                            instance={instance}
                            state={state}
                        />
                    ))}
                </ul>
            </details>
        </section>
    );
}

function InstanceRow({ instance, state }: { instance: SvInstanceStatus; state: InstanceState }): React.JSX.Element {
    const info = STATE_INFO[state];
    return (
        <li className={`instance instance--${state}`}>
            <span
                className="instance__icon"
                aria-hidden="true"
            >
                {info.icon}
            </span>
            <span className="instance__name">
                {instance.title}
                <span className="instance__id">
                    {instance.id}
                    {instance.version ? ` · ${instance.version}` : ''}
                </span>
            </span>
            <span className="instance__state">
                {info.label}
                {/* In SmartVis pausiert: Objekte ausgeblendet, die Instanz selbst läuft weiter */}
                {instance.paused && <span className="instance__paused">⏸️ in SmartVis pausiert</span>}
            </span>
        </li>
    );
}
