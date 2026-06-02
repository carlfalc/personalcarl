import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

export const Route = createFileRoute("/diary")({
  head: () => ({ meta: [{ title: "Diary — Personal OS" }] }),
  component: DiaryPage,
});

type Entry = { id: string; content: string; created_at: string };

function DiaryPage() {
  useRealtimeTable("entries", ["diary"]);
  const qc = useQueryClient();
  const [content, setContent] = useState("");

  const { data: entries = [] } = useQuery({
    queryKey: ["diary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries").select("*").eq("type", "diary")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Entry[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("entries").insert({
        type: "diary", content: content.trim(), status: "todo",
      });
      if (error) throw error;
    },
    onSuccess: () => { setContent(""); qc.invalidateQueries({ queryKey: ["diary"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diary"] }),
  });

  // group by date string
  const grouped: Record<string, Entry[]> = {};
  for (const e of entries) {
    const key = e.created_at.slice(0, 10);
    (grouped[key] ??= []).push(e);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Diary" subtitle="Write it down. You'll forget otherwise." />

      <Card className="mb-8 space-y-2 p-4 shadow-sm">
        <Textarea
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end">
          <Button onClick={() => content.trim() && create.mutate()} disabled={!content.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Add entry
          </Button>
        </div>
      </Card>

      {Object.keys(grouped).length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No entries yet.
        </p>
      )}

      <div className="space-y-8">
        {Object.entries(grouped).map(([date, items]) => (
          <section key={date}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {labelForDate(date)}
            </h2>
            <div className="space-y-3">
              {items.map((e) => (
                <Card key={e.id} className="group p-4 shadow-sm transition hover:shadow-md">
                  <div className="mb-1 text-xs text-muted-foreground">
                    {format(new Date(e.created_at), "HH:mm")}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{e.content}</p>
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost" size="icon"
                      className="opacity-0 transition group-hover:opacity-100"
                      onClick={() => del.mutate(e.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function labelForDate(d: string) {
  const date = new Date(d);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, d MMMM yyyy");
}
