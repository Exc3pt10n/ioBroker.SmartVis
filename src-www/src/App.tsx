import { useEffect, useState } from 'react';
import { Icon } from './components/Icon';
import { useConnection } from './connection';
import { EnergyView } from './views/EnergyView';
import { HomeView } from './views/HomeView';
import { MoreView } from './views/MoreView';
import { RoomView } from './views/RoomView';
import { RoomsView } from './views/RoomsView';

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
    { id: 'energy', label: 'Energie', icon: 'energy', needsEnergy: true },
    { id: 'more', label: 'Mehr', icon: 'more' },
];

export function App(): React.JSX.Element {
    const [route, navigate] = useRoute();
    const { status, model } = useConnection();
    const tabs = TABS.filter(t => !t.needsEnergy || !!model?.energy.length || !!model?.wallboxes.length);
    const [tab = 'home', param] = route;

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
    } else if (tab === 'energy') {
        view = <EnergyView />;
    } else if (tab === 'more') {
        view = <MoreView />;
    } else {
        view = <HomeView onNavigate={navigate} />;
    }

    return (
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
        </div>
    );
}
