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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
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

// Tasks store the title on the first line and any optional comment in the
// remainder. Keeping it inside `content` means it shows up everywhere the
// task is rendered without a schema change.
function splitTask(content: string) {
  const [title, ...rest] = content.split("\n");
  return { title: title ?? "", notes: rest.join("\n").trim() };
}
function joinTask(title: string, notes: string) {
  const t = title.trim();
  const n = notes.trim();
  return n ? `${t}\n\n${n}` : t;
}

function TasksPage() {
  useRealtimeTable("entries", ["tasks"]);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("2");
  const [filter, setFilter] = useState<"all" | "todo" | "doing" | "done">("all");
  const [sort, setSort] = useState<"priority" | "due" | "created">("created");

  // Completion dialog — mirrors the dashboard so notes feed the diary/AI history.
  const [completing, setCompleting] = useState<Task | null>(null);
  const [completeNote, setCompleteNote] = useState("");

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

  // History of completed tasks (with any closing comments) is logged into the
  // diary on completion. We re-surface it here so the Tasks page becomes the
  // canonical record, and so the AI agent's diary context already includes it.
  useRealtimeTable("entries", ["task-history"]);
  const { data: history = [] } = useQuery({
    queryKey: ["task-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id, content, tags, created_at")
        .eq("type", "diary")
        .contains("tags", ["completed", "task"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as { id: string; content: string; tags: string[]; created_at: string }[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("entries").insert({
        type: "task",
        content: joinTask(title, notes),
        priority: parseInt(priority),
        status: "todo",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setNotes("");
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

  const complete = useMutation({
    mutationFn: async ({ t, note }: { t: Task; note: string }) => {
      const trimmed = note.trim();
      const { error } = await supabase.from("entries")
        .update({ status: "done" }).eq("id", t.id);
      if (error) throw error;
      const content = trimmed
        ? `✅ Completed task: ${t.content}\n📝 Comment: ${trimmed}`
        : `✅ Completed task: ${t.content}`;
      const tags = trimmed
        ? ["completed", "task", "comment"]
        : ["completed", "task"];
      await supabase.from("entries").insert({
        type: "diary",
        content,
        tags,
        priority: 3,
        status: "logged",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setCompleting(null);
      setCompleteNote("");
      toast.success("Task completed and logged to diary");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
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
            if (title.trim()) create.mutate();
          }}
          className="space-y-2"
        >
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="What needs doing?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
            <Button type="submit" disabled={!title.trim()}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
          <Textarea
            placeholder="Comments (optional) — context, people, links…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
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
        {visible.map((t) => {
          const { title: tTitle, notes: tNotes } = splitTask(t.content);
          return (
            <Card key={t.id} className="p-3 shadow-sm transition hover:shadow-md">
              <div className="flex items-center gap-3">
                <PriorityDot p={t.priority} />
                <Input
                  defaultValue={tTitle}
                  onBlur={(e) => {
                    const next = joinTask(e.target.value, tNotes);
                    if (next !== t.content) {
                      update.mutate({ id: t.id, patch: { content: next } });
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
                  onValueChange={(v) => {
                    if (v === "done" && t.status !== "done") {
                      setCompleting(t);
                      setCompleteNote("");
                    } else {
                      update.mutate({ id: t.id, patch: { status: v } });
                    }
                  }}
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
              </div>
              {tNotes && (
                <p className="mt-2 ml-5 whitespace-pre-wrap text-xs text-muted-foreground">
                  {tNotes}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <CompletedHistory items={history} />

      <Dialog
        open={!!completing}
        onOpenChange={(o) => { if (!o) { setCompleting(null); setCompleteNote(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete task</DialogTitle>
            <DialogDescription>
              Add any notes about how this was done, who was involved, or what was decided.
              Comments are saved to your diary so the AI agent uses them as context.
            </DialogDescription>
          </DialogHeader>
          {completing && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {completing.content}
              </div>
              <Textarea
                autoFocus
                placeholder="Optional comment (people, outcomes, follow-ups)…"
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                rows={5}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && completing) {
                    complete.mutate({ t: completing, note: completeNote });
                  }
                }}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setCompleting(null); setCompleteNote(""); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => completing && complete.mutate({ t: completing, note: completeNote })}
              disabled={complete.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {complete.isPending ? "Saving…" : "Mark complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PriorityDot({ p }: { p: number }) {
  const color =
    p === 1 ? "bg-destructive" : p === 2 ? "bg-primary" : "bg-muted-foreground/40";
  return <div className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
}
