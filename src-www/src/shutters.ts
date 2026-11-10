import type { SvAutoShutter, SvModel, SvStateValue } from '../../src/shared/protocol';

/** Status-Texte von shuttercontrol (shutters.autoState) */
const AUTO_STATE: Record<string, { label: string; icon: string }> = {
    up: { label: 'Geöffnet', icon: '⬆️' },
    down: { label: 'Geschlossen', icon: '⬇️' },
    sunProtect: { label: 'Sonnenschutz', icon: '🕶️' },
    manu_sunProtect: { label: 'Sonnenschutz (manuell)', icon: '🕶️' },
    OpenInSunProtect: { label: 'Fenster offen im Sonnenschutz', icon: '🪟' },
    triggered: { label: 'Fenster offen', icon: '🪟' },
    Manu_Mode: { label: 'Manuell', icon: '✋' },
    none: { label: 'Kein Status', icon: '·' },
    wind1: { label: 'Windalarm 1', icon: '💨' },
    wind2: { label: 'Windalarm 2', icon: '💨' },
    rain: { label: 'Regenalarm', icon: '🌧️' },
    frost: { label: 'Frostalarm', icon: '❄️' },
    fire: { label: 'Feueralarm', icon: '🔥' },
};

export function autoStateInfo(
    val: string | number | boolean | null | undefined,
): { label: string; icon: string } | undefined {
    if (val === null || val === undefined || val === '') {
        return undefined;
    }
    return AUTO_STATE[String(val)] || { label: String(val), icon: '·' };
}

/** Rollladen der Automatik zu einer Kachel (über den Level-State) finden */
export function shutterForDevice(model: SvModel | undefined, stateIds: string[]): SvAutoShutter | undefined {
    for (const sc of model?.shutterControl || []) {
        const s = sc.shutters.find(x => x.level && stateIds.includes(x.level.id));
        if (s) {
            return s;
        }
    }
    return undefined;
}

export function text(states: Record<string, SvStateValue | null>, id: string | undefined): string | undefined {
    const v = id ? states[id]?.val : undefined;
    return v === null || v === undefined || v === '' ? undefined : String(v);
}

/** shuttercontrol liefert Zeiten teils als "07:30", teils als Datum-String → "07:30" */
export function timeText(states: Record<string, SvStateValue | null>, id: string | undefined): string | undefined {
    const t = text(states, id);
    if (!t) {
        return undefined;
    }
    const m = /(\d{1,2}):(\d{2})/.exec(t);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
}
