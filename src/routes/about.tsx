import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Heart, Briefcase, Settings2, Pencil, Check, X } from "lucide-react";
import { useUserName } from "@/hooks/useUserName";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About Me — Personal OS" }] }),
  component: AboutPage,
});

type Memory = {
  id: string;
  fact: string;
  category: "interest" | "project" | "preference";
  confidence: number;
  source: string | null;
};

const CATEGORIES = [
  { key: "interest", label: "Interests", icon: Heart },
  { key: "project", label: "Projects", icon: Briefcase },
  { key: "preference", label: "Preferences", icon: Settings2 },
] as const;

function AboutPage() {
  useRealtimeTable("memory", ["memory"]);
  const qc = useQueryClient();
  const [fact, setFact] = useState("");
  const [category, setCategory] = useState<Memory["category"]>("interest");
  const [userName, setUserName] = useUserName();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(userName);

  const saveName = () => {
    setUserName(nameDraft);
    setEditingName(false);
  };


  const { data: memories = [] } = useQuery({
    queryKey: ["memory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memory").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Memory[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("memory").insert({
        fact: fact.trim(), category, source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => { setFact(""); qc.invalidateQueries({ queryKey: ["memory"] }); },
  });

  const update = useMutation({
    mutationFn: async ({ id, fact }: { id: string; fact: string }) => {
      const { error } = await supabase.from("memory")
        .update({ fact, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("memory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">About Me</h1>
            {editingName ? (
              <div className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") { setNameDraft(userName); setEditingName(false); }
                  }}
                  className="h-9 w-40 text-2xl font-semibold"
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveName}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon" variant="ghost" className="h-8 w-8"
                  onClick={() => { setNameDraft(userName); setEditingName(false); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-3xl font-semibold tracking-tight text-primary">· {userName}</span>
                <Button
                  size="icon" variant="ghost" className="h-8 w-8"
                  onClick={() => { setNameDraft(userName); setEditingName(true); }}
                  aria-label="Edit name"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            What the assistant knows about you. Edit to shape its memory.
          </p>
        </div>
      </div>


      <Card className="mb-8 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Add a fact about yourself…"
            value={fact}
            onChange={(e) => setFact(e.target.value)}
            className="flex-1 min-w-[220px]"
          />
          <Select value={category} onValueChange={(v) => setCategory(v as Memory["category"])}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="interest">Interest</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="preference">Preference</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => fact.trim() && create.mutate()} disabled={!fact.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {CATEGORIES.map(({ key, label, icon: Icon }) => {
          const items = memories.filter((m) => m.category === key);
          return (
            <section key={key}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-primary" />
                {label}
                <span className="text-xs text-muted-foreground">· {items.length}</span>
              </h2>
              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing yet.</p>
                )}
                {items.map((m) => (
                  <Card key={m.id} className="group p-3 shadow-sm transition hover:shadow-md">
                    <div className="flex items-start gap-2">
                      <Input
                        defaultValue={m.fact}
                        onBlur={(e) => {
                          if (e.target.value !== m.fact) {
                            update.mutate({ id: m.id, fact: e.target.value });
                          }
                        }}
                        className="flex-1 border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
                      />
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 opacity-0 transition group-hover:opacity-100"
                        onClick={() => del.mutate(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                    {m.source && (
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {m.source} · {Math.round(Number(m.confidence) * 100)}%
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
