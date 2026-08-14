import type { StatusHistoryEntry } from "@/lib/types";
import { noteLabel } from "@/lib/noteCodes";
import { fmtDateTime } from "@/lib/tz";

// Admin-authored free-text notes, newest first. Read-only — capture happens
// via QuickActions, never here.
export function NotesSection({ entries }: { entries: StatusHistoryEntry[] }) {
  const notes = entries.filter((e) => e.note_text);
  if (notes.length === 0) {
    return <p className="text-sm text-muted">No notes yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {notes.map((e) => (
        <li key={e.id} className="rounded-lg border border-line px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted">{noteLabel(e.note_code)}</span>
            <span className="text-xs text-muted">{fmtDateTime(e.changed_at)}</span>
          </div>
          <p className="mt-1 text-sm text-ink">{e.note_text}</p>
        </li>
      ))}
    </ul>
  );
}
