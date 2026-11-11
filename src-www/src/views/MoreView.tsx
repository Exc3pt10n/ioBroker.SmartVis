import { CustomSections } from '../components/CustomSections';
import { EditBanner, EditButton } from '../components/EditButton';
import { SystemCard } from '../components/SystemCard';
import { useConnection } from '../connection';

export function MoreView(): React.JSX.Element {
    const { status, version, model, lastError, states } = useConnection();
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
                    { key: 'connection', label: 'Verbindung', node: connectionCard },
                    { key: 'adapters', label: 'Erkannte Geräte je Adapter', node: adapterCard },
                ]}
            />
        </>
    );
}
