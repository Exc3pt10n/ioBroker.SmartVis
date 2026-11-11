import { useState } from 'react';
import type { SvWallbox, SvWallboxSetting } from '../../../src/shared/protocol';
import { connection, useConnection } from '../connection';
import { Toggle } from './Toggle';

/** Anzeige-Wert aus dem State (z. B. mA → A) */
function toDisplay(setting: SvWallboxSetting, raw: unknown): number | undefined {
    const n = Number(raw);
    if (raw === null || raw === undefined || raw === '' || !Number.isFinite(n)) {
        return undefined;
    }
    return Math.round(n * (setting.scale ?? 1) * 1000) / 1000;
}

function clamp(setting: SvWallboxSetting, v: number): number {
    let x = v;
    if (setting.min !== undefined) {
        x = Math.max(setting.min, x);
    }
    if (setting.max !== undefined) {
        x = Math.min(setting.max, x);
    }
    return x;
}

function NumberSetting({ setting }: { setting: SvWallboxSetting }): React.JSX.Element {
    const { states } = useConnection();
    const current = toDisplay(setting, states[setting.state.id]?.val);
    const pending = states[setting.state.id]?.ack === false;
    const [draft, setDraft] = useState<string | null>(null);
    const step = setting.step ?? 1;
    const id = `wb-${setting.key}`;

    const commit = (value: number): void => {
        const v = clamp(setting, value);
        setDraft(null);
        if (v !== current) {
            connection.setState(setting.state.id, Math.round((v / (setting.scale ?? 1)) * 1000) / 1000);
        }
    };

    return (
        <div className={`setting${pending ? ' setting--pending' : ''}`}>
            <label
                className="setting__text"
                htmlFor={id}
            >
                <span>{setting.label}</span>
                {(setting.hint || (current === 0 && setting.zeroLabel)) && (
                    <span className="toggle__hint">
                        {current === 0 && setting.zeroLabel ? `0 = ${setting.zeroLabel}` : setting.hint}
                    </span>
                )}
            </label>
            <div className="stepper">
                <button
                    type="button"
                    aria-label={`${setting.label} verringern`}
                    onClick={() => commit((current ?? 0) - step)}
                    disabled={current !== undefined && setting.min !== undefined && current <= setting.min}
                >
                    −
                </button>
                <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={setting.min}
                    max={setting.max}
                    step={step}
                    value={draft ?? (current !== undefined ? String(current) : '')}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={() => draft !== null && draft !== '' && commit(Number(draft.replace(',', '.')))}
                    onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
                {setting.unit && <span className="stepper__unit">{setting.unit}</span>}
                <button
                    type="button"
                    aria-label={`${setting.label} erhöhen`}
                    onClick={() => commit((current ?? 0) + step)}
                    disabled={current !== undefined && setting.max !== undefined && current >= setting.max}
                >
                    +
                </button>
            </div>
        </div>
    );
}

function SelectSetting({ setting }: { setting: SvWallboxSetting }): React.JSX.Element {
    const { states } = useConnection();
    const current = toDisplay(setting, states[setting.state.id]?.val);
    const pending = states[setting.state.id]?.ack === false;
    const id = `wb-${setting.key}`;
    return (
        <div className={`setting setting--column${pending ? ' setting--pending' : ''}`}>
            <label
                className="setting__text"
                htmlFor={id}
            >
                <span>{setting.label}</span>
                {setting.hint && <span className="toggle__hint">{setting.hint}</span>}
            </label>
            <select
                id={id}
                className="field__input"
                value={current ?? ''}
                onChange={e => connection.setState(setting.state.id, Number(e.target.value))}
            >
                {current === undefined && <option value="">–</option>}
                {(setting.options || []).map(o => (
                    <option
                        key={o.value}
                        value={o.value}
                    >
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

/** Einstellungen der Ladeautomatik, gruppiert und einklappbar */
export function WallboxSettings({ wallbox }: { wallbox: SvWallbox }): React.JSX.Element | null {
    const { states } = useConnection();
    const settings = wallbox.settings || [];
    if (!settings.length) {
        return null;
    }
    const socSource = wallbox.vehicleSoCSource ? states[wallbox.vehicleSoCSource.id]?.val : undefined;
    const hasVehicleSoC = typeof socSource === 'string' && socSource.trim() !== '';
    const groups = [...new Set(settings.map(s => s.group))];

    return (
        <details className="wb-settings">
            <summary>Einstellungen ({settings.length})</summary>
            {groups.map(group => {
                const list = settings.filter(s => s.group === group);
                const needsSoC = list.some(s => s.needsVehicleSoC);
                return (
                    <section
                        key={group}
                        className="wb-settings__group"
                    >
                        <h3 className="subtitle">{group}</h3>
                        {needsSoC && !hasVehicleSoC && (
                            <p className="detail__note">
                                Wirkt erst, wenn im kecontact-Adapter ein Datenpunkt für den Ladezustand des Fahrzeugs
                                eingetragen ist (automatic.stateVehicleSoC).
                            </p>
                        )}
                        {list.map(s =>
                            s.kind === 'switch' ? (
                                <Toggle
                                    key={s.key}
                                    state={s.state}
                                    label={s.label}
                                    hint={s.hint}
                                    compact
                                />
                            ) : s.kind === 'select' ? (
                                <SelectSetting
                                    key={s.key}
                                    setting={s}
                                />
                            ) : (
                                <NumberSetting
                                    key={s.key}
                                    setting={s}
                                />
                            ),
                        )}
                    </section>
                );
            })}
        </details>
    );
}
