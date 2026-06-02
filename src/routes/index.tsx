import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { WeekStrip } from "@/components/WeekStrip";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, CheckSquare, BookOpen, Sparkles, Cloud, CloudRain, Sun } from "lucide-react";
import { addDays, format } from "date-fns";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
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

function TodayPage() {
  useRealtimeTable("entries", ["today-entries"]);
  useRealtimeTable("meetings", ["today-meetings"]);

  const { data: entries = [] } = useQuery({
    queryKey: ["today-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["today-meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .order("datetime", { ascending: true })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const todaysTasks = entries
    .filter((e) => e.type === "task" && (e.due_date === today || e.status !== "done"))
    .slice(0, 6);
  const recentDiary = entries.filter((e) => e.type === "diary").slice(0, 3);

  const tiles: Record<string, React.ReactNode> = {
    tasks: (
      <Panel title="Today's Tasks" emoji="✅" href="/tasks">
        {todaysTasks.length === 0 ? (
          <Empty>No tasks. Enjoy the quiet.</Empty>
        ) : (
          <div className="divide-y divide-border/60">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Task</span><span>Priority</span><span>Status</span>
            </div>
            {todaysTasks.map((t) => (
              <div key={t.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 text-sm">
                <span className={t.status === "done" ? "line-through text-muted-foreground" : ""}>
                  {t.content}
                </span>
                <Badge variant="outline" className="text-[10px]">P{t.priority ?? 3}</Badge>
                <Badge variant="secondary" className="text-[10px]">{t.status ?? "open"}</Badge>
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
      <Panel title="Upcoming Meetings" emoji="📅" href="/meetings">
        {meetings.length === 0 ? (
          <Empty>Nothing on the calendar.</Empty>
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => (
              <div key={m.id} className="flex items-baseline justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">{m.title}</div>
                  {m.location && (
                    <div className="text-xs text-muted-foreground">{m.location}</div>
                  )}
                </div>
                <div className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                  {format(new Date(m.datetime), "EEE d MMM · HH:mm")}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    ),
    diary: (
      <Panel title="Recent Diary" emoji="📓" href="/diary">
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
  };

  const DEFAULT_ORDER = ["tasks", "weather", "meetings", "diary"];
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dashboard-tile-order");
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed) && parsed.every((k) => k in tiles)) {
          // include any new tiles not in saved order at the end
          const merged = [...parsed, ...DEFAULT_ORDER.filter((k) => !parsed.includes(k))];
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
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
  title,
  emoji,
  href,
  children,
}: {
  title: string;
  emoji: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <h3 className="text-base font-bold">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {href && (
            <Link to={href} className="text-xs font-medium text-orange-accent hover:underline">
              View all
            </Link>
          )}
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
        </div>
      </div>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-muted-foreground">{children}</p>;
}
