import { useCardColumns } from '../media';
import { CustomSections } from '../components/CustomSections';
import { EditBanner, EditButton } from '../components/EditButton';
import { SystemCard } from '../components/SystemCard';
import { useConnection } from '../connection';
import { setMotion, useMotion, type MotionSetting } from '../motion';

export function MoreView(): React.JSX.Element {
    const { status, version, model, lastError, states } = useConnection();
    const columns = useCardColumns();
    const byAdapter = new Map<string, number>();
    for (const d of model?.devices || []) {
        byAdapter.set(d.adapter, (byAdapter.get(d.adapter) || 0) + 1);
    }

    const connectionCard = (
        <section className="card">
            <h2 className="subtitle">Verbindung</h2>
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
        </section>
    );
    const adapterCard = (
        <section className="card">
            <h2 className="subtitle">Erkannte Geräte je Adapter</h2>
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
                    { key: 'display', label: 'Darstellung', node: <DisplayCard /> },
                    { key: 'connection', label: 'Verbindung', node: connectionCard },
                    { key: 'adapters', label: 'Erkannte Geräte je Adapter', node: adapterCard },
                ]}
            />
        </>
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
