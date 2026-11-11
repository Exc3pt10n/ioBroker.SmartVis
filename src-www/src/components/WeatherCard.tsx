import { useEffect, useState } from 'react';
import type { SvWeather } from '../../../src/shared/protocol';
import { useConnection } from '../connection';
import { compass, condition, fmt, formatLux, formatMinutes, weatherSnapshot, windLabel } from '../weather';

export function WeatherCard({ weather, extra }: { weather: SvWeather; extra?: SvWeather[] }): React.JSX.Element {
    const { states } = useConnection();
    // Aktuelle Zeit minütlich auffrischen, um veraltete Messwerte zu erkennen
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, []);
    const s = weatherSnapshot(weather, states);
    const c = condition(s);
    const updated = s.updated ? new Date(s.updated) : undefined;
    const stale = updated ? now - updated.getTime() > 60 * 60 * 1000 : false;

    const details: { label: string; value: string }[] = [];
    if (weather.humidity) {
        details.push({ label: 'Luftfeuchte', value: `${fmt(s.humidity, 0)} %` });
    }
    if (weather.windSpeed) {
        details.push({
            label: s.windSpeed !== undefined ? `Wind · ${windLabel(s.windSpeed)}` : 'Wind',
            value: `${fmt(s.windSpeed, 0)} km/h${s.windDirection !== undefined ? ` ${compass(s.windDirection)}` : ''}`,
        });
    }
    if (weather.rainToday) {
        details.push({ label: 'Regen heute', value: `${fmt(s.rainToday)} mm` });
    }
    if (weather.sunshineToday) {
        details.push({
            label: 'Sonne heute',
            value: s.sunshineToday !== undefined ? formatMinutes(s.sunshineToday) : '–',
        });
    }

    return (
        <section
            className={`weather weather--${c.label === 'Sonnig' ? 'sun' : s.raining ? 'rain' : 'neutral'}`}
            aria-label="Aktuelles Wetter"
        >
            <div className="weather__main">
                <span
                    className="weather__icon"
                    aria-hidden="true"
                >
                    {c.icon}
                </span>
                <div>
                    <div className="weather__temp">{s.temperature !== undefined ? `${fmt(s.temperature)}°` : '–'}</div>
                    <div className="weather__label">
                        {c.label}
                        {s.windAlarm && c.label !== 'Stürmisch' ? ' · Sturmwarnung' : ''}
                    </div>
                </div>
            </div>
            {details.length > 0 && (
                <dl className="weather__details">
                    {details.map(d => (
                        <div key={d.label}>
                            <dt>{d.label}</dt>
                            <dd>{d.value}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {s.light.length > 0 && (
                <div
                    className="weather__light"
                    aria-label="Helligkeit je Himmelsrichtung"
                >
                    <span className="weather__light-title">☀️ Helligkeit</span>
                    <dl>
                        {s.light.map(l => (
                            <div
                                key={l.name}
                                title={l.average !== undefined ? `Mittelwert ${formatLux(l.average)}` : undefined}
                            >
                                <dt>{l.name}</dt>
                                <dd>{l.online ? formatLux(l.lux) : 'nicht erreichbar'}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}
            {(extra || []).map(x => {
                const xs = weatherSnapshot(x, states);
                return (
                    <p
                        key={x.id}
                        className="weather__extra"
                    >
                        {x.name}: {fmt(xs.temperature)}°{xs.humidity !== undefined ? ` · ${fmt(xs.humidity, 0)} %` : ''}
                    </p>
                );
            })}
            {(!s.online || stale) && (
                <p className="weather__warn">
                    {!s.online
                        ? 'Wetterstation nicht erreichbar'
                        : `Letzter Messwert ${updated!.toLocaleString('de-DE')}`}
                </p>
            )}
        </section>
    );
}
