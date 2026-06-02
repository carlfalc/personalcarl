import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2, Plus, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/schedules")({
  head: () => ({ meta: [{ title: "Schedules — Personal OS" }] }),
  component: SchedulesPage,
});

type Frequency = "once" | "hourly" | "daily" | "weekly";
type Schedule = {
  id: string;
  title: string;
  prompt: string;
  frequency: Frequency;
  time_of_day: string | null;
  day_of_week: number | null;
  enabled: boolean;
  last_run: string | null;
  created_at: string;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function describeNext(s: Schedule): string {
  if (!s.enabled) return "Disabled";
  if (s.frequency === "hourly") return "Top of every hour";
  if (s.frequency === "daily") return `Daily at ${s.time_of_day?.slice(0, 5) ?? "—"}`;
  if (s.frequency === "weekly")
    return `${s.day_of_week !== null ? DAYS[s.day_of_week] : "—"} at ${s.time_of_day?.slice(0, 5) ?? "—"}`;
  if (s.frequency === "once") return `Once at ${s.time_of_day?.slice(0, 5) ?? "—"}`;
  return "—";
}

function SchedulesPage() {
  const { userId } = useAuthSession();
  const qc = useQueryClient();

  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Schedule[];
    },
  });

  const [form, setForm] = useState({
    title: "",
    prompt: "",
    frequency: "daily" as Frequency,
    time_of_day: "08:00",
    day_of_week: "1",
    enabled: true,
  });

  const resetForm = () =>
    setForm({ title: "", prompt: "", frequency: "daily", time_of_day: "08:00", day_of_week: "1", enabled: true });

  const create = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      if (!form.title.trim() || !form.prompt.trim()) throw new Error("Title and prompt required");
      const payload: Record<string, unknown> = {
        user_id: userId,
        title: form.title.trim(),
        prompt: form.prompt.trim(),
        frequency: form.frequency,
        enabled: form.enabled,
        time_of_day: form.frequency === "hourly" ? null : form.time_of_day + ":00",
        day_of_week: form.frequency === "weekly" ? parseInt(form.day_of_week, 10) : null,
      };
      const { error } = await supabase.from("schedules").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule added");
      resetForm();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggle = useMutation({
    mutationFn: async (s: Schedule) => {
      const { error } = await supabase
        .from("schedules").update({ enabled: !s.enabled }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6 text-orange-accent" />
        <h1 className="text-2xl font-bold">Schedules</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Recurring AI-powered briefings sent to your Telegram. Times are evaluated in Pacific/Auckland.
      </p>

      <Card className="rounded-3xl border-border/60 bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold">Add schedule</h2>
        <div className="space-y-3">
          <div>
            <Label htmlFor="s-title">Title</Label>
            <Input
              id="s-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Morning NZ news"
            />
          </div>
          <div>
            <Label htmlFor="s-prompt">Prompt</Label>
            <Textarea
              id="s-prompt"
              rows={3}
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              placeholder="Give me today's breaking news in New Zealand"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm({ ...form, frequency: v as Frequency })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Once</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.frequency !== "hourly" && (
              <div>
                <Label htmlFor="s-time">Time of day</Label>
                <Input
                  id="s-time"
                  type="time"
                  value={form.time_of_day}
                  onChange={(e) => setForm({ ...form, time_of_day: e.target.value })}
                />
              </div>
            )}
            {form.frequency === "weekly" && (
              <div>
                <Label>Day of week</Label>
                <Select
                  value={form.day_of_week}
                  onValueChange={(v) => setForm({ ...form, day_of_week: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
            <Label>Enabled</Label>
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Add schedule
          </Button>
        </div>
      </Card>

      <Card className="rounded-3xl border-border/60 bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold">Your schedules</h2>
        {schedules.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No schedules yet.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{s.title}</span>
                    <span className="text-[10px] uppercase tracking-wide text-orange-accent">
                      {s.frequency}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{s.prompt}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {describeNext(s)}
                    {s.last_run && <> · last run {format(new Date(s.last_run), "d MMM HH:mm")}</>}
                  </div>
                </div>
                <Switch
                  checked={s.enabled}
                  onCheckedChange={() => toggle.mutate(s)}
                />
                <Button
                  size="icon" variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                  onClick={() => remove.mutate(s.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
