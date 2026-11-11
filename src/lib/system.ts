import type { SvHostStatus, SvInstanceStatus, SvSystemStatus } from '../shared/protocol';
import { getName } from './names';
import { ref, type ObjectMap } from './profiles/types';

/**
 * Zustand von ioBroker aus den System-Objekten: Hosts (system.host.<name>.*) und
 * Adapter-Instanzen (system.adapter.<adapter>.<n> mit alive/connected und <adapter>.<n>.info.connection).
 * Arbeitet bewusst auf allen Objekten – "system" steht standardmäßig auf der Ignorierliste der Erkennung.
 */
export function systemStatus(objects: ObjectMap, lang: string): SvSystemStatus {
    const hosts: SvHostStatus[] = [];
    const instances: SvInstanceStatus[] = [];
    for (const [id, obj] of Object.entries(objects)) {
        if (obj?.type === 'host' && /^system\.host\.[^.]+$/.test(id)) {
            const common = obj.common as { name?: string; hostname?: string; installedVersion?: string };
            const s = (key: string, label: string): ReturnType<typeof ref> => ref(objects, `${id}.${key}`, label);
            hosts.push({
                id,
                name: common.hostname || common.name || id.split('.').pop()!,
                controllerVersion: common.installedVersion,
                alive: s('alive', 'Läuft'),
                cpu: s('cpu', 'Prozessor'),
                mem: s('mem', 'Arbeitsspeicher'),
                memAvailable: s('memAvailable', 'Speicher frei'),
                load: s('load', 'Last'),
                uptime: s('uptime', 'Laufzeit'),
                diskFree: s('diskFree', 'Festplatte frei'),
                diskSize: s('diskSize', 'Festplatte'),
                diskWarning: s('diskWarning', 'Warnschwelle Festplatte'),
                nodeVersion: s('versions.nodeCurrent', 'Node.js') || s('nodeVersion', 'Node.js'),
                nodeNewest: s('versions.nodeNewest', 'Node.js aktuell'),
            });
            continue;
        }
        const m = /^system\.adapter\.([^.]+)\.(\d+)$/.exec(id);
        if (m && obj?.type === 'instance') {
            const common = obj.common as ioBroker.InstanceCommon & { titleLang?: Record<string, string> };
            const instance = `${m[1]}.${m[2]}`;
            instances.push({
                id: instance,
                adapter: m[1],
                title: common.titleLang?.[lang] || common.titleLang?.en || common.title || getName(obj, lang) || m[1],
                version: common.version,
                mode: common.mode,
                enabled: common.enabled === true,
                host: common.host,
                alive: ref(objects, `${id}.alive`, 'Läuft'),
                connected: ref(objects, `${id}.connected`, 'Mit Host verbunden'),
                connection: ref(objects, `${instance}.info.connection`, 'Verbunden'),
            });
        }
    }
    hosts.sort((a, b) => a.name.localeCompare(b.name));
    instances.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    return { hosts, instances };
}

/** Alle State-Referenzen der Statuskarte (nur lesend abonnieren) */
export function systemStateIds(status: SvSystemStatus): string[] {
    const ids: string[] = [];
    for (const item of [...status.hosts, ...status.instances]) {
        for (const v of Object.values(item)) {
            if (v && typeof v === 'object' && 'id' in v && typeof (v as { id: unknown }).id === 'string') {
                ids.push((v as { id: string }).id);
            }
        }
    }
    return ids;
}
