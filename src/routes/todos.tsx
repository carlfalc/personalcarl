import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/todos")({
  head: () => ({ meta: [{ title: "To-Dos — Personal OS" }] }),
  component: TodosPage,
});

type Todo = { id: string; content: string; status: string };

function TodosPage() {
  useRealtimeTable("entries", ["todos"]);
  const qc = useQueryClient();
  const [content, setContent] = useState("");

  const { data: todos = [] } = useQuery({
    queryKey: ["todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries").select("*").eq("type", "todo")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Todo[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("entries").insert({
        type: "todo", content: content.trim(), status: "todo",
      });
      if (error) throw error;
    },
    onSuccess: () => { setContent(""); qc.invalidateQueries({ queryKey: ["todos"] }); },
  });

  const toggle = useMutation({
    mutationFn: async (t: Todo) => {
      const { error } = await supabase.from("entries")
        .update({ status: t.status === "done" ? "todo" : "done" })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });

  const open = todos.filter((t) => t.status !== "done");
  const done = todos.filter((t) => t.status === "done");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="To-Dos" subtitle="Small things, tick them off." />

      <Card className="mb-6 p-3 shadow-sm">
        <form
          onSubmit={(e) => { e.preventDefault(); if (content.trim()) create.mutate(); }}
          className="flex gap-2"
        >
          <Input
            placeholder="Add a to-do…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!content.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </Card>

      <div className="space-y-1">
        {open.map((t) => (
          <Row key={t.id} t={t} onToggle={() => toggle.mutate(t)} onDel={() => del.mutate(t.id)} />
        ))}
        {open.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">All clear.</p>
        )}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Done · {done.length}
          </h2>
          <div className="space-y-1">
            {done.map((t) => (
              <Row key={t.id} t={t} onToggle={() => toggle.mutate(t)} onDel={() => del.mutate(t.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ t, onToggle, onDel }: { t: Todo; onToggle: () => void; onDel: () => void }) {
  const done = t.status === "done";
  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-muted/60">
      <Checkbox checked={done} onCheckedChange={onToggle} />
      <span className={`flex-1 text-sm ${done ? "text-muted-foreground line-through" : ""}`}>
        {t.content}
      </span>
      <Button
        variant="ghost" size="icon"
        className="opacity-0 transition group-hover:opacity-100"
        onClick={onDel}
      >
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
