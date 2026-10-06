import { Pause, Pencil, Play, Trash2 } from "lucide-react";

const iconButton =
  "grid size-11 cursor-pointer place-items-center rounded-full text-muted transition-colors duration-200 hover:bg-canvas hover:text-ink";

/** Icon buttons for a table row; each says which record it acts on ("Editar Internet"). */
export function RowActions({
  label,
  onEdit,
  onDelete,
  onToggle,
  active,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggle?: () => void;
  active?: boolean;
}) {
  return (
    <div className="flex justify-end gap-1">
      {onToggle ? (
        <button type="button" onClick={onToggle} className={iconButton}>
          {active ? (
            <Pause aria-hidden="true" className="size-5" />
          ) : (
            <Play aria-hidden="true" className="size-5" />
          )}
          <span className="sr-only">
            {active ? "Pausar" : "Activar"} {label}
          </span>
        </button>
      ) : null}
      <button type="button" onClick={onEdit} className={iconButton}>
        <Pencil aria-hidden="true" className="size-5" />
        <span className="sr-only">Editar {label}</span>
      </button>
      <button type="button" onClick={onDelete} className={`${iconButton} hover:text-danger`}>
        <Trash2 aria-hidden="true" className="size-5" />
        <span className="sr-only">Eliminar {label}</span>
      </button>
    </div>
  );
}

export const th = "px-3 py-2.5 text-left text-xs font-bold tracking-[0.06em] text-muted";
export const td = "px-3 py-3.5";
