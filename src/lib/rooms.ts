/**
 * Raum-Erkennung aus Namen – wichtig für Installationen ohne gepflegte enum.rooms.
 */

/** Häufige Raumnamen (deutsch + englisch). Längere/spezifischere Begriffe zuerst prüfen. */
export const DEFAULT_ROOM_NAMES: string[] = [
    'Wohnzimmer',
    'Esszimmer',
    'Schlafzimmer',
    'Kinderzimmer',
    'Gästezimmer',
    'Arbeitszimmer',
    'Badezimmer',
    'Gäste-WC',
    'Hauswirtschaftsraum',
    'Treppenhaus',
    'Ankleide',
    'Dachboden',
    'Hobbyraum',
    'Küche',
    'Bad',
    'WC',
    'Flur',
    'Diele',
    'Büro',
    'Keller',
    'Garage',
    'Carport',
    'Garten',
    'Terrasse',
    'Balkon',
    'Eingang',
    'Living Room',
    'Bedroom',
    'Kitchen',
    'Bathroom',
    'Office',
    'Hallway',
];

/** Synonyme → kanonischer Raumname */
const SYNONYMS: Record<string, string> = {
    wohnraum: 'Wohnzimmer',
    wz: 'Wohnzimmer',
    sz: 'Schlafzimmer',
    kiz: 'Kinderzimmer',
    hwr: 'Hauswirtschaftsraum',
    gaestewc: 'Gäste-WC',
    kueche: 'Küche',
    buero: 'Büro',
};

/** Normalisiert für Vergleiche: Kleinbuchstaben, Umlaute ausgeschrieben, nur a-z0-9 */
export function normalize(text: string): string {
    return text
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function slug(text: string): string {
    return normalize(text).replace(/ /g, '-');
}

/** Zerlegt Namen/IDs in Wörter, auch CamelCase ("WohnzimmerDecke" → wohnzimmer decke) */
function tokens(text: string): string[] {
    return normalize(text.replace(/([a-zäöü])([A-ZÄÖÜ])/g, '$1 $2'))
        .split(' ')
        .filter(Boolean);
}

export interface RoomGuess {
    name: string;
    /** Der Teil des Textes, der als Raum erkannt wurde */
    match: string;
}

/**
 * Sucht einen Raumnamen in den übergebenen Texten (Gerätename, Elternname, ID …).
 * Der erste Text mit Treffer gewinnt; innerhalb eines Textes gewinnt der längste Raumname.
 *
 * @param texts Kandidaten in absteigender Priorität
 * @param roomNames bekannte Raumnamen (z. B. vorhandene Enums + Defaults)
 */
export function guessRoom(texts: (string | undefined)[], roomNames: string[] = DEFAULT_ROOM_NAMES): RoomGuess | null {
    const candidates = [...roomNames]
        .map(name => ({ name, norm: normalize(name) }))
        .filter(c => c.norm)
        .sort((a, b) => b.norm.length - a.norm.length);

    for (const text of texts) {
        if (!text) {
            continue;
        }
        const words = tokens(text);
        const joined = ` ${words.join(' ')} `;

        for (const c of candidates) {
            if (joined.includes(` ${c.norm} `)) {
                return { name: c.name, match: c.norm };
            }
        }
        // zusammengesetzte Wörter: "Wohnzimmerlampe", "Kuechenlicht"
        for (const c of candidates) {
            if (c.norm.length >= 4 && !c.norm.includes(' ') && words.some(w => w.startsWith(c.norm))) {
                return { name: c.name, match: c.norm };
            }
        }
        for (const w of words) {
            const syn = SYNONYMS[w];
            if (syn) {
                return { name: syn, match: w };
            }
        }
    }
    return null;
}

/** Entfernt den Raumnamen aus dem Gerätenamen: "Wohnzimmer Deckenlampe" → "Deckenlampe" */
export function stripRoomFromName(name: string, roomName: string): string {
    const pattern = new RegExp(
        `^\\s*${escapeRegExp(roomName)}[\\s_:\\-.]+|[\\s_:\\-.]+${escapeRegExp(roomName)}\\s*$`,
        'i',
    );
    const stripped = name.replace(pattern, '').trim();
    return stripped || name;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
