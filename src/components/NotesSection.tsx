import type { StatusHistoryEntry } from "@/lib/types";
import { noteLabel } from "@/lib/noteCodes";
import { fmtDateTime } from "@/lib/tz";
import { EmptyState } from "@/components/ui";

// Admin-authored free-text notes, newest first. Read-only — capture happens
// with each action, never here.
export function NotesSection({ entries }: { entries: StatusHistoryEntry[] }) {
  const notes = entries.filter((e) => e.note_text);
  if (notes.length === 0) {
    return <EmptyState icon="note" title="No Notes Yet" compact>Notes added with an action show up here.</EmptyState>;
  }
  return (
    <ul className="space-y-2.5">
      {notes.map((e) => (
        <li key={e.id} className="rounded-ctl border border-line bg-surface-neutral px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs font-semibold text-navy">{noteLabel(e.note_code)}</span>
            <span className="num text-[10.5px] text-muted">{fmtDateTime(e.changed_at)}</span>
          </div>
          <p className="mt-1 text-sm text-ink">{e.note_text}</p>
        </li>
      ))}
    </ul>
  );
}
