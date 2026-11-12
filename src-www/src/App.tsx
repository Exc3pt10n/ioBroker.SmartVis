import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { Toast } from './components/Toast';
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
function readRoute(): string[] {
    return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

/** Scroll-Position je Seite, damit "Zurück" (und Tab-Wechsel) dort weitermacht, wo man war */
const scrollPositions = new Map<string, number>();

function useRoute(): [string[], (path: string) => void] {
    const [route, setRoute] = useState(readRoute);
    useEffect(() => {
        // Wiederherstellen übernehmen wir selbst (der Browser kennt die Höhe der neuen Seite noch nicht)
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        const onChange = (): void =>
            setRoute(prev => {
                const next = readRoute();
                return next.join('/') === prev.join('/') ? prev : next;
            });
        window.addEventListener('hashchange', onChange);
        window.addEventListener('popstate', onChange);
        return () => {
            window.removeEventListener('hashchange', onChange);
            window.removeEventListener('popstate', onChange);
        };
    }, []);
    const navigate = (path: string): void => {
        if (path === readRoute().join('/')) {
            return;
        }
        // Eintrag als "in der App navigiert" markieren: Zurück kann dann history.back() nutzen
        history.pushState({ sv: true }, '', `#/${path}`);
        setRoute(readRoute());
    };
    return [route, navigate];
}

/**
 * Scroll-Position je Seite merken und beim Wiederkommen herstellen.
 * Raum-Seiten (Unterseiten) öffnen immer oben.
 */
function useScrollMemory(route: string[]): void {
    const key = route.join('/') || 'home';
    const current = useRef(key);
    useEffect(() => {
        const onScroll = (): void => {
            scrollPositions.set(current.current, window.scrollY);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    useLayoutEffect(() => {
        if (current.current === key) {
            return;
        }
        current.current = key;
        window.scrollTo(0, route.length > 1 ? 0 : (scrollPositions.get(key) ?? 0));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
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
    useScrollMemory(route);
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
                onBack={() =>
                    // Zurück dorthin, woher man kam (Raumliste oder Startseite); sonst zur Raumliste
                    (history.state as { sv?: boolean } | null)?.sv ? history.back() : navigate('rooms')
                }
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
                    <Toast />
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
