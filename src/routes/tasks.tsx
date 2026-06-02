import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Personal OS" }] }),
  component: TasksPage,
});

type Task = {
  id: string;
  content: string;
  status: string;
  priority: number;
  due_date: string | null;
  created_at: string;
};

function TasksPage() {
  useRealtimeTable("entries", ["tasks"]);
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("2");
  const [filter, setFilter] = useState<"all" | "todo" | "doing" | "done">("all");
  const [sort, setSort] = useState<"priority" | "due" | "created">("created");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("type", "task")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("entries").insert({
        type: "task",
        content: content.trim(),
        priority: parseInt(priority),
        status: "todo",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const { error } = await supabase.from("entries").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  let visible = tasks;
  if (filter !== "all") visible = visible.filter((t) => t.status === filter);
  visible = [...visible].sort((a, b) => {
    if (sort === "priority") return a.priority - b.priority;
    if (sort === "due") {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    }
    return b.created_at.localeCompare(a.created_at);
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Tasks" subtitle="Things to get done." />

      <Card className="mb-6 p-4 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (content.trim()) create.mutate();
          }}
          className="flex flex-wrap gap-2"
        >
          <Input
            placeholder="What needs doing?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">High</SelectItem>
              <SelectItem value="2">Medium</SelectItem>
              <SelectItem value="3">Low</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={!content.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </form>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="todo">To do</SelectItem>
            <SelectItem value="doing">Doing</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created">Newest first</SelectItem>
            <SelectItem value="priority">By priority</SelectItem>
            <SelectItem value="due">By due date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nothing here. Add a task above.
          </p>
        )}
        {visible.map((t) => (
          <Card key={t.id} className="flex items-center gap-3 p-3 shadow-sm transition hover:shadow-md">
            <PriorityDot p={t.priority} />
            <Input
              defaultValue={t.content}
              onBlur={(e) => {
                if (e.target.value !== t.content) {
                  update.mutate({ id: t.id, patch: { content: e.target.value } });
                }
              }}
              className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
            />
            {t.due_date && (
              <Badge variant="outline" className="text-[10px]">
                {format(new Date(t.due_date), "d MMM")}
              </Badge>
            )}
            <Select
              value={t.status}
              onValueChange={(v) => update.mutate({ id: t.id, patch: { status: v } })}
            >
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To do</SelectItem>
                <SelectItem value="doing">Doing</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => del.mutate(t.id)}>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PriorityDot({ p }: { p: number }) {
  const color =
    p === 1 ? "bg-destructive" : p === 2 ? "bg-primary" : "bg-muted-foreground/40";
  return <div className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
}
