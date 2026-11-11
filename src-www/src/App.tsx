import { useEffect, useState } from 'react';
import { Icon } from './components/Icon';
import { useConnection } from './connection';
import { DetailContext } from './detail';
import { EditContext } from './editing';
import { EditDeviceSheet } from './views/EditSheets';
import { DeviceDetail } from './views/DeviceDetail';
import { EnergyView } from './views/EnergyView';
import { HomeView } from './views/HomeView';
import { MoreView } from './views/MoreView';
import { RoomView } from './views/RoomView';
import { RoomsView } from './views/RoomsView';
import { ShutterView } from './views/ShutterView';

/** Einfaches Hash-Routing: #/home, #/rooms, #/rooms/<id>, #/more */
function useRoute(): [string[], (path: string) => void] {
    const read = (): string[] => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const [route, setRoute] = useState(read);
    useEffect(() => {
        const onChange = (): void => setRoute(read());
        window.addEventListener('hashchange', onChange);
        return () => window.removeEventListener('hashchange', onChange);
    }, []);
    return [route, path => (window.location.hash = `/${path}`)];
}

const TABS = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'rooms', label: 'Räume', icon: 'rooms' },
    { id: 'energy', label: 'Energie', icon: 'energy', needs: 'energy' },
    { id: 'shutters', label: 'Beschattung', icon: 'blind', needs: 'shutters' },
    { id: 'more', label: 'Mehr', icon: 'more' },
];

export function App(): React.JSX.Element {
    const [route, navigate] = useRoute();
    const { status, model } = useConnection();
    const tabs = TABS.filter(
        t =>
            !t.needs ||
            (t.needs === 'energy' &&
                (!!model?.energy.length || !!model?.wallboxes.length || !!model?.pvForecast.length)) ||
            (t.needs === 'shutters' && !!model?.shutterControl.length),
    );
    const [tab = 'home', param] = route;
    const [detailId, setDetailId] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);

    let view: React.JSX.Element;
    if (tab === 'rooms' && param) {
        view = (
            <RoomView
                roomId={decodeURIComponent(param)}
                onBack={() => navigate('rooms')}
            />
        );
    } else if (tab === 'rooms') {
        view = <RoomsView onNavigate={navigate} />;
    } else if (tab === 'shutters') {
        view = <ShutterView />;
    } else if (tab === 'energy') {
        view = <EnergyView />;
    } else if (tab === 'more') {
        view = <MoreView />;
    } else {
        view = <HomeView onNavigate={navigate} />;
    }

    return (
        <EditContext.Provider value={{ editing: editing && !!model?.editable, setEditing }}>
            <DetailContext.Provider value={setDetailId}>
                <div className="app">
                    <nav
                        className="nav"
                        aria-label="Hauptnavigation"
                    >
                        <div className="nav__brand">SmartVis</div>
                        {tabs.map(t => (
                            <a
                                key={t.id}
                                href={`#/${t.id}`}
                                className={`nav__item${tab === t.id ? ' nav__item--active' : ''}`}
                            >
                                <Icon name={t.icon} />
                                <span>{t.label}</span>
                            </a>
                        ))}
                    </nav>
                    <main className="main">
                        {status !== 'online' && (
                            <div
                                className={`banner banner--${status}`}
                                role="status"
                            >
                                {status === 'connecting' ? 'Verbinde …' : 'Keine Verbindung – versuche erneut …'}
                            </div>
                        )}
                        {view}
                    </main>
                    {detailId &&
                        (editing && model?.editable ? (
                            <EditDeviceSheet
                                deviceId={detailId}
                                onClose={() => setDetailId(null)}
                            />
                        ) : (
                            <DeviceDetail
                                deviceId={detailId}
                                onClose={() => setDetailId(null)}
                            />
                        ))}
                </div>
            </DetailContext.Provider>
        </EditContext.Provider>
    );
}
