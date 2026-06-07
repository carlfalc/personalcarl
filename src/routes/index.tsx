import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { WeekStrip } from "@/components/WeekStrip";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cancelCalendarEvent, rescheduleCalendarEvent } from "@/lib/meetings.functions";
import { BirthdayBanner } from "@/components/BirthdayBanner";
import { GlobalSearch } from "@/components/GlobalSearch";
import {
  GripVertical, Cloud, CloudRain, Sun, Check, X, CalendarClock, Lightbulb,
  Plus, MessageSquarePlus, Mail, ShoppingCart, Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { addDays, format } from "date-fns";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Personal OS" },
      { name: "description", content: "Your day at a glance." },
    ],
  }),
  component: TodayPage,
});

type Entry = {
  id: string;
  type: string;
  content: string;
  status: string | null;
  priority: number | null;
  due_date: string | null;
  created_at: string;
};

type Meeting = {
  id: string;
  title: string;
  datetime: string;
  location: string | null;
  status: string | null;
  google_event_id: string | null;
};

function TodayPage() {
  useRealtimeTable("entries", ["today-entries"]);
  useRealtimeTable("meetings", ["today-meetings"]);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const cancelEvent = useServerFn(cancelCalendarEvent);
  const rescheduleEvent = useServerFn(rescheduleCalendarEvent);

  const { data: entries = [] } = useQuery({
    queryKey: ["today-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Entry[];
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["today-meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings").select("*").order("datetime", { ascending: true }).limit(12);
      if (error) throw error;
      return data as Meeting[];
    },
  });

  // ---- Task actions ----
  const completeTask = useMutation({
    mutationFn: async (t: Entry) => {
      const { error } = await supabase.from("entries")
        .update({ status: "done" }).eq("id", t.id);
      if (error) throw error;
      // Log to diary so completed work shows up in monthly review.
      await supabase.from("entries").insert({
        type: "diary",
        content: `✅ Completed task: ${t.content}`,
        tags: ["completed", "task"],
        priority: 3,
        status: "logged",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-entries"] });
      toast.success("Task completed and logged to diary");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteTask = useMutation({
    mutationFn: async (t: Entry) => {
      const { error } = await supabase.from("entries")
        .update({ status: "deleted" }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-entries"] });
      toast.success("Task removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updatePriority = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: number }) => {
      const { error } = await supabase.from("entries")
        .update({ priority }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-entries"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ---- Meeting actions ----
  const cancelMeeting = useMutation({
    mutationFn: async (m: Meeting) => {
      if (m.google_event_id) {
        try {
          await cancelEvent({ data: { eventId: m.google_event_id } });
        } catch (e) {
          console.warn("Google Calendar cancel failed", e);
        }
      }
      const { error } = await supabase.from("meetings")
        .update({ status: "cancelled" }).eq("id", m.id);
      if (error) throw error;
      await supabase.from("entries").insert({
        type: "diary",
        content: `❌ Cancelled meeting: ${m.title} (${format(new Date(m.datetime), "d MMM HH:mm")})`,
        tags: ["cancelled", "meeting"],
        priority: 3,
        status: "logged",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-meetings"] });
      toast.success("Meeting cancelled");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rescheduleMeeting = useMutation({
    mutationFn: async ({ m, newIso }: { m: Meeting; newIso: string }) => {
      const start = new Date(newIso);
      if (isNaN(start.getTime())) throw new Error("Invalid date");
      const oldStart = new Date(m.datetime);
      const oldEnd = new Date(oldStart.getTime() + 60 * 60 * 1000);
      const durationMs = oldEnd.getTime() - oldStart.getTime();
      const end = new Date(start.getTime() + durationMs);

      if (m.google_event_id) {
        try {
          await rescheduleEvent({
            data: {
              eventId: m.google_event_id,
              startIso: start.toISOString(),
              endIso: end.toISOString(),
            },
          });
        } catch (e) {
          console.warn("Google Calendar reschedule failed", e);
        }
      }
      const { error } = await supabase.from("meetings")
        .update({ datetime: start.toISOString(), status: "rescheduled" })
        .eq("id", m.id);
      if (error) throw error;
      await supabase.from("entries").insert({
        type: "diary",
        content: `🔄 Rescheduled meeting: ${m.title} → ${format(start, "d MMM HH:mm")}`,
        tags: ["rescheduled", "meeting"],
        priority: 3,
        status: "logged",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-meetings"] });
      toast.success("Meeting rescheduled");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const handleReschedule = (m: Meeting) => {
    const current = format(new Date(m.datetime), "yyyy-MM-dd'T'HH:mm");
    const input = window.prompt("New date & time (YYYY-MM-DDTHH:MM):", current);
    if (!input) return;
    rescheduleMeeting.mutate({ m, newIso: input });
  };

  const handleAddComment = async (m: Meeting) => {
    const comment = window.prompt(`Add a comment for "${m.title}":`);
    if (!comment?.trim()) return;
    const { error } = await supabase.from("entries").insert({
      type: "diary",
      content: `💬 ${m.title} (${format(new Date(m.datetime), "d MMM HH:mm")}): ${comment.trim()}`,
      tags: ["meeting", "comment"],
      priority: 3,
      status: "logged",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Comment saved to diary");
    qc.invalidateQueries({ queryKey: ["today-entries"] });
  };

  const handleCreateEmail = (m: Meeting) => {
    const haystack = [m.title, m.location ?? "", (m as Meeting & { notes?: string | null }).notes ?? ""].join(" ");
    const emails = Array.from(
      new Set(haystack.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []),
    );
    try {
      sessionStorage.setItem("email-prefill", JSON.stringify({
        to: emails.join(", "),
        subject: `Re: ${m.title}`,
        body: `Hi,\n\nFollowing up on "${m.title}" (${format(new Date(m.datetime), "EEE d MMM, HH:mm")}).\n\n`,
      }));
    } catch {}
    navigate({ to: "/email" });
  };

  // ---- Derived lists ----
  const today = new Date().toISOString().slice(0, 10);
  const todaysTasks = entries
    .filter((e) =>
      e.type === "task" &&
      e.status !== "done" &&
      e.status !== "deleted" &&
      (!e.due_date || e.due_date <= today),
    )
    .slice(0, 6);
  const recentDiary = entries.filter((e) => e.type === "diary").slice(0, 3);
  const recentIdeas = entries.filter((e) => e.type === "idea").slice(0, 4);

  const upcomingMeetings = meetings
    .filter((m) => m.status !== "cancelled" && new Date(m.datetime).getTime() >= Date.now() - 60 * 60 * 1000)
    .slice(0, 5);

  const tiles: Record<string, React.ReactNode> = {
    tasks: (
      <Panel title="Today's Tasks" emoji="✅" href="/tasks" addHref="/tasks">
        {todaysTasks.length === 0 ? (
          <Empty>No tasks. Enjoy the quiet.</Empty>
        ) : (
          <div className="divide-y divide-border/60">
            {todaysTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-3 text-sm">
                <span className="flex-1 truncate">{t.content}</span>
                <div onPointerDown={(e) => e.stopPropagation()}>
                  <Select
                    value={String(t.priority ?? 3)}
                    onValueChange={(v) => updatePriority.mutate({ id: t.id, priority: parseInt(v) })}
                  >
                    <SelectTrigger className="h-6 w-[58px] px-2 py-0 text-[10px] font-semibold">
                      <SelectValue>P{t.priority ?? 3}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">P1 — Highest</SelectItem>
                      <SelectItem value="2">P2 — High</SelectItem>
                      <SelectItem value="3">P3 — Medium</SelectItem>
                      <SelectItem value="4">P4 — Low</SelectItem>
                      <SelectItem value="5">P5 — Lowest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                  <Button
                    size="icon" variant="ghost"
                    className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                    title="Mark completed"
                    onClick={() => completeTask.mutate(t)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    title="Delete (not required)"
                    onClick={() => deleteTask.mutate(t)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    ),
    weather: (
      <Panel title="Weather — Today" emoji="🌤️">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = addDays(new Date(), i);
            const w = WEATHER[i % WEATHER.length];
            const Icon = w.icon;
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br from-[oklch(0.96_0.04_70)] to-[oklch(0.93_0.06_60)] p-3 text-center shadow-sm"
              >
                <span className="text-xs font-bold text-foreground/80">{format(d, "EEE")}</span>
                <Icon className="h-6 w-6 text-orange-accent" />
                <span className="text-lg font-bold tabular-nums">{w.hi}°</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">{w.lo}°</span>
              </div>
            );
          })}
        </div>
      </Panel>
    ),
    meetings: (
      <Panel title="Upcoming Meetings" emoji="📅" href="/meetings" addHref="/meetings">
        {upcomingMeetings.length === 0 ? (
          <Empty>Nothing on the calendar.</Empty>
        ) : (
          <div className="space-y-3">
            {upcomingMeetings.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{m.title}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {format(new Date(m.datetime), "EEE d MMM · HH:mm")}
                    {m.location && <> · {m.location}</>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                  <Button
                    size="icon" variant="ghost"
                    className="h-7 w-7 text-blue-600"
                    title="Add meeting comment (saves to diary)"
                    onClick={() => handleAddComment(m)}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-7 w-7 text-rose-500"
                    title="Create email"
                    onClick={() => handleCreateEmail(m)}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-7 w-7 text-orange-accent"
                    title="Reschedule"
                    onClick={() => handleReschedule(m)}
                  >
                    <CalendarClock className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-red-600"
                    title="Cancel"
                    onClick={() => cancelMeeting.mutate(m)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    ),
    diary: (
      <Panel title="Recent Diary" emoji="📓" href="/diary" addHref="/diary">
        {recentDiary.length === 0 ? (
          <Empty>No entries yet.</Empty>
        ) : (
          <div className="space-y-3">
            {recentDiary.map((d) => (
              <div key={d.id}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-orange-accent">
                  {format(new Date(d.created_at), "d MMM")}
                </div>
                <div className="line-clamp-2 text-sm">{d.content}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    ),
    ideas: (
      <Panel title="Recent Ideas" emoji="💡" href="/ideas" addHref="/ideas">
        {recentIdeas.length === 0 ? (
          <Empty>No ideas captured yet.</Empty>
        ) : (
          <div className="space-y-3">
            {recentIdeas.map((i) => (
              <div key={i.id} className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-orange-accent" />
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm">{i.content}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(i.created_at), "d MMM")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    ),
    grocery: <GroceryPanel />,
  };

  const DEFAULT_ORDER = ["tasks", "weather", "meetings", "grocery", "ideas", "diary"];
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dashboard-tile-order");
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((k) => k in tiles);
          const merged = [...filtered, ...DEFAULT_ORDER.filter((k) => !filtered.includes(k))];
          setOrder(merged);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const next = arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)));
      try { localStorage.setItem("dashboard-tile-order", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 space-y-5">
      <GlobalSearch />
      <BirthdayBanner />
      <WeekStrip />


      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid gap-5 lg:grid-cols-2">
            {order.map((key) => (
              <SortableTile key={key} id={key}>
                {tiles[key]}
              </SortableTile>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableTile({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <button
        type="button"
        aria-label="Drag to reorder"
        className="absolute right-3 top-3 z-10 flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

const WEATHER = [
  { icon: CloudRain, hi: 19, lo: 14 },
  { icon: Cloud,     hi: 16, lo: 12 },
  { icon: Sun,       hi: 18, lo: 10 },
  { icon: CloudRain, hi: 16, lo: 14 },
  { icon: Cloud,     hi: 17, lo: 12 },
  { icon: CloudRain, hi: 14, lo: 10 },
  { icon: Sun,       hi: 15, lo: 7  },
];

function Panel({
  title, emoji, href, addHref, children,
}: {
  title: string; emoji: string; href?: string; addHref?: string; children: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <h3 className="text-base font-bold">{title}</h3>
        </div>
        <div className="flex items-center gap-2 pr-10">
          {addHref && (
            <Link
              to={addHref}
              className="inline-flex items-center gap-1 rounded-full bg-orange-accent/10 px-2.5 py-1 text-xs font-semibold text-orange-accent hover:bg-orange-accent/20"
              title="Add new"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Link>
          )}
          {href && (
            <Link to={href} className="text-xs font-medium text-orange-accent hover:underline">
              View all
            </Link>
          )}
        </div>
      </div>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-muted-foreground">{children}</p>;
}

type GroceryItem = {
  id: string;
  item: string;
  quantity: string | null;
  checked: boolean;
  created_at: string;
};

function GroceryPanel() {
  useRealtimeTable("grocery_items", ["grocery-items"]);
  const qc = useQueryClient();
  const [newItem, setNewItem] = useState("");
  const [recentlyChecked, setRecentlyChecked] = useState<Record<string, number>>({});

  const { data: items = [] } = useQuery({
    queryKey: ["grocery-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grocery_items")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as GroceryItem[];
    },
  });

  const addItem = useMutation({
    mutationFn: async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      // Split quantity prefix like "2L milk" or "2 milk"
      const m = trimmed.match(/^([\d.,]+\s?[a-zA-Z]*)\s+(.+)$/);
      const quantity = m ? m[1].trim() : null;
      const item = m ? m[2].trim() : trimmed;
      const { error } = await supabase.from("grocery_items").insert({ item, quantity });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewItem("");
      qc.invalidateQueries({ queryKey: ["grocery-items"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggleItem = useMutation({
    mutationFn: async (it: GroceryItem) => {
      const { error } = await supabase
        .from("grocery_items")
        .update({ checked: !it.checked })
        .eq("id", it.id);
      if (error) throw error;
    },
    onMutate: (it) => {
      if (!it.checked) {
        setRecentlyChecked((p) => ({ ...p, [it.id]: Date.now() }));
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grocery-items"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const clearChecked = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("grocery_items").delete().eq("checked", true);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grocery-items"] });
      toast.success("Cleared checked items");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Hide checked items after ~2s
  useEffect(() => {
    if (Object.keys(recentlyChecked).length === 0) return;
    const t = setInterval(() => {
      setRecentlyChecked((prev) => {
        const cutoff = Date.now() - 2000;
        const next: Record<string, number> = {};
        for (const [id, ts] of Object.entries(prev)) if (ts > cutoff) next[id] = ts;
        return next;
      });
    }, 500);
    return () => clearInterval(t);
  }, [recentlyChecked]);

  const visible = items.filter((i) => !i.checked || recentlyChecked[i.id]);
  const hasChecked = items.some((i) => i.checked);

  return (
    <Card className="rounded-3xl border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between pr-10">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-orange-accent" />
          <h3 className="text-base font-bold">Grocery</h3>
        </div>
        {hasChecked && (
          <button
            type="button"
            onClick={() => clearChecked.mutate()}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear checked
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); addItem.mutate(newItem); }}
        className="mb-3 flex gap-2"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add item (e.g. 2L milk)"
          className="h-9"
        />
        <Button type="submit" size="sm" disabled={!newItem.trim() || addItem.isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {visible.length === 0 ? (
        <Empty>List is empty.</Empty>
      ) : (
        <ul className="divide-y divide-border/60">
          {visible.map((i) => (
            <li
              key={i.id}
              className="flex items-center gap-3 py-2 text-sm"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={i.checked}
                onChange={() => toggleItem.mutate(i)}
                className="h-4 w-4 accent-primary"
              />
              <span className={`flex-1 ${i.checked ? "line-through text-muted-foreground" : ""}`}>
                {i.item}
                {i.quantity && (
                  <span className="ml-2 text-xs text-muted-foreground">({i.quantity})</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
