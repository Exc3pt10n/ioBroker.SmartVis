import { useConnection } from '../connection';
import { useEditing } from '../editing';
import { Icon } from './Icon';

/** Bearbeiten/Fertig-Knopf für Titelzeilen (nur sichtbar, wenn der Adapter es erlaubt) */
export function EditButton(): React.JSX.Element | null {
    const { model } = useConnection();
    const { editing, setEditing } = useEditing();
    if (!model?.editable) {
        return null;
    }
    return (
        // Selten gebraucht: im Alltag nur ein dezentes Stift-Symbol, im Bearbeiten-Modus deutlich "Fertig"
        <button
            type="button"
            className={`editbtn${editing ? ' editbtn--active' : ' editbtn--icon'}`}
            onClick={() => setEditing(!editing)}
            aria-pressed={editing}
            aria-label={editing ? undefined : 'Bearbeiten'}
            title={editing ? undefined : 'Anordnen, umbenennen, ausblenden'}
        >
            {editing ? (
                'Fertig'
            ) : (
                <Icon
                    name="edit"
                    size={20}
                />
            )}
        </button>
    );
}

/** Hinweisleiste im Bearbeiten-Modus */
export function EditBanner({ text }: { text: string }): React.JSX.Element | null {
    const { editing } = useEditing();
    const { lastError } = useConnection();
    if (!editing) {
        return null;
    }
    return (
        <div
            className="editbanner"
            role="status"
        >
            {lastError ? `⚠️ ${lastError}` : text}
        </div>
    );
}

/** Pfeil-Knöpfe zum Verschieben (Kacheln, Räume) */
export function MoveButtons({
    label,
    onMove,
    canBack,
    canForward,
}: {
    label: string;
    onMove: (delta: -1 | 1) => void;
    canBack: boolean;
    canForward: boolean;
}): React.JSX.Element {
    return (
        <div className="movebtns">
            <button
                type="button"
                aria-label={`${label} nach vorne`}
                disabled={!canBack}
                onClick={() => onMove(-1)}
            >
                ←
            </button>
            <button
                type="button"
                aria-label={`${label} nach hinten`}
                disabled={!canForward}
                onClick={() => onMove(1)}
            >
                →
            </button>
        </div>
    );
}
