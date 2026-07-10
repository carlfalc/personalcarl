import { cn } from "@/lib/utils";
import { Archive, Trash2, Plus } from "lucide-react";
import type { ThreadSummary } from "@/lib/messages.functions";

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function ThreadList({
  threads,
  activeId,
  onSelect,
  onNew,
  onArchive,
  onDelete,
}: {
  threads: ThreadSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Inbox</h2>
        <button
          onClick={onNew}
          className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No conversations yet. Click "New" to start one.
          </div>
        )}
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={cn(
              "group flex w-full items-start gap-3 border-b px-3 py-3 text-left transition hover:bg-secondary/60",
              activeId === t.id && "bg-secondary",
              t.archived && "opacity-60",
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {t.title.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">{t.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {t.last_message ? relTime(t.last_message.created_at) : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "flex-1 truncate text-xs",
                  t.unread_count > 0 ? "font-semibold text-foreground" : "text-muted-foreground",
                )}>
                  {t.last_message?.body || "No messages yet"}
                </span>
                {t.unread_count > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {t.unread_count}
                  </span>
                )}
              </div>
              <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(t.id, !t.archived);
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  title={t.archived ? "Unarchive" : "Archive"}
                >
                  <Archive className="h-3 w-3" />
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete conversation with ${t.title}? This cannot be undone.`)) {
                      onDelete(t.id);
                    }
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Delete conversation"
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
