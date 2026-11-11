import { useConnection } from '../connection';
import { useEditing } from '../editing';

/** Bearbeiten/Fertig-Knopf für Titelzeilen (nur sichtbar, wenn der Adapter es erlaubt) */
export function EditButton(): React.JSX.Element | null {
    const { model } = useConnection();
    const { editing, setEditing } = useEditing();
    if (!model?.editable) {
        return null;
    }
    return (
        <button
            type="button"
            className={`editbtn${editing ? ' editbtn--active' : ''}`}
            onClick={() => setEditing(!editing)}
            aria-pressed={editing}
        >
            {editing ? 'Fertig' : '✎ Bearbeiten'}
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
