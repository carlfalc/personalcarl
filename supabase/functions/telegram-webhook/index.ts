// Telegram webhook stub.
//
// Expects POST { transcript: string }.
// 1. Calls an LLM to classify the transcript into an entry type and extract memory facts.
// 2. Inserts rows into `entries` and/or `memory`.
//
// TODO: wire actual Telegram bot -> voice transcription pipeline upstream of this.
// TODO: replace placeholder LLM call with your provider of choice using LLM_API_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EntryType = "task" | "idea" | "todo" | "diary";
type MemoryCategory = "interest" | "project" | "preference";

interface Classification {
  entry?: {
    type: EntryType;
    content: string;
    tags?: string[];
    priority?: number;
    due_date?: string | null;
  };
  memory?: Array<{
    fact: string;
    category: MemoryCategory;
    confidence?: number;
  }>;
}

// TODO: replace with a real LLM call.
// const LLM_API_KEY = Deno.env.get("LLM_API_KEY"); // placeholder env var
async function classifyTranscript(transcript: string): Promise<Classification> {
  // TODO: send `transcript` to your LLM with a prompt like:
  //   "Classify this transcript into one of {task, idea, todo, diary}.
  //    Extract any durable facts about the user (interests, projects, preferences).
  //    Return JSON: { entry: {...}, memory: [...] }."
  // For now, naive heuristic so the endpoint is callable end-to-end.
  const lower = transcript.toLowerCase();
  let type: EntryType = "diary";
  if (lower.startsWith("idea") || lower.includes("what if")) type = "idea";
  else if (lower.startsWith("todo") || lower.startsWith("remind")) type = "todo";
  else if (lower.startsWith("task") || lower.includes("by ")) type = "task";

  return {
    entry: { type, content: transcript, tags: [], priority: 2, due_date: null },
    memory: [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript } = await req.json();
    if (typeof transcript !== "string" || !transcript.trim()) {
      return new Response(JSON.stringify({ error: "transcript required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const result = await classifyTranscript(transcript);
    const inserted: Record<string, unknown> = {};

    if (result.entry) {
      const { data, error } = await supabase.from("entries").insert(result.entry).select().single();
      if (error) throw error;
      inserted.entry = data;
    }

    if (result.memory && result.memory.length > 0) {
      const rows = result.memory.map((m) => ({
        fact: m.fact,
        category: m.category,
        confidence: m.confidence ?? 0.8,
        source: "telegram",
      }));
      const { data, error } = await supabase.from("memory").insert(rows).select();
      if (error) throw error;
      inserted.memory = data;
    }

    return new Response(JSON.stringify({ ok: true, inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("telegram-webhook error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
