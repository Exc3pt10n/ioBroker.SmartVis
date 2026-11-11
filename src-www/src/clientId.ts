/** Stabile Kennung dieses Endgeräts (im Browser gespeichert) für Anpassungen je Gerät */
const KEY = 'smartvis.clientId';
let memory: string | undefined;

function randomId(): string {
    // getRandomValues gibt es auch ohne HTTPS (randomUUID nicht)
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function getClientId(): string {
    try {
        let id = window.localStorage.getItem(KEY);
        if (!id || !/^[a-z0-9-]{8,64}$/i.test(id)) {
            id = randomId();
            window.localStorage.setItem(KEY, id);
        }
        return id;
    } catch {
        // Kein Speicher (privates Fenster): Kennung gilt bis zum Neuladen
        memory ||= randomId();
        return memory;
    }
}

/** Namensvorschlag aus dem Browser, z. B. "iPhone · Safari" oder "Windows · Edge" */
export function suggestedName(ua = navigator.userAgent): string {
    const device = /iPhone/.test(ua)
        ? 'iPhone'
        : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
          ? 'iPad'
          : /Android/.test(ua)
            ? /Mobile/.test(ua)
                ? 'Android-Handy'
                : 'Android-Tablet'
            : /Windows/.test(ua)
              ? 'Windows'
              : /Macintosh|Mac OS X/.test(ua)
                ? 'Mac'
                : /Linux/.test(ua)
                  ? 'Linux'
                  : 'Gerät';
    const browser = /Edg\//.test(ua)
        ? 'Edge'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : '';
    return browser ? `${device} · ${browser}` : device;
}
