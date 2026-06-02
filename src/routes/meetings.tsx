import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/meetings")({
  head: () => ({ meta: [{ title: "Meetings — Personal OS" }] }),
  component: MeetingsPage,
});

type Meeting = {
  id: string;
  title: string;
  datetime: string;
  location: string | null;
  notes: string | null;
};

function MeetingsPage() {
  useRealtimeTable("meetings", ["meetings"]);
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", datetime: "", location: "", notes: "" });

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings").select("*").order("datetime", { ascending: true });
      if (error) throw error;
      return data as Meeting[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meetings").insert({
        title: form.title.trim(),
        datetime: new Date(form.datetime).toISOString(),
        location: form.location || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ title: "", datetime: "", location: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });

  const now = Date.now();
  const upcoming = meetings.filter((m) => new Date(m.datetime).getTime() >= now);
  const past = meetings.filter((m) => new Date(m.datetime).getTime() < now);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Meetings" subtitle="Where you need to be." />

      <Card className="mb-8 space-y-3 p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="1:1 with…"
            />
          </Field>
          <Field label="When">
            <Input
              type="datetime-local"
              value={form.datetime}
              onChange={(e) => setForm({ ...form, datetime: e.target.value })}
            />
          </Field>
          <Field label="Location">
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Zoom, office…"
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={!form.title.trim() || !form.datetime}
            onClick={() => create.mutate()}
          >
            <Plus className="mr-1 h-4 w-4" /> Add meeting
          </Button>
        </div>
      </Card>

      <Section title="Upcoming" items={upcoming} onDel={(id) => del.mutate(id)} />
      {past.length > 0 && (
        <div className="mt-8">
          <Section title="Past" items={past} onDel={(id) => del.mutate(id)} faded />
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Section({
  title, items, onDel, faded,
}: { title: string; items: Meeting[]; onDel: (id: string) => void; faded?: boolean }) {
  if (items.length === 0) {
    return (
      <>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
        <p className="py-6 text-sm text-muted-foreground">Nothing here.</p>
      </>
    );
  }
  return (
    <>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className={`space-y-3 ${faded ? "opacity-70" : ""}`}>
        {items.map((m) => (
          <Card key={m.id} className="group p-4 shadow-sm transition hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium">{m.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(m.datetime), "EEE d MMM, HH:mm")}
                  </span>
                  {m.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {m.location}
                    </span>
                  )}
                </div>
                {m.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{m.notes}</p>
                )}
              </div>
              <Button
                variant="ghost" size="icon"
                className="opacity-0 transition group-hover:opacity-100"
                onClick={() => onDel(m.id)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
