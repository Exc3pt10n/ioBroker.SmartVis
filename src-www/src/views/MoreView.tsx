import { useConnection } from '../connection';

export function MoreView(): React.JSX.Element {
    const { status, version, model, lastError } = useConnection();
    const byAdapter = new Map<string, number>();
    for (const d of model?.devices || []) {
        byAdapter.set(d.adapter, (byAdapter.get(d.adapter) || 0) + 1);
    }

    return (
        <>
            <h1 className="title">Mehr</h1>
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
        </>
    );
}
