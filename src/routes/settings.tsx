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
        .select("telegram_chat_id, briefing_enabled, briefing_time")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [chatId, setChatId] = useState("6824076380");
  const [briefingEnabled, setBriefingEnabled] = useState(true);
  const [briefingTime, setBriefingTime] = useState("07:00");
  useEffect(() => {
    if (profile?.telegram_chat_id) setChatId(profile.telegram_chat_id);
    if (typeof profile?.briefing_enabled === "boolean") setBriefingEnabled(profile.briefing_enabled);
    if (profile?.briefing_time) setBriefingTime(String(profile.briefing_time).slice(0, 5));
  }, [profile?.telegram_chat_id, profile?.briefing_enabled, profile?.briefing_time]);

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
