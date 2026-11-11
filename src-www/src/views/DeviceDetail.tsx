import type { SvDevice, SvStateRef, SvStateValue } from '../../../src/shared/protocol';
import { HistoryPanel } from '../components/HistoryPanel';
import { Sheet } from '../components/Sheet';
import { Slider } from '../components/Slider';
import { Toggle } from '../components/Toggle';
import { connection, useConnection } from '../connection';
import { TYPE_LABELS, formatValue, warnings } from '../device';
import { autoStateInfo, shutterForDevice } from '../shutters';

type States = Record<string, SvStateValue | null>;

const LIGHT_TYPES = ['light', 'dimmer', 'ct', 'hue', 'rgb', 'rgbSingle', 'rgbwSingle', 'cie'];

const STATE_LABELS: Record<string, string> = {
    ACTUAL: 'Istwert',
    SET: 'Sollwert',
    ON: 'Ein/Aus',
    ON_SET: 'Ein/Aus',
    ON_ACTUAL: 'Eingeschaltet',
    DIMMER: 'Helligkeit',
    BRIGHTNESS: 'Helligkeit',
    TEMPERATURE: 'Farbtemperatur',
    HUE: 'Farbe',
    SATURATION: 'Sättigung',
    HUMIDITY: 'Luftfeuchte',
    SECOND: 'Zweiter Wert',
    VALVE: 'Ventil',
    WINDOW: 'Fenster',
    BOOST: 'Boost',
    MODE: 'Modus',
    WORKING: 'In Bewegung',
    STOP: 'Stopp',
    UNREACH: 'Nicht erreichbar',
    LOWBAT: 'Batterie schwach',
    BATTERY: 'Batterie',
    MAINTAIN: 'Wartung',
    ERROR: 'Fehler',
    RSSI: 'Signal',
    ELECTRIC_POWER: 'Leistung',
    CURRENT: 'Strom',
    VOLTAGE: 'Spannung',
    CONSUMPTION: 'Verbrauch',
    FREQUENCY: 'Frequenz',
    TRANSITION_TIME: 'Übergangszeit',
    EFFECT: 'Effekt',
    ON_TIME: 'Einschaltdauer',
};

function find(
    device: SvDevice,
    names: string[],
    opts: { write?: boolean; type?: string } = {},
): SvStateRef | undefined {
    for (const n of names) {
        const s = device.states.find(
            st =>
                st.name === n &&
                (opts.write === undefined || st.write === opts.write) &&
                (!opts.type || st.type === opts.type),
        );
        if (s) {
            return s;
        }
    }
    return undefined;
}

function num(states: States, ref: SvStateRef | undefined): number | undefined {
    const v = ref ? states[ref.id]?.val : undefined;
    const n = Number(v);
    return v === null || v === undefined || v === '' || !Number.isFinite(n) ? undefined : n;
}

const pending = (states: States, ref: SvStateRef | undefined): boolean => !!ref && states[ref.id]?.ack === false;

interface LightRefs {
    onOff?: SvStateRef;
    onActual?: SvStateRef;
    level?: SvStateRef;
    ct?: SvStateRef;
    hue?: SvStateRef;
}
interface BlindRefs {
    set?: SvStateRef;
    actual?: SvStateRef;
    stop?: SvStateRef;
}
interface ThermostatRefs {
    set?: SvStateRef;
    actual?: SvStateRef;
    humidity?: SvStateRef;
    boost?: SvStateRef;
}

function lightRefs(device: SvDevice): LightRefs {
    return {
        onOff: find(device, ['ON', 'ON_SET', 'SET'], { write: true, type: 'boolean' }),
        onActual: find(device, ['ON_ACTUAL']),
        level:
            find(device, ['DIMMER', 'BRIGHTNESS'], { write: true }) ||
            (device.type === 'dimmer' ? find(device, ['SET'], { write: true, type: 'number' }) : undefined),
        ct: find(device, ['TEMPERATURE'], { write: true }),
        hue: find(device, ['HUE'], { write: true }),
    };
}

function blindRefs(device: SvDevice): BlindRefs {
    return {
        set: find(device, ['SET'], { write: true }),
        actual: find(device, ['ACTUAL']),
        stop: find(device, ['STOP'], { write: true }),
    };
}

function thermostatRefs(device: SvDevice): ThermostatRefs {
    return {
        set: find(device, ['SET', 'SET_HEATING'], { write: true }),
        actual: find(device, ['ACTUAL']),
        humidity: find(device, ['HUMIDITY']),
        boost: find(device, ['BOOST'], { write: true, type: 'boolean' }),
    };
}

export function DeviceDetail({
    deviceId,
    onClose,
}: {
    deviceId: string;
    onClose: () => void;
}): React.JSX.Element | null {
    const { model, states } = useConnection();
    const device = model?.devices.find(d => d.id === deviceId);
    if (!model || !device) {
        return null;
    }
    const room = model.rooms.find(r => r.id === device.roomId)?.name;
    let main: React.JSX.Element | null = null;
    let used: (SvStateRef | undefined)[] = [];
    if (LIGHT_TYPES.includes(device.type)) {
        const refs = lightRefs(device);
        used = Object.values(refs);
        main = (
            <LightControls
                refs={refs}
                states={states}
            />
        );
    } else if (device.type === 'blind') {
        const refs = blindRefs(device);
        used = Object.values(refs);
        main = (
            <BlindControls
                device={device}
                refs={refs}
                states={states}
            />
        );
    } else if (device.type === 'thermostat' || device.type === 'airCondition') {
        const refs = thermostatRefs(device);
        used = Object.values(refs);
        main = (
            <ThermostatControls
                refs={refs}
                states={states}
            />
        );
    } else {
        const sw = find(device, ['SET', 'ON', 'ON_SET', 'STATE'], { write: true, type: 'boolean' });
        used = [sw];
        main = sw ? (
            <div className="detail__controls">
                <Toggle
                    state={sw}
                    label="Ein/Aus"
                />
            </div>
        ) : null;
    }
    const shown = new Set(used.filter((r): r is SvStateRef => !!r).map(r => r.id));

    const warn = warnings(device, states);
    // Verlauf: alle aufgezeichneten Zahlenwerte des Geräts, Istwert zuerst
    const historySeries = device.states
        .filter(st => st.history && st.type !== 'boolean' && st.type !== 'string')
        .sort((a, b) => (a.name === 'ACTUAL' ? -1 : b.name === 'ACTUAL' ? 1 : 0))
        .map(st => ({
            key: st.id,
            label: STATE_LABELS[st.name] || st.name,
            ref: st,
            zeroBased: !/temperature/i.test(st.role || '') && st.unit !== '°C',
        }));
    const rest = device.states.filter(s => !shown.has(s.id));

    return (
        <Sheet
            title={device.name}
            subtitle={[room, TYPE_LABELS[device.type] || device.type].filter(Boolean).join(' · ')}
            onClose={onClose}
            actions={
                model.editable ? (
                    <button
                        type="button"
                        className={`iconbtn star${device.favorite ? ' star--on' : ''}`}
                        aria-pressed={!!device.favorite}
                        aria-label={device.favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                        onClick={() =>
                            connection.edit({ kind: 'device', id: device.id, patch: { favorite: !device.favorite } })
                        }
                    >
                        {device.favorite ? '★' : '☆'}
                    </button>
                ) : null
            }
        >
            {warn.length > 0 && <div className="banner banner--offline">⚠️ {warn.join(', ')}</div>}
            {main}
            {historySeries.length > 0 && <HistoryPanel series={historySeries} />}
            {rest.length > 0 && (
                <details
                    className="detail__more"
                    open={!main}
                >
                    <summary>Alle Werte</summary>
                    <dl className="facts">
                        {rest.map(s => (
                            <StateRow
                                key={s.id}
                                state={s}
                                states={states}
                            />
                        ))}
                    </dl>
                </details>
            )}
        </Sheet>
    );
}

function LightControls({ refs, states }: { refs: LightRefs; states: States }): React.JSX.Element {
    const { onOff, level, ct, hue } = refs;

    // Farbtemperatur: Hue liefert Mired (153–500, hoch = warm), andere Kelvin (hoch = kalt)
    const ctMin = ct?.min ?? 153;
    const ctMax = ct?.max ?? 500;
    const isKelvin = ctMax > 1000;

    return (
        <div className="detail__controls">
            {onOff && (
                <Toggle
                    state={onOff}
                    label="Licht"
                />
            )}
            {level && (
                <Slider
                    label="Helligkeit"
                    value={num(states, level)}
                    min={level.min ?? 0}
                    max={level.max ?? 100}
                    pending={pending(states, level)}
                    format={v =>
                        `${Math.round(((v - (level.min ?? 0)) / ((level.max ?? 100) - (level.min ?? 0))) * 100)} %`
                    }
                    onCommit={v => connection.setState(level.id, v)}
                    variant="warm"
                />
            )}
            {ct && (
                <Slider
                    label="Farbtemperatur"
                    value={num(states, ct)}
                    min={ctMin}
                    max={ctMax}
                    pending={pending(states, ct)}
                    format={v => `${Math.round((isKelvin ? v : 1_000_000 / v) / 100) * 100} K`}
                    onCommit={v => connection.setState(ct.id, v)}
                    variant={isKelvin ? 'warm' : 'ct'}
                />
            )}
            {hue && (
                <Slider
                    label="Farbe"
                    value={num(states, hue)}
                    min={hue.min ?? 0}
                    max={hue.max ?? 360}
                    pending={pending(states, hue)}
                    format={v => `${Math.round(v)}°`}
                    onCommit={v => connection.setState(hue.id, v)}
                    variant="hue"
                />
            )}
        </div>
    );
}

function BlindControls({
    device,
    refs,
    states,
}: {
    device: SvDevice;
    refs: BlindRefs;
    states: States;
}): React.JSX.Element {
    const { model } = useConnection();
    const { set, actual, stop } = refs;
    const min = set?.min ?? 0;
    const max = set?.max ?? 100;
    const auto = shutterForDevice(
        model,
        device.states.map(s => s.id),
    );
    const autoInfo = auto?.autoState ? autoStateInfo(states[auto.autoState.id]?.val) : undefined;

    return (
        <div className="detail__controls">
            {set && (
                <Slider
                    label="Position"
                    value={num(states, set)}
                    min={min}
                    max={max}
                    pending={pending(states, set)}
                    format={v => (v <= min ? 'geschlossen' : v >= max ? 'offen' : `${Math.round(v)} %`)}
                    onCommit={v => connection.setState(set.id, v)}
                />
            )}
            {actual && num(states, actual) !== num(states, set) && (
                <p className="detail__note">Aktuell: {formatValue(actual, states[actual.id])}</p>
            )}
            {set && (
                <div className="actions actions--small">
                    <button
                        type="button"
                        className="action"
                        onClick={() => connection.setState(set.id, max)}
                    >
                        ⬆️ Auf
                    </button>
                    {stop && (
                        <button
                            type="button"
                            className="action"
                            onClick={() => connection.setState(stop.id, true)}
                        >
                            ⏹ Stopp
                        </button>
                    )}
                    <button
                        type="button"
                        className="action"
                        onClick={() => connection.setState(set.id, min)}
                    >
                        ⬇️ Zu
                    </button>
                </div>
            )}
            {auto && (
                <section className="detail__section">
                    <h3 className="subtitle">Automatik{autoInfo ? ` · ${autoInfo.icon} ${autoInfo.label}` : ''}</h3>
                    {auto.autoUp && (
                        <Toggle
                            state={auto.autoUp}
                            label="Automatisch öffnen"
                            compact
                        />
                    )}
                    {auto.autoDown && (
                        <Toggle
                            state={auto.autoDown}
                            label="Automatisch schließen"
                            compact
                        />
                    )}
                    {auto.autoSun && (
                        <Toggle
                            state={auto.autoSun}
                            label="Sonnenschutz"
                            compact
                        />
                    )}
                </section>
            )}
        </div>
    );
}

function ThermostatControls({ refs, states }: { refs: ThermostatRefs; states: States }): React.JSX.Element {
    const { set, actual, humidity, boost } = refs;
    const min = set?.min ?? 5;
    const max = set?.max ?? 30;
    const step = 0.5;
    const value = num(states, set);
    const nudge = (delta: number): void => {
        if (set && value !== undefined) {
            connection.setState(set.id, Math.min(max, Math.max(min, Math.round((value + delta) / step) * step)));
        }
    };
    const fmt = (v: number): string =>
        `${v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`;

    return (
        <div className="detail__controls">
            <div className="thermo">
                <div>
                    <div className="thermo__label">Raum</div>
                    <div className="thermo__value">{actual ? formatValue(actual, states[actual.id]) : '–'}</div>
                    {humidity && <div className="thermo__label">💧 {formatValue(humidity, states[humidity.id])}</div>}
                </div>
                {set && (
                    <div className="thermo__set">
                        <button
                            type="button"
                            className="iconbtn"
                            aria-label="Sollwert senken"
                            onClick={() => nudge(-step)}
                        >
                            −
                        </button>
                        <div>
                            <div className="thermo__label">Soll</div>
                            <div className={`thermo__value${pending(states, set) ? ' slider--pending' : ''}`}>
                                {value !== undefined ? fmt(value) : '–'}
                            </div>
                        </div>
                        <button
                            type="button"
                            className="iconbtn"
                            aria-label="Sollwert erhöhen"
                            onClick={() => nudge(step)}
                        >
                            +
                        </button>
                    </div>
                )}
            </div>
            {set && (
                <Slider
                    label="Solltemperatur"
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    pending={pending(states, set)}
                    format={fmt}
                    onCommit={v => connection.setState(set.id, v)}
                />
            )}
            {boost && (
                <Toggle
                    state={boost}
                    label="Boost"
                    hint="Kurzzeitig maximal heizen"
                />
            )}
        </div>
    );
}

function StateRow({ state, states }: { state: SvStateRef; states: States }): React.JSX.Element {
    const label = STATE_LABELS[state.name] || state.name;
    const value = states[state.id];
    if (state.write && state.type === 'boolean') {
        return (
            <div className="facts__row facts__row--control">
                <Toggle
                    state={state}
                    label={label}
                    compact
                />
            </div>
        );
    }
    let text: string;
    if (value === null || value === undefined || value.val === null || value.val === undefined) {
        text = '–';
    } else if (typeof value.val === 'boolean') {
        text = value.val ? 'ja' : 'nein';
    } else {
        text = formatValue(state, value);
    }
    return (
        <div className="facts__row">
            <dt>{label}</dt>
            <dd>{text}</dd>
        </div>
    );
}
