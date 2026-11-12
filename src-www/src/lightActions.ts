import type { SvDevice, SvStateValue } from '../../src/shared/protocol';
import { connection } from './connection';
import { showToast } from './components/Toast';
import { lightChanges } from './rooms';

/** Lampen aus-/einschalten, mit Rückmeldung und "Rückgängig" */
export function switchLights(
    lights: SvDevice[],
    on: boolean,
    states: Record<string, SvStateValue | null>,
    where?: string,
): void {
    const changes = lightChanges(lights, on, states);
    if (!changes.length) {
        return;
    }
    for (const c of changes) {
        connection.setState(c.id, c.val);
    }
    const n = changes.length;
    showToast(
        `${n} ${n === 1 ? 'Licht' : 'Lichter'} ${on ? 'eingeschaltet' : 'ausgeschaltet'}${where ? ` · ${where}` : ''}`,
        () => {
            for (const c of changes) {
                if (c.prev !== undefined && c.prev !== null) {
                    connection.setState(c.id, c.prev);
                }
            }
        },
    );
}
