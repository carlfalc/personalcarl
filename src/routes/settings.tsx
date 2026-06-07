import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Pencil, Trash2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Personal OS" }] }),
  component: SettingsPage,
});

type Birthday = {
  id: string;
  name: string;
  birth_date: string;
  notes: string | null;
};

function SettingsPage() {
  const { userId } = useAuthSession();
  const qc = useQueryClient();

  // ---- Telegram ----
  const { data: profile } = useQuery({
    queryKey: ["profile-settings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("telegram_chat_id, briefing_enabled, briefing_time, nudge_enabled, nudge_time, weekly_review_enabled, weekly_review_day, weekly_review_time, grocery_send_enabled, grocery_send_day, grocery_send_time")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [chatId, setChatId] = useState("6824076380");
  const [briefingEnabled, setBriefingEnabled] = useState(true);
  const [briefingTime, setBriefingTime] = useState("07:00");
  const [nudgeEnabled, setNudgeEnabled] = useState(true);
  const [nudgeTime, setNudgeTime] = useState("18:00");
  const [reviewEnabled, setReviewEnabled] = useState(true);
  const [reviewDay, setReviewDay] = useState(0);
  const [reviewTime, setReviewTime] = useState("19:00");
  const [grocerySendEnabled, setGrocerySendEnabled] = useState(false);
  const [grocerySendDay, setGrocerySendDay] = useState<number | "every">("every");
  const [grocerySendTime, setGrocerySendTime] = useState("16:00");
  useEffect(() => {
    const p = profile as any;
    if (p?.telegram_chat_id) setChatId(p.telegram_chat_id);
    if (typeof p?.briefing_enabled === "boolean") setBriefingEnabled(p.briefing_enabled);
    if (p?.briefing_time) setBriefingTime(String(p.briefing_time).slice(0, 5));
    if (typeof p?.nudge_enabled === "boolean") setNudgeEnabled(p.nudge_enabled);
    if (p?.nudge_time) setNudgeTime(String(p.nudge_time).slice(0, 5));
    if (typeof p?.weekly_review_enabled === "boolean") setReviewEnabled(p.weekly_review_enabled);
    if (typeof p?.weekly_review_day === "number") setReviewDay(p.weekly_review_day);
    if (p?.weekly_review_time) setReviewTime(String(p.weekly_review_time).slice(0, 5));
    if (typeof p?.grocery_send_enabled === "boolean") setGrocerySendEnabled(p.grocery_send_enabled);
    if (p?.grocery_send_day === null || typeof p?.grocery_send_day === "undefined") {
      // leave default
    } else if (typeof p?.grocery_send_day === "number") setGrocerySendDay(p.grocery_send_day);
    if (p?.grocery_send_time) setGrocerySendTime(String(p.grocery_send_time).slice(0, 5));
  }, [profile]);

  const saveChatId = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ telegram_chat_id: chatId.trim() || null })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-settings"] });
      toast.success("Telegram chat ID saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveBriefing = useMutation({
    mutationFn: async (next: { enabled: boolean; time: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ briefing_enabled: next.enabled, briefing_time: next.time + ":00" })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-settings"] });
      toast.success("Morning briefing saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveNudge = useMutation({
    mutationFn: async (next: { enabled: boolean; time: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ nudge_enabled: next.enabled, nudge_time: next.time + ":00" } as any)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-settings"] });
      toast.success("Evening nudge saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveReview = useMutation({
    mutationFn: async (next: { enabled: boolean; day: number; time: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          weekly_review_enabled: next.enabled,
          weekly_review_day: next.day,
          weekly_review_time: next.time + ":00",
        } as any)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-settings"] });
      toast.success("Weekly review saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveGrocery = useMutation({
    mutationFn: async (next: { enabled: boolean; day: number | "every"; time: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          grocery_send_enabled: next.enabled,
          grocery_send_day: next.day === "every" ? null : next.day,
          grocery_send_time: next.time + ":00",
        } as any)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-settings"] });
      toast.success("Grocery send saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ---- Birthdays ----
  const { data: birthdays = [] } = useQuery({
    queryKey: ["birthdays", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("birthdays")
        .select("*")
        .order("birth_date", { ascending: true });
      if (error) throw error;
      return data as Birthday[];
    },
  });

  const [form, setForm] = useState({ name: "", birth_date: "", notes: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setForm({ name: "", birth_date: "", notes: "" });
    setEditingId(null);
  };

  const saveBirthday = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      if (!form.name.trim() || !form.birth_date) throw new Error("Name and date required");
      if (editingId) {
        const { error } = await supabase
          .from("birthdays")
          .update({
            name: form.name.trim(),
            birth_date: form.birth_date,
            notes: form.notes.trim() || null,
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("birthdays").insert({
          user_id: userId,
          name: form.name.trim(),
          birth_date: form.birth_date,
          notes: form.notes.trim() || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["birthdays"] });
      qc.invalidateQueries({ queryKey: ["birthdays-upcoming"] });
      toast.success(editingId ? "Birthday updated" : "Birthday added");
      resetForm();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteBirthday = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("birthdays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["birthdays"] });
      qc.invalidateQueries({ queryKey: ["birthdays-upcoming"] });
      toast.success("Birthday removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const startEdit = (b: Birthday) => {
    setEditingId(b.id);
    setForm({ name: b.name, birth_date: b.birth_date, notes: b.notes ?? "" });
  };

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card className="rounded-3xl border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">💬</span>
          <h2 className="text-base font-bold">Telegram</h2>
        </div>
        <div className="space-y-3">
          <Label htmlFor="chat-id">Telegram chat ID</Label>
          <div className="flex gap-2">
            <Input
              id="chat-id"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Your Telegram chat ID"
            />
            <Button onClick={() => saveChatId.mutate()} disabled={saveChatId.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Used by the assistant bot to send you replies and confirmations.
          </p>

          <div className="border-t border-border/60 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="briefing-toggle" className="text-sm font-semibold">Morning briefing</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Daily summary of meetings, tasks, birthdays & weather.
                </p>
              </div>
              <input
                id="briefing-toggle"
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={briefingEnabled}
                onChange={(e) => setBriefingEnabled(e.target.checked)}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="briefing-time">Send at</Label>
                <Input
                  id="briefing-time"
                  type="time"
                  value={briefingTime}
                  onChange={(e) => setBriefingTime(e.target.value)}
                  disabled={!briefingEnabled}
                />
              </div>
              <Button
                onClick={() => saveBriefing.mutate({ enabled: briefingEnabled, time: briefingTime })}
                disabled={saveBriefing.isPending}
              >
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>

          <div className="border-t border-border/60 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="nudge-toggle" className="text-sm font-semibold">Evening nudge</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reminds you of tasks still open or overdue today.
                </p>
              </div>
              <input
                id="nudge-toggle"
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={nudgeEnabled}
                onChange={(e) => setNudgeEnabled(e.target.checked)}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="nudge-time">Send at</Label>
                <Input
                  id="nudge-time"
                  type="time"
                  value={nudgeTime}
                  onChange={(e) => setNudgeTime(e.target.value)}
                  disabled={!nudgeEnabled}
                />
              </div>
              <Button
                onClick={() => saveNudge.mutate({ enabled: nudgeEnabled, time: nudgeTime })}
                disabled={saveNudge.isPending}
              >
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>

          <div className="border-t border-border/60 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="review-toggle" className="text-sm font-semibold">Weekly review</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Wins, carried-over tasks, week in brief, and the week ahead.
                </p>
              </div>
              <input
                id="review-toggle"
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={reviewEnabled}
                onChange={(e) => setReviewEnabled(e.target.checked)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
              <div>
                <Label htmlFor="review-day">Day</Label>
                <select
                  id="review-day"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={reviewDay}
                  onChange={(e) => setReviewDay(parseInt(e.target.value, 10))}
                  disabled={!reviewEnabled}
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>
              <div>
                <Label htmlFor="review-time">Send at</Label>
                <Input
                  id="review-time"
                  type="time"
                  value={reviewTime}
                  onChange={(e) => setReviewTime(e.target.value)}
                  disabled={!reviewEnabled}
                />
              </div>
              <Button
                onClick={() => saveReview.mutate({ enabled: reviewEnabled, day: reviewDay, time: reviewTime })}
                disabled={saveReview.isPending}
              >
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>

          <div className="border-t border-border/60 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="grocery-toggle" className="text-sm font-semibold">Grocery list</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sends your current shopping list to Telegram.
                </p>
              </div>
              <input
                id="grocery-toggle"
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={grocerySendEnabled}
                onChange={(e) => setGrocerySendEnabled(e.target.checked)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
              <div>
                <Label htmlFor="grocery-day">Day</Label>
                <select
                  id="grocery-day"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={String(grocerySendDay)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setGrocerySendDay(v === "every" ? "every" : parseInt(v, 10));
                  }}
                  disabled={!grocerySendEnabled}
                >
                  <option value="every">Every day</option>
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>
              <div>
                <Label htmlFor="grocery-time">Send at</Label>
                <Input
                  id="grocery-time"
                  type="time"
                  value={grocerySendTime}
                  onChange={(e) => setGrocerySendTime(e.target.value)}
                  disabled={!grocerySendEnabled}
                />
              </div>
              <Button
                onClick={() => saveGrocery.mutate({ enabled: grocerySendEnabled, day: grocerySendDay, time: grocerySendTime })}
                disabled={saveGrocery.isPending}
              >
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        </div>
      </Card>




      <Card className="rounded-3xl border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">🎂</span>
          <h2 className="text-base font-bold">Birthdays</h2>
        </div>

        <div className="space-y-3 mb-5 rounded-2xl bg-muted/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="bday-name">Name</Label>
              <Input
                id="bday-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Freya"
              />
            </div>
            <div>
              <Label htmlFor="bday-date">Date</Label>
              <Input
                id="bday-date"
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="bday-notes">Notes (optional)</Label>
            <Textarea
              id="bday-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Favourite cake, gift ideas…"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveBirthday.mutate()} disabled={saveBirthday.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              {editingId ? "Update birthday" : "Add birthday"}
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </div>

        {birthdays.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No birthdays saved yet.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {birthdays.map((b) => (
              <div key={b.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{b.name}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {format(new Date(b.birth_date), "d MMM yyyy")}
                    {b.notes && <> · {b.notes}</>}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => startEdit(b)}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                  onClick={() => deleteBirthday.mutate(b.id)}
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
