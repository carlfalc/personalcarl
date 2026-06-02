import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Calendar, BookOpen, Flame } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Personal OS" },
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
        .gte("datetime", new Date().toISOString())
        .order("datetime", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const todaysTasks = entries.filter(
    (e) => e.type === "task" && (e.due_date === today || e.status !== "done"),
  );
  const recentDiary = entries.filter((e) => e.type === "diary").slice(0, 3);
  const priorityTasks = todaysTasks
    .filter((t) => t.priority === 1 && t.status !== "done")
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={greeting()}
        subtitle={format(new Date(), "EEEE, d MMMM")}
      />

      {priorityTasks.length > 0 && (
        <Card className="mb-6 border-primary/20 bg-primary/5 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Flame className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Priority today</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {priorityTasks.map((t) => (
                <li key={t.id} className="text-sm">
                  {t.content}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DashCard
          title="Today's tasks"
          icon={<CheckSquare className="h-4 w-4" />}
          href="/tasks"
          empty="No tasks. Enjoy the quiet."
        >
          {todaysTasks.slice(0, 5).map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className={t.status === "done" ? "line-through text-muted-foreground" : ""}>
                {t.content}
              </span>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {t.status}
              </Badge>
            </div>
          ))}
        </DashCard>

        <DashCard
          title="Upcoming meetings"
          icon={<Calendar className="h-4 w-4" />}
          href="/meetings"
          empty="Nothing on the calendar."
        >
          {meetings.map((m) => (
            <div key={m.id} className="py-1.5 text-sm">
              <div className="font-medium">{m.title}</div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(m.datetime), "EEE d MMM, HH:mm")}
                {m.location ? ` · ${m.location}` : ""}
              </div>
            </div>
          ))}
        </DashCard>

        <DashCard
          title="Recent diary"
          icon={<BookOpen className="h-4 w-4" />}
          href="/diary"
          empty="No entries yet."
        >
          {recentDiary.map((d) => (
            <div key={d.id} className="py-1.5">
              <div className="text-xs text-muted-foreground">
                {format(new Date(d.created_at), "d MMM")}
              </div>
              <div className="line-clamp-2 text-sm">{d.content}</div>
            </div>
          ))}
        </DashCard>
      </div>
    </div>
  );
}

function DashCard({
  title,
  icon,
  href,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <Card className="shadow-sm transition hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        <Link to={href} className="text-xs text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="divide-y divide-border/60">
        {hasChildren ? children : <p className="py-3 text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up?";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
