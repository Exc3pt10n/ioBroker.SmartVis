import type { SvBattery, SvRoom, SvStateValue } from '../../../src/shared/protocol';
import { batteryLevel, isBatteryLow } from '../battery';
import { useOpenDetail } from '../detail';

/**
 * Batteriegeräte als kompakte Liste: Name, Raum, Ladestand (Balken + %) bzw. "schwach"/"in Ordnung".
 * Geräte mit Kachel öffnen beim Antippen ihre Detailansicht.
 */
export function BatteryList({
    items,
    rooms,
    states,
}: {
    items: SvBattery[];
    rooms: SvRoom[];
    states: Record<string, SvStateValue | null>;
}): React.JSX.Element {
    const openDetail = useOpenDetail();
    return (
        <ul className="batteries">
            {items.map(b => {
                const level = batteryLevel(b, states);
                const low = isBatteryLow(b, states);
                const room = rooms.find(r => r.id === b.roomId)?.name;
                const content = (
                    <>
                        <span
                            className="battery__icon"
                            aria-hidden="true"
                        >
                            {low ? '🪫' : '🔋'}
                        </span>
                        <span className="battery__name">
                            {b.name}
                            <span className="battery__room">{room || 'ohne Raum'}</span>
                        </span>
                        <span className="battery__value">
                            {level !== undefined ? (
                                <>
                                    <span
                                        className="battery__track"
                                        aria-hidden="true"
                                    >
                                        <span
                                            className="battery__fill"
                                            style={{ width: `${Math.min(100, Math.max(0, level))}%` }}
                                        />
                                    </span>
                                    {Math.round(level)} %
                                </>
                            ) : low ? (
                                'schwach'
                            ) : (
                                'in Ordnung'
                            )}
                        </span>
                    </>
                );
                return (
                    <li
                        key={b.id}
                        className={`battery${low ? ' battery--low' : ''}`}
                    >
                        {b.deviceId ? (
                            <button
                                type="button"
                                className="battery__row"
                                onClick={() => openDetail(b.deviceId!)}
                            >
                                {content}
                            </button>
                        ) : (
                            <div className="battery__row">{content}</div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
