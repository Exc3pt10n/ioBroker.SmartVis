import { DeviceTile } from '../components/DeviceTile';
import { SortableGrid } from '../components/SortableGrid';
import { CustomSections, type SectionDef } from '../components/CustomSections';
import { ScenePanel } from '../components/ScenePanel';
import { EditBanner, EditButton } from '../components/EditButton';
import { Icon } from '../components/Icon';
import { useConnection } from '../connection';
import { groupByType, isActive, isCoveredGroup } from '../device';
import { switchLights } from '../lightActions';
import { isLight, roomStatus } from '../rooms';
import { useEditing, visibleDevices } from '../editing';
import { scenesForRoom } from '../scenes';

export function RoomView({ roomId, onBack }: { roomId: string; onBack: () => void }): React.JSX.Element {
    const { model, states } = useConnection();
    const { editing } = useEditing();
    if (!model) {
        return <p className="empty">Lade …</p>;
    }
    const isNone = roomId === '_none';
    const room = model.rooms.find(r => r.id === roomId);
    const devices = visibleDevices(model, editing).filter(d => (isNone ? !d.roomId : d.roomId === roomId));
    const groups = groupByType(devices);
    const status = roomStatus(devices, states);
    // Lampen für "Alle aus/an" – Gruppen ("Alle Lichter") nicht zusätzlich, wenn ihre Lampen sichtbar sind
    const shownIds = new Set(devices.filter(d => !d.hidden).map(d => d.id));
    const lamps = devices.filter(d => !d.hidden && isLight(d) && !isCoveredGroup(d, shownIds));
    const anyOn = lamps.some(d => isActive(d, states));
    const roomLabel = isNone ? 'Ohne Raum' : room?.name || 'Unbekannter Raum';
    // Szenen: Lampen des Raums unabhängig von ausgeblendeten Kacheln
    const sceneGroups = isNone
        ? []
        : scenesForRoom(
              model,
              model.devices.filter(d => d.roomId === roomId),
          );

    // Bereiche: je Gerätegruppe eine Karte, Szenen direkt nach dem Licht (Anordnung gilt für alle Räume)
    const sections: SectionDef[] = groups.flatMap(({ group, devices: list }): SectionDef[] => [
        {
            key: group.key,
            label: group.label,
            node: (
                <section
                    className="group"
                    aria-labelledby={`group-${group.key}`}
                >
                    <div className="group__head">
                        <h2
                            id={`group-${group.key}`}
                            className="subtitle"
                        >
                            <span aria-hidden="true">{group.icon}</span> {group.label}
                            <span className="group__count">{list.length}</span>
                        </h2>
                        {group.key === 'light' && !editing && lamps.length > 1 && (
                            <button
                                type="button"
                                className="pillbtn"
                                aria-label={`${roomLabel}: alle Lichter ${anyOn ? 'ausschalten' : 'einschalten'}`}
                                onClick={() => switchLights(lamps, !anyOn, states, roomLabel)}
                            >
                                💡 {anyOn ? 'Alle aus' : 'Alle an'}
                            </button>
                        )}
                    </div>
                    {/* Sortieren innerhalb der Gruppe */}
                    <SortableGrid
                        items={list}
                        getId={d => d.id}
                        kind="deviceOrder"
                        render={(d, order) => (
                            <DeviceTile
                                key={d.id}
                                device={d}
                                reorder={{ ids: order, kind: 'deviceOrder' }}
                            />
                        )}
                    />
                </section>
            ),
        },
        ...(group.key === 'light' || (!groups.some(g => g.group.key === 'light') && group === groups[0].group)
            ? [
                  {
                      key: 'scenes',
                      label: 'Szenen',
                      node:
                          sceneGroups.length > 0 ? (
                              <ScenePanel
                                  groups={sceneGroups}
                                  collapsible
                              />
                          ) : null,
                  },
              ]
            : []),
    ]);

    return (
        <>
            <div className="titlebar">
                <button
                    type="button"
                    className="iconbtn"
                    onClick={onBack}
                    aria-label="Zurück"
                >
                    <Icon name="back" />
                </button>
                <div className="titlebar__text">
                    <h1 className="title">{roomLabel}</h1>
                    {(status.temperature !== undefined || status.humidity !== undefined) && (
                        <p className="titlebar__status">
                            {status.temperature !== undefined && (
                                <span>
                                    🌡️ {status.temperature.toLocaleString('de-DE', { maximumFractionDigits: 1 })}°
                                </span>
                            )}
                            {status.humidity !== undefined && <span>💧 {Math.round(status.humidity)} %</span>}
                        </p>
                    )}
                </div>
                <span className="titlebar__spacer" />
                <EditButton />
            </div>
            <EditBanner text="Kachel antippen zum Umbenennen, Verschieben oder Ausblenden · Kacheln und Bereiche am Griff ⠿ ziehen · Bereichs-Anordnung gilt für alle Räume" />
            {devices.length === 0 ? (
                <p className="empty">Keine Geräte in diesem Raum.</p>
            ) : (
                <CustomSections
                    view="room"
                    sections={sections}
                />
            )}
        </>
    );
}
