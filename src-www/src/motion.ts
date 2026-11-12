import { useSyncExternalStore } from 'react';

/** Animationen: wie im System (prefers-reduced-motion), immer an oder aus – je Gerät/Browser */
export type MotionSetting = 'system' | 'on' | 'off';

const KEY = 'smartvis.motion';
const EVENT = 'smartvis-motion';
const REDUCE = '(prefers-reduced-motion: reduce)';

export function getMotion(): MotionSetting {
    try {
        const v = window.localStorage.getItem(KEY);
        return v === 'on' || v === 'off' ? v : 'system';
    } catch {
        return 'system';
    }
}

/** Einstellung am <html>-Element setzen; das CSS richtet die Animationen danach aus */
export function applyMotion(setting: MotionSetting = getMotion()): void {
    if (setting === 'system') {
        delete document.documentElement.dataset.motion;
    } else {
        document.documentElement.dataset.motion = setting;
    }
}

export function setMotion(setting: MotionSetting): void {
    try {
        if (setting === 'system') {
            window.localStorage.removeItem(KEY);
        } else {
            window.localStorage.setItem(KEY, setting);
        }
    } catch {
        // Speicher nicht verfügbar (privates Fenster) – gilt dann bis zum Neuladen
    }
    applyMotion(setting);
    window.dispatchEvent(new Event(EVENT));
}

export function useMotion(): { setting: MotionSetting; systemReduced: boolean } {
    const setting = useSyncExternalStore(onChange => {
        window.addEventListener(EVENT, onChange);
        return () => window.removeEventListener(EVENT, onChange);
    }, getMotion);
    const systemReduced = useSyncExternalStore(
        onChange => {
            const mql = window.matchMedia(REDUCE);
            mql.addEventListener('change', onChange);
            return () => mql.removeEventListener('change', onChange);
        },
        () => window.matchMedia(REDUCE).matches,
    );
    return { setting, systemReduced };
}

/** Sollen Bewegungen (z. B. weiches Scrollen) gerade laufen? */
export function motionAllowed(): boolean {
    const setting = getMotion();
    return setting === 'on' || (setting === 'system' && !window.matchMedia(REDUCE).matches);
}
