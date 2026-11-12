import { useEffect, useState } from 'react';
import type { SvWeather } from '../../../src/shared/protocol';
import { useConnection } from '../connection';
import { HistoryPanel, type HistorySeries } from './HistoryPanel';
import { Sheet } from './Sheet';
import { Sparkline } from './Sparkline';
import {
    compass,
    condition,
    fmt,
    formatLux,
    formatMinutes,
    weatherSnapshot,
    windLabel,
    type WeatherSnapshot,
} from '../weather';

/** Aufgezeichnete Wetterwerte (Station, Lichtsensoren, weitere Außensensoren) */
function weatherHistorySeries(weather: SvWeather, extra: SvWeather[] = []): HistorySeries[] {
    const candidates: (HistorySeries | undefined)[] = [
        weather.temperature && { key: 't', label: 'Temperatur', ref: weather.temperature },
        weather.humidity && { key: 'h', label: 'Luftfeuchte', ref: weather.humidity, zeroBased: true },
        weather.windSpeed && { key: 'w', label: 'Wind', ref: weather.windSpeed, zeroBased: true },
        weather.rainToday && { key: 'r', label: 'Regen heute', ref: weather.rainToday, zeroBased: true },
        ...(weather.lightSensors || []).map(l =>
            l.current
                ? { key: `l-${l.name}`, label: `Helligkeit ${l.name}`, ref: l.current, zeroBased: true }
                : undefined,
        ),
        ...extra.flatMap((x, i) => {
            // Lange Gerätenamen ("Temperatur- und Feuchtigkeitssensor") sprengen die Auswahl
            const name = x.name.length <= 16 ? x.name : extra.length > 1 ? `Außensensor ${i + 1}` : 'Außensensor';
            return [
                x.temperature && { key: `x-${x.id}`, label: `Temperatur ${name}`, ref: x.temperature },
                x.humidity && {
                    key: `xh-${x.id}`,
                    label: `Luftfeuchte ${name}`,
                    ref: x.humidity,
                    zeroBased: true,
                },
            ];
        }),
    ];
    return candidates.filter((c): c is HistorySeries => !!c && !!c.ref.history);
}

/** Aufgeklappt (für diese Sitzung gemerkt) */
let compactOpen = false;

/**
 * Wetter. compact (Handy): nur eine Zeile (Symbol, Temperatur, Zustand, Luftfeuchte/Wind);
 * Antippen klappt Details, Temperaturkurve und Helligkeit auf.
 */
export function WeatherCard({
    weather,
    extra,
    compact = false,
}: {
    weather: SvWeather;
    extra?: SvWeather[];
    compact?: boolean;
}): React.JSX.Element {
    const { states } = useConnection();
    const [open, setOpen] = useState(compactOpen);
    // Aktuelle Zeit minütlich auffrischen, um veraltete Messwerte zu erkennen
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, []);
    const [showHistory, setShowHistory] = useState(false);
    const s = weatherSnapshot(weather, states);
    const historySeries = weatherHistorySeries(weather, extra);
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

    const panels = (weather.temperature?.history || s.light.length > 0) && (
        <div className="weather__panels">
            {weather.temperature?.history && (
                <Sparkline
                    state={weather.temperature}
                    label="Temperatur"
                    onOpen={() => setShowHistory(true)}
                />
            )}
            {s.light.length > 0 && <LightBars light={s.light} />}
        </div>
    );
    const sensors = (extra || []).length > 0 && (
        <ul
            className="weather__sensors"
            aria-label="Weitere Außensensoren"
        >
            {(extra || []).map(x => {
                const xs = weatherSnapshot(x, states);
                return (
                    <li key={x.id}>
                        <span className="weather__sensor-name">{x.name}</span>
                        <span className="weather__sensor-values">
                            <span title="Temperatur">🌡️ {fmt(xs.temperature)}°</span>
                            {xs.humidity !== undefined && <span title="Luftfeuchte">💧 {fmt(xs.humidity, 0)} %</span>}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
    const historyButton = historySeries.length > 0 && (
        <button
            type="button"
            className="weather__history"
            onClick={() => setShowHistory(true)}
        >
            📈 Verlauf ›
        </button>
    );
    const historySheet = showHistory && (
        <Sheet
            title="Wetter-Verlauf"
            subtitle={weather.name}
            onClose={() => setShowHistory(false)}
        >
            <HistoryPanel
                series={historySeries}
                title="Verlauf"
            />
        </Sheet>
    );
    const tone = `weather weather--${c.label === 'Sonnig' ? 'sun' : s.raining ? 'rain' : 'neutral'}`;
    const warn = (!s.online || stale) && (
        <p className="weather__warn">
            {!s.online ? 'Wetterstation nicht erreichbar' : `Letzter Messwert ${updated!.toLocaleString('de-DE')}`}
        </p>
    );

    if (compact) {
        const summary = [
            weather.humidity && s.humidity !== undefined ? `💧 ${fmt(s.humidity, 0)} %` : undefined,
            weather.windSpeed && s.windSpeed !== undefined ? `💨 ${fmt(s.windSpeed, 0)} km/h` : undefined,
        ].filter(Boolean);
        const toggle = (): void => {
            compactOpen = !open;
            setOpen(!open);
        };
        return (
            <section
                className={`${tone} weather--compact${open ? ' is-open' : ''}`}
                aria-label="Aktuelles Wetter"
            >
                <button
                    type="button"
                    className="weather__bar"
                    aria-expanded={open}
                    onClick={toggle}
                >
                    <span
                        className="weather__bar-icon"
                        aria-hidden="true"
                    >
                        {c.icon}
                    </span>
                    <span className="weather__bar-temp">
                        {s.temperature !== undefined ? `${fmt(s.temperature)}°` : '–'}
                    </span>
                    <span className="weather__bar-text">
                        <span className="weather__bar-label">
                            {c.label}
                            {s.windAlarm && c.label !== 'Stürmisch' ? ' · Sturmwarnung' : ''}
                        </span>
                        {summary.length > 0 && <span className="weather__bar-extra">{summary.join(' · ')}</span>}
                    </span>
                    <span
                        className="chevron"
                        aria-hidden="true"
                    />
                    <span className="sr-only">{open ? 'Details ausblenden' : 'Details anzeigen'}</span>
                </button>
                {warn}
                {open && (
                    <div className="weather__more">
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
                        {panels}
                        {sensors}
                        {historyButton}
                    </div>
                )}
                {historySheet}
            </section>
        );
    }

    return (
        <section
            className={tone}
            aria-label="Aktuelles Wetter"
        >
            <div className="weather__top">
                <div className="weather__main">
                    <span
                        className="weather__icon"
                        aria-hidden="true"
                    >
                        {c.icon}
                    </span>
                    <div>
                        <div className="weather__temp">
                            {s.temperature !== undefined ? `${fmt(s.temperature)}°` : '–'}
                        </div>
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
            </div>
            {panels}
            {sensors}
            {historyButton}
            {historySheet}
            {warn}
        </section>
    );
}

/**
 * Helligkeit je Himmelsrichtung als Balken – relativ zum hellsten Sensor,
 * damit man sofort sieht, wo die Sonne gerade steht.
 */
function LightBars({ light }: { light: WeatherSnapshot['light'] }): React.JSX.Element {
    const max = Math.max(0, ...light.map(l => (l.online ? (l.lux ?? 0) : 0)));
    return (
        <div
            className="weather__light"
            aria-label="Helligkeit je Himmelsrichtung"
        >
            <span className="weather__light-title">☀️ Helligkeit</span>
            <dl>
                {light.map(l => {
                    const share = l.online && max > 0 ? Math.max(0, (l.lux ?? 0) / max) : 0;
                    return (
                        <div
                            key={l.name}
                            className="lightbar"
                            title={l.average !== undefined ? `Mittelwert ${formatLux(l.average)}` : undefined}
                        >
                            <dt>{l.name}</dt>
                            <dd>
                                <span
                                    className="lightbar__track"
                                    aria-hidden="true"
                                >
                                    <span
                                        className="lightbar__fill"
                                        style={{ width: `${Math.round(share * 100)}%` }}
                                    />
                                </span>
                                <span className="lightbar__value">
                                    {l.online ? formatLux(l.lux) : 'nicht erreichbar'}
                                </span>
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </div>
    );
}
