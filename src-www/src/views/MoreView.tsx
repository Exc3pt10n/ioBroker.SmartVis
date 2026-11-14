import { useCardColumns } from '../media';
import { CustomSections } from '../components/CustomSections';
import { EditBanner, EditButton } from '../components/EditButton';
import { SystemCard } from '../components/SystemCard';
import { CustomizationsCard } from '../components/CustomizationsCard';
import { DiagnosisCard } from '../components/DiagnosisCard';
import { useConnection } from '../connection';
import { setMotion, useMotion, type MotionSetting } from '../motion';
import { BatteryList } from '../components/BatteryList';
import { batteryLevel, isBatteryLow } from '../battery';

export function MoreView(): React.JSX.Element {
    const { status, version, model, lastError, states } = useConnection();
    const columns = useCardColumns();
    const byAdapter = new Map<string, number>();
    for (const d of model?.devices || []) {
        byAdapter.set(d.adapter, (byAdapter.get(d.adapter) || 0) + 1);
    }

    // Diagnose-Infos: kurz zusammengefasst, Einzelheiten zum Aufklappen
    const deviceCount = model?.devices.length ?? 0;
    const statusText = status === 'online' ? 'verbunden' : status === 'connecting' ? 'verbinde …' : 'getrennt';
    const infoCard = (
        <section className="card">
            <h2 className="subtitle">Info</h2>
            <p className="info__summary">
                {status === 'online' ? '🟢' : '🟠'} {statusText} · Version {version || '–'} · {deviceCount}{' '}
                {deviceCount === 1 ? 'Gerät' : 'Geräte'}
            </p>
            <details className="info__details">
                <summary>Details</summary>
                <dl className="facts">
                    <dt>Status</dt>
                    <dd>{status}</dd>
                    <dt>Adapter-Version</dt>
                    <dd>{version || '–'}</dd>
                    <dt>Letzte Erkennung</dt>
                    <dd>{model ? new Date(model.generatedAt).toLocaleString('de-DE') : '–'}</dd>
                    {lastError && (
                        <>
                            <dt>Letzter Fehler</dt>
                            <dd>{lastError}</dd>
                        </>
                    )}
                </dl>
                <h3 className="info__subtitle">Erkannte Geräte je Adapter</h3>
                <dl className="facts">
                    {[...byAdapter.entries()].map(([adapter, count]) => (
                        <div
                            key={adapter}
                            className="facts__row"
                        >
                            <dt>{adapter}</dt>
                            <dd>{count}</dd>
                        </div>
                    ))}
                </dl>
            </details>
        </section>
    );

    return (
        <>
            <div className="titlebar titlebar--split">
                <h1 className="title">Mehr</h1>
                <EditButton />
            </div>
            <EditBanner text="Bereiche am Griff ⠿ ziehen oder mit ↑ ↓ sortieren und aus- oder einblenden" />
            <CustomSections
                view="more"
                columns={columns}
                className="csecs csecs--cols"
                sections={[
                    {
                        key: 'iobroker',
                        label: 'ioBroker',
                        node: model?.system ? (
                            <SystemCard
                                system={model.system}
                                states={states}
                            />
                        ) : null,
                    },
                    {
                        key: 'batteries',
                        label: 'Batterien',
                        node: model?.batteries?.length ? <BatteryCard /> : null,
                    },
                    { key: 'display', label: 'Darstellung', node: <DisplayCard /> },
                    {
                        key: 'customizations',
                        label: 'Anpassungen',
                        node:
                            model?.editable && model.client ? (
                                <CustomizationsCard
                                    key={model.client.name || ''}
                                    client={model.client}
                                />
                            ) : null,
                    },
                    { key: 'connection', label: 'Info', node: infoCard },
                    { key: 'diagnosis', label: 'Erkennung', node: <DiagnosisCard /> },
                ]}
            />
        </>
    );
}

/** Alle Batteriegeräte: schwache zuerst, dann nach Ladestand; Liste aufklappbar, um die Karte kurz zu halten */
function BatteryCard(): React.JSX.Element | null {
    const { model, states } = useConnection();
    const all = model?.batteries || [];
    const sorted = [...all].sort(
        (a, b) =>
            Number(isBatteryLow(b, states)) - Number(isBatteryLow(a, states)) ||
            (batteryLevel(a, states) ?? 101) - (batteryLevel(b, states) ?? 101) ||
            a.name.localeCompare(b.name, 'de'),
    );
    const low = sorted.filter(b => isBatteryLow(b, states));
    if (!model || !all.length) {
        return null;
    }
    return (
        <section className="card">
            <h2 className="subtitle">🔋 Batterien</h2>
            <p className={`info__summary${low.length ? ' system__summary--warn' : ''}`}>
                {low.length
                    ? `🪫 ${low.length} ${low.length === 1 ? 'Batterie' : 'Batterien'} schwach`
                    : '✅ Alle Batterien in Ordnung'}{' '}
                <span className="system__count">
                    · {all.length} {all.length === 1 ? 'Gerät' : 'Geräte'} mit Batterie
                </span>
            </p>
            {low.length > 0 && (
                <BatteryList
                    items={low}
                    rooms={model.rooms}
                    states={states}
                />
            )}
            <details className="info__details">
                <summary>Alle Batteriegeräte ({all.length})</summary>
                <BatteryList
                    items={sorted}
                    rooms={model.rooms}
                    states={states}
                />
            </details>
        </section>
    );
}

const MOTION_OPTIONS: { value: MotionSetting; label: string }[] = [
    { value: 'system', label: 'Wie im System' },
    { value: 'on', label: 'Immer an' },
    { value: 'off', label: 'Aus' },
];

/** Darstellung auf diesem Gerät (im Browser gespeichert) */
function DisplayCard(): React.JSX.Element {
    const { setting, systemReduced } = useMotion();
    return (
        <section className="card">
            <h2 className="subtitle">Darstellung</h2>
            <div className="setting setting--select setting--first">
                <label
                    className="setting__text"
                    htmlFor="motion"
                >
                    Animationen
                </label>
                <select
                    id="motion"
                    className="field__input"
                    value={setting}
                    onChange={e => setMotion(e.target.value as MotionSetting)}
                >
                    {MOTION_OPTIONS.map(o => (
                        <option
                            key={o.value}
                            value={o.value}
                        >
                            {o.label}
                        </option>
                    ))}
                </select>
            </div>
            <p className="detail__note">
                {systemReduced
                    ? setting === 'on'
                        ? 'Dein System wünscht reduzierte Bewegung – SmartVis animiert hier trotzdem (z. B. den Energiefluss).'
                        : 'Dein System wünscht reduzierte Bewegung (z. B. Windows: Animationseffekte aus) – deshalb ruhen die Animationen. Mit „Immer an“ laufen sie trotzdem.'
                    : 'Gilt nur für dieses Gerät bzw. diesen Browser.'}
            </p>
        </section>
    );
}
