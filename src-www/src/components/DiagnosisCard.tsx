import { useState } from 'react';
import { anonymizeDiagnosis } from '../../../src/shared/anonymize';
import type { SvDiagnosis } from '../../../src/shared/protocol';
import { connection, useConnection } from '../connection';

const REASONS: Record<string, string> = {
    'no-match': 'keine passenden Rollen',
    filtered: 'Gerätetyp für diesen Adapter ausgeblendet',
};

/** Datei im Browser speichern */
function download(name: string, content: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Erkennung prüfen: erkannte Geräte je Adapter, Kanäle ohne Kachel mit Grund und Datenpunkten,
 * anonymer Bericht zum Teilen. Wird erst auf Knopfdruck geladen (kann bei großen Anlagen umfangreich sein).
 */
export function DiagnosisCard(): React.JSX.Element {
    const { version, status } = useConnection();
    const [report, setReport] = useState<SvDiagnosis | undefined>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const load = (): void => {
        setLoading(true);
        setError(undefined);
        connection.diagnose().then(
            r => {
                setReport(r);
                setLoading(false);
            },
            (e: Error) => {
                setError(e.message);
                setLoading(false);
            },
        );
    };

    const devices = report?.adapters.reduce((n, a) => n + a.devices, 0) ?? 0;
    const missing = report?.unmatched.length ?? 0;

    return (
        <section className="card diag">
            <h2 className="subtitle">🔍 Erkennung</h2>
            {!report ? (
                <p className="detail__note">
                    Zeigt, welche Geräte SmartVis je Adapter erkannt hat und welche Kanäle keine Kachel bekommen haben –
                    mit Grund und den enthaltenen Datenpunkten.
                </p>
            ) : (
                <p className={`info__summary${missing ? ' system__summary--warn' : ''}`}>
                    {devices} {devices === 1 ? 'Gerät' : 'Geräte'} erkannt
                    {missing ? ` · ${missing} ${missing === 1 ? 'Kanal' : 'Kanäle'} ohne Kachel` : ' · alles erkannt'}
                </p>
            )}
            {error && <p className="detail__note diag__error">⚠️ {error}</p>}
            {report && (
                <>
                    <table className="diag__table">
                        <thead>
                            <tr>
                                <th scope="col">Adapter</th>
                                <th scope="col">Geräte</th>
                                <th scope="col">ohne Kachel</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.adapters.map(a => (
                                <tr key={a.adapter}>
                                    <th scope="row">
                                        {a.adapter}
                                        {a.supported && (
                                            <span
                                                className="diag__known"
                                                title="SmartVis kennt die Objektstruktur dieses Adapters"
                                            >
                                                {' '}
                                                ✓
                                            </span>
                                        )}
                                    </th>
                                    <td>{a.devices}</td>
                                    <td>{a.unmatched || '–'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {missing > 0 && (
                        <details className="info__details">
                            <summary>Kanäle ohne Kachel ({missing})</summary>
                            <ul className="diag__list">
                                {report.unmatched.map(e => (
                                    <li key={e.id}>
                                        <details>
                                            <summary>
                                                <span className="diag__name">{e.name}</span>{' '}
                                                <span className="diag__meta">
                                                    {e.adapter} · {REASONS[e.reason] || e.reason}
                                                </span>
                                            </summary>
                                            <p className="diag__id">{e.id}</p>
                                            <ul className="diag__states">
                                                {e.states.map(s => (
                                                    <li key={s.key}>
                                                        <code>{s.key}</code> {s.role || '–'}
                                                        {s.code ? ` (${s.code})` : ''}
                                                        {s.type ? ` · ${s.type}` : ''}
                                                        {s.unit ? ` · ${s.unit}` : ''}
                                                        {s.write ? ' · schreibbar' : ''}
                                                    </li>
                                                ))}
                                            </ul>
                                        </details>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </>
            )}
            <div className="custom__actions">
                <button
                    type="button"
                    className="action"
                    disabled={loading || status !== 'online'}
                    onClick={load}
                >
                    {loading ? 'Prüfe …' : report ? 'Erneut prüfen' : 'Erkennung prüfen'}
                </button>
                {report && (
                    <button
                        type="button"
                        className="action"
                        onClick={() =>
                            download(
                                `smartvis-diagnose-${new Date().toISOString().slice(0, 10)}.json`,
                                JSON.stringify(anonymizeDiagnosis(report, version || ''), null, 2),
                            )
                        }
                    >
                        Anonymen Bericht speichern
                    </button>
                )}
            </div>
            {report && (
                <p className="detail__note">
                    Der Bericht enthält nur Adapter, Datenpunkt-Schlüssel und Rollen – keine Namen, Räume, IDs oder
                    Werte. Als Anhang an ein GitHub-Issue hilft er, die Erkennung für weitere Adapter zu verbessern.
                </p>
            )}
        </section>
    );
}
