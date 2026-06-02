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
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/ideas")({
  head: () => ({ meta: [{ title: "Ideas — Personal OS" }] }),
  component: IdeasPage,
});

type Idea = { id: string; content: string; tags: string[]; created_at: string };

function IdeasPage() {
  useRealtimeTable("entries", ["ideas"]);
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  const { data: ideas = [] } = useQuery({
    queryKey: ["ideas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries").select("*").eq("type", "idea")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Idea[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const { error } = await supabase.from("entries").insert({
        type: "idea", content: content.trim(), tags: tagList, status: "todo",
      });
      if (error) throw error;
    },
    onSuccess: () => { setContent(""); setTags(""); qc.invalidateQueries({ queryKey: ["ideas"] }); },
  });

  const update = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase.from("entries").update({ content }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ideas"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ideas"] }),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Ideas" subtitle="Catch them before they vanish." />

      <Card className="mb-6 space-y-2 p-4 shadow-sm">
        <Textarea
          placeholder="What if..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
        />
        <div className="flex gap-2">
          <Input
            placeholder="tags, comma separated"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="flex-1"
          />
          <Button onClick={() => content.trim() && create.mutate()} disabled={!content.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Save
          </Button>
        </div>
      </Card>

      {ideas.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No ideas yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <Card key={idea.id} className="group p-4 shadow-sm transition hover:shadow-md">
              <Textarea
                defaultValue={idea.content}
                onBlur={(e) => {
                  if (e.target.value !== idea.content) {
                    update.mutate({ id: idea.id, content: e.target.value });
                  }
                }}
                className="mb-3 min-h-[80px] border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {idea.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
                <div className="ml-auto">
                  <Button
                    variant="ghost" size="icon"
                    className="opacity-0 transition group-hover:opacity-100"
                    onClick={() => del.mutate(idea.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
