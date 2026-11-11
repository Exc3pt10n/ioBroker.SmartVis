import { useState } from 'react';
import type { SvClientInfo } from '../../../src/shared/protocol';
import { connection } from '../connection';

function seen(ts: number, now = Date.now()): string {
    if (!ts) {
        return 'unbekannt';
    }
    const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 86_400_000);
    const time = new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (days <= 0) {
        return `heute ${time}`;
    }
    if (days === 1) {
        return `gestern ${time}`;
    }
    return days < 7 ? `vor ${days} Tagen` : new Date(ts).toLocaleDateString('de-DE');
}

/**
 * Anpassungen je Endgerät: Name dieses Geräts, von einem anderen Gerät übernehmen,
 * auf den Ausgangszustand zurücksetzen (dieses Gerät oder alle), alte Geräte entfernen.
 */
export function CustomizationsCard({ client }: { client: SvClientInfo }): React.JSX.Element {
    const others = client.devices.filter(d => d.id !== client.id);
    const [name, setName] = useState(client.name || '');
    const [source, setSource] = useState('');
    const sourceId = others.some(d => d.id === source) ? source : others[0]?.id || '';
    const rename = (): void => {
        const trimmed = name.trim();
        if (trimmed && trimmed !== client.name) {
            connection.client({ action: 'rename', name: trimmed });
        }
    };

    return (
        <section className="card custom">
            <h2 className="subtitle">Anpassungen</h2>
            <p className="detail__note">
                Namen, Räume, Favoriten, ausgeblendete Geräte und die Anordnung gelten je Gerät. Neue Geräte starten mit
                den bisherigen gemeinsamen Anpassungen.
            </p>

            {client.id ? (
                <>
                    <div className="setting setting--select setting--first">
                        <label
                            className="setting__text"
                            htmlFor="client-name"
                        >
                            Dieses Gerät
                        </label>
                        <input
                            id="client-name"
                            className="field__input"
                            value={name}
                            maxLength={40}
                            onChange={e => setName(e.target.value)}
                            onBlur={rename}
                            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        />
                    </div>

                    {others.length > 0 && (
                        <div className="setting setting--select setting--stack">
                            <label
                                className="setting__text"
                                htmlFor="client-source"
                            >
                                Übernehmen von
                            </label>
                            <div className="custom__row">
                                <select
                                    id="client-source"
                                    className="field__input"
                                    value={sourceId}
                                    onChange={e => setSource(e.target.value)}
                                >
                                    {others.map(d => (
                                        <option
                                            key={d.id}
                                            value={d.id}
                                        >
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="action action--small"
                                    disabled={!sourceId}
                                    onClick={() => {
                                        const from = others.find(d => d.id === sourceId);
                                        if (
                                            from &&
                                            window.confirm(
                                                `Anpassungen von „${from.name}“ übernehmen? Die Anpassungen dieses Geräts werden ersetzt.`,
                                            )
                                        ) {
                                            connection.client({ action: 'copyFrom', id: from.id });
                                        }
                                    }}
                                >
                                    Übernehmen
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="custom__actions">
                        <button
                            type="button"
                            className="action"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        'Alle Anpassungen dieses Geräts verwerfen? Danach gilt wieder die automatische Erkennung.',
                                    )
                                ) {
                                    connection.client({ action: 'reset' });
                                }
                            }}
                        >
                            ↺ Dieses Gerät zurücksetzen
                        </button>
                        <button
                            type="button"
                            className="action action--danger"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        'Alle Anpassungen auf ALLEN Geräten verwerfen? Danach gilt überall wieder die automatische Erkennung.',
                                    )
                                ) {
                                    connection.client({ action: 'resetAll' });
                                }
                            }}
                        >
                            ⚠️ Alle Geräte zurücksetzen
                        </button>
                    </div>

                    {others.length > 0 && (
                        <details className="custom__devices">
                            <summary>Andere Geräte ({others.length})</summary>
                            <ul className="instances">
                                {others.map(d => (
                                    <li
                                        key={d.id}
                                        className="instance custom__device"
                                    >
                                        <span className="instance__name">
                                            {d.name}
                                            <span className="instance__id">zuletzt {seen(d.lastSeen)}</span>
                                        </span>
                                        <button
                                            type="button"
                                            className="action action--small"
                                            onClick={() => {
                                                if (
                                                    window.confirm(
                                                        `„${d.name}“ mit seinen Anpassungen entfernen? Meldet sich das Gerät wieder, startet es mit den gemeinsamen Anpassungen.`,
                                                    )
                                                ) {
                                                    connection.client({ action: 'remove', id: d.id });
                                                }
                                            }}
                                        >
                                            Entfernen
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </>
            ) : (
                <p className="detail__note">
                    Diese App-Version meldet kein Gerät an – bitte die Seite neu laden, um Anpassungen je Gerät zu
                    nutzen.
                </p>
            )}
        </section>
    );
}
