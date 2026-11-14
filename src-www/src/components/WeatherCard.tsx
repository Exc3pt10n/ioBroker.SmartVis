import { useEffect, useState } from 'react';
import type { SvWeather, SvWeatherWarning } from '../../../src/shared/protocol';
import { useConnection } from '../connection';
import { HistoryPanel, type HistorySeries } from './HistoryPanel';
import { Sheet } from './Sheet';
import { Sparkline } from './Sparkline';
import {
    activeWarnings,
    compass,
    condition,
    fmt,
    forecastSnapshot,
    formatLux,
    formatMinutes,
    serviceCondition,
    weatherSnapshot,
    windLabel,
    type ForecastSnapshot,
    type WarningSnapshot,
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
    service,
    warnings = [],
    compact = false,
}: {
    /** Hauptquelle: eigene Station oder (ohne Station) ein Wetterdienst */
    weather: SvWeather;
    /** Weitere Außensensoren (Stationen) */
    extra?: SvWeather[];
    /** Wetterdienst für Wetterlage und Vorhersage (kann gleich weather sein) */
    service?: SvWeather;
    /** Amtliche Warnungen (DWD) */
    warnings?: SvWeatherWarning[];
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
    const isService = weather.source === 'service';
    // Wetterlage: Regen und Sturm misst die eigene Station verlässlich, sonst zählt der Wetterdienst
    const fromService = service ? serviceCondition(service, service.codeScheme, states) : undefined;
    const derived = condition(s);
    const c =
        (!isService && (s.raining || s.windAlarm)) || !fromService
            ? derived
            : { icon: fromService.icon, label: fromService.label || derived.label };
    const forecast = service ? forecastSnapshot(service, states, new Date(now)) : [];
    const active = activeWarnings(warnings, states, now);
    const updated = s.updated ? new Date(s.updated) : undefined;
    // Wetterdienste melden seltener (teils alle paar Stunden) als eine Station
    const stale = updated ? now - updated.getTime() > (isService ? 6 : 1) * 60 * 60 * 1000 : false;

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
    const pressure = weather.pressure ? Number(states[weather.pressure.id]?.val) : NaN;
    if (weather.pressure && Number.isFinite(pressure)) {
        details.push({ label: 'Luftdruck', value: `${fmt(pressure, 0)} ${weather.pressure.unit || 'hPa'}` });
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
    const warningList = active.length > 0 && (
        <WeatherWarnings
            warnings={active}
            now={now}
        />
    );
    const forecastRow = forecast.length > 0 && (
        <ForecastRow
            days={forecast}
            source={service!.name}
        />
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
                {warningList}
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
                        {forecastRow}
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
            {warningList}
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
            {forecastRow}
            {panels}
            {sensors}
            {historyButton}
            {historySheet}
            {warn}
        </section>
    );
}

function timeText(ts: number): string {
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
        ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Nur Warnungen (DWD ohne Wetterstation und Wetterdienst) */
export function WarningsCard({ warnings }: { warnings: SvWeatherWarning[] }): React.JSX.Element | null {
    const { states } = useConnection();
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, []);
    const active = activeWarnings(warnings, states, now);
    return active.length ? (
        <section
            className="card"
            aria-label="Wetterwarnungen"
        >
            <WeatherWarnings
                warnings={active}
                now={now}
            />
        </section>
    ) : null;
}

/** Amtliche Warnungen (DWD): Farbe nach Stufe, Antippen zeigt Beschreibung und Verhaltenshinweise */
export function WeatherWarnings({ warnings, now }: { warnings: WarningSnapshot[]; now: number }): React.JSX.Element {
    return (
        <ul
            className="wwarn"
            aria-label="Wetterwarnungen"
        >
            {warnings.map(w => {
                const when = [
                    w.begin && w.begin > now ? `ab ${timeText(w.begin)}` : undefined,
                    w.end ? `bis ${timeText(w.end)}` : undefined,
                ]
                    .filter(Boolean)
                    .join(' ');
                return (
                    <li
                        key={w.id}
                        className={`wwarn__item wwarn__item--${w.tone}`}
                    >
                        <details>
                            <summary>
                                <span aria-hidden="true">⚠️</span> <span className="wwarn__headline">{w.headline}</span>
                                {when && <span className="wwarn__when"> · {when}</span>}
                            </summary>
                            {w.description && <p>{w.description}</p>}
                            {w.instruction && <p className="wwarn__instruction">{w.instruction}</p>}
                        </details>
                    </li>
                );
            })}
        </ul>
    );
}

/** Tagesvorhersage des Wetterdienstes */
function ForecastRow({ days, source }: { days: ForecastSnapshot[]; source: string }): React.JSX.Element {
    return (
        <div className="wforecast">
            <ol
                className="wforecast__days"
                aria-label={`Vorhersage (${source})`}
            >
                {days.map(d => (
                    <li
                        key={d.offset}
                        className="wforecast__day"
                    >
                        <span className="wforecast__label">{d.label}</span>
                        <span
                            className="wforecast__icon"
                            title={d.condition?.label}
                            aria-label={d.condition?.label}
                            role="img"
                        >
                            {d.condition?.icon ?? '–'}
                        </span>
                        <span className="wforecast__temp">
                            <strong>{d.max !== undefined ? `${fmt(d.max, 0)}°` : '–'}</strong>
                            {d.min !== undefined && <span className="wforecast__min"> {fmt(d.min, 0)}°</span>}
                        </span>
                        {d.rainChance !== undefined && d.rainChance >= 10 ? (
                            <span
                                className="wforecast__rain"
                                title="Regenwahrscheinlichkeit"
                            >
                                💧{fmt(d.rainChance, 0)} %
                            </span>
                        ) : d.rainChance === undefined && d.rain !== undefined && d.rain >= 0.1 ? (
                            <span
                                className="wforecast__rain"
                                title="Niederschlag"
                            >
                                {fmt(d.rain)} mm
                            </span>
                        ) : (
                            <span className="wforecast__rain wforecast__rain--none" />
                        )}
                    </li>
                ))}
            </ol>
            <p className="wforecast__source">Vorhersage: {source}</p>
        </div>
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
