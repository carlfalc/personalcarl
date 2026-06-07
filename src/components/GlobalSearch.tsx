import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type Hit =
  | { kind: "entry"; id: string; title: string; subtitle: string; type: string }
  | { kind: "meeting"; id: string; title: string; subtitle: string }
  | { kind: "memory"; id: string; title: string; subtitle: string };

function destFor(h: Hit): string {
  if (h.kind === "meeting") return "/meetings";
  if (h.kind === "memory") return "/settings";
  if (h.kind === "entry") {
    if (h.type === "diary") return "/diary";
    if (h.type === "idea") return "/ideas";
    if (h.type === "todo") return "/todos";
    return "/tasks";
  }
  return "/";
}

function badgeFor(h: Hit): string {
  if (h.kind === "meeting") return "Meeting";
  if (h.kind === "memory") return "Memory";
  return h.type ? h.type[0].toUpperCase() + h.type.slice(1) : "Entry";
}

export function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!debounced || debounced.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const like = `%${debounced.replace(/[%_]/g, (m) => "\\" + m)}%`;
        const [eRes, mRes, memRes] = await Promise.all([
          supabase
            .from("entries")
            .select("id, content, type, tags")
            .or(`content.ilike.${like},tags.cs.{${debounced}}`)
            .order("created_at", { ascending: false })
            .limit(15),
          supabase
            .from("meetings")
            .select("id, title, notes, datetime")
            .or(`title.ilike.${like},notes.ilike.${like}`)
            .order("datetime", { ascending: false })
            .limit(15),
          supabase
            .from("memory")
            .select("id, fact, category")
            .ilike("fact", like)
            .order("updated_at", { ascending: false })
            .limit(15),
        ]);
        if (cancelled) return;
        const results: Hit[] = [];
        for (const e of (eRes.data ?? []) as any[]) {
          results.push({
            kind: "entry",
            id: e.id,
            title: e.content?.slice(0, 80) ?? "(no content)",
            subtitle: (e.tags ?? []).join(", "),
            type: e.type ?? "task",
          });
        }
        for (const m of (mRes.data ?? []) as any[]) {
          results.push({
            kind: "meeting",
            id: m.id,
            title: m.title,
            subtitle: m.datetime ? new Date(m.datetime).toLocaleString() : "",
          });
        }
        for (const mem of (memRes.data ?? []) as any[]) {
          results.push({
            kind: "memory",
            id: mem.id,
            title: mem.fact,
            subtitle: mem.category ?? "",
          });
        }
        setHits(results);
      } catch (e) {
        if (!cancelled) setHits([]);
        console.error("global search failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const grouped: Record<string, Hit[]> = { Entries: [], Meetings: [], Memory: [] };
  for (const h of hits) {
    if (h.kind === "entry") grouped.Entries.push(h);
    else if (h.kind === "meeting") grouped.Meetings.push(h);
    else grouped.Memory.push(h);
  }

  return (
    <div ref={ref} className={`relative ${compact ? "w-64" : "w-full max-w-2xl"}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          placeholder="Search entries, meetings, memory…"
          className={`w-full rounded-full border border-border bg-background pl-9 pr-9 ${
            compact ? "h-9 text-sm" : "h-11 text-sm"
          } focus:outline-none focus:ring-2 focus:ring-ring`}
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setHits([]);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          )}
          {!loading && hits.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">No results.</div>
          )}
          {!loading && hits.length > 0 && (
            <div className="py-2">
              {(["Entries", "Meetings", "Memory"] as const).map((group) =>
                grouped[group].length === 0 ? null : (
                  <div key={group} className="px-2 py-1">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </div>
                    {grouped[group].map((h) => (
                      <button
                        key={`${h.kind}-${h.id}`}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          navigate({ to: destFor(h) });
                        }}
                        className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted"
                      >
                        <Badge variant="secondary" className="mt-0.5 shrink-0 text-[10px]">
                          {badgeFor(h)}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{h.title}</div>
                          {h.subtitle && (
                            <div className="truncate text-xs text-muted-foreground">{h.subtitle}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
