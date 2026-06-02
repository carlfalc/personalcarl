// Telegram webhook — full pipeline.
// Receives Telegram updates (text or voice), transcribes voice with OpenAI Whisper,
// classifies with Claude, writes to entries/meetings/memory, and replies to the user.
//
// Public endpoint (verify_jwt = false in supabase/config.toml).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

type EntryType = "task" | "idea" | "todo" | "diary";
type MemoryCategory = "interest" | "project" | "preference";

interface ParsedNote {
  entries: Array<{
    type: EntryType;
    content: string;
    tags?: string[];
    priority?: 1 | 2 | 3;
    due_date?: string | null;
  }>;
  meetings: Array<{
    title: string;
    datetime: string;
    location?: string | null;
    notes?: string | null;
  }>;
  memory: Array<{
    fact: string;
    category: MemoryCategory;
    confidence?: number;
  }>;
}

const EMPTY: ParsedNote = { entries: [], meetings: [], memory: [] };

const SYSTEM_PROMPT = `You parse a personal-assistant voice note into structured data. Return ONLY valid JSON, no markdown, no preamble, matching:

{
  entries: [{ type: 'task'|'idea'|'todo'|'diary', content: string, tags: string[], priority: 1|2|3, due_date: string|null }],
  meetings: [{ title: string, datetime: string, location: string|null, notes: string|null }],
  memory: [{ fact: string, category: 'interest'|'project'|'preference', confidence: number }]
}

Rules: A single note may produce multiple items across categories. Put scheduled/calendar items in meetings. Put durable facts about the user (interests, ongoing projects, preferences) in memory. Reflective/journal content goes to diary. Leave arrays empty if nothing fits. Infer priority (1=high).`;

async function downloadTelegramVoice(fileId: string): Promise<Blob> {
  const infoRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
  );
  const info = await infoRes.json();
  if (!info.ok) throw new Error(`getFile failed: ${JSON.stringify(info)}`);
  const filePath = info.result.file_path as string;

  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`,
  );
  if (!fileRes.ok) throw new Error(`download failed: ${fileRes.status}`);
  return await fileRes.blob();
}

async function transcribeWithWhisper(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "voice.oga");
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`whisper failed: ${JSON.stringify(data)}`);
  return (data.text ?? "").trim();
}

function stripCodeFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

async function classifyWithClaude(transcript: string): Promise<ParsedNote> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: transcript }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`claude failed: ${JSON.stringify(data)}`);

  const text = (data.content?.[0]?.text ?? "").toString();
  try {
    const parsed = JSON.parse(stripCodeFences(text));
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      meetings: Array.isArray(parsed.meetings) ? parsed.meetings : [],
      memory: Array.isArray(parsed.memory) ? parsed.memory : [],
    };
  } catch (e) {
    console.error("Failed to parse Claude JSON:", text);
    return EMPTY;
  }
}

async function sendTelegramReply(chatId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error("sendTelegramReply failed", e);
  }
}

function summarise(p: ParsedNote): string {
  const parts: string[] = [];
  const counts: Record<string, number> = {};
  for (const e of p.entries) counts[e.type] = (counts[e.type] ?? 0) + 1;
  for (const [t, n] of Object.entries(counts)) {
    parts.push(`${n} ${t}${n > 1 ? "s" : ""}`);
  }
  if (p.meetings.length) parts.push(`${p.meetings.length} meeting${p.meetings.length > 1 ? "s" : ""}`);

  let msg = parts.length ? `✅ Saved ${parts.join(", ")}.` : "✅ Got it — nothing to save.";
  if (p.memory.length) {
    const facts = p.memory.map((m) => m.fact).slice(0, 2).join("; ");
    msg += ` Noted: ${facts}.`;
  }
  return msg;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let chatId: number | null = null;
  try {
    const update = await req.json();
    const message = update.message ?? update.edited_message;
    chatId = message?.chat?.id ?? null;

    if (!message) {
      return new Response(JSON.stringify({ ok: true, ignored: "no message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1+2. Get transcript from voice or text
    let transcript = "";
    if (message.voice?.file_id) {
      const audio = await downloadTelegramVoice(message.voice.file_id);
      transcript = await transcribeWithWhisper(audio);
    } else if (typeof message.text === "string") {
      transcript = message.text.trim();
    } else {
      if (chatId) await sendTelegramReply(chatId, "Send me a voice note or text and I'll save it.");
      return new Response(JSON.stringify({ ok: true, ignored: "unsupported message type" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!transcript) {
      if (chatId) await sendTelegramReply(chatId, "Couldn't read that, sorry.");
      return new Response(JSON.stringify({ ok: true, ignored: "empty transcript" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Classify with Claude
    const parsed = await classifyWithClaude(transcript);

    // 4. Persist
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (parsed.entries.length) {
      const rows = parsed.entries.map((e) => ({
        type: e.type,
        content: e.content,
        tags: e.tags ?? [],
        priority: e.priority ?? 2,
        status: "todo",
        due_date: e.due_date ?? null,
      }));
      const { error } = await supabase.from("entries").insert(rows);
      if (error) console.error("entries insert error", error);
    }

    if (parsed.meetings.length) {
      const rows = parsed.meetings.map((m) => ({
        title: m.title,
        datetime: m.datetime,
        location: m.location ?? null,
        notes: m.notes ?? null,
      }));
      const { error } = await supabase.from("meetings").insert(rows);
      if (error) console.error("meetings insert error", error);
    }

    for (const m of parsed.memory) {
      // Upsert-by-fact: skip exact duplicates.
      const { data: existing } = await supabase
        .from("memory")
        .select("id")
        .eq("fact", m.fact)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("memory")
          .update({
            category: m.category,
            confidence: m.confidence ?? 0.8,
            source: "telegram",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("memory").insert({
          fact: m.fact,
          category: m.category,
          confidence: m.confidence ?? 0.8,
          source: "telegram",
        });
      }
    }

    // 5. Reply
    if (chatId) await sendTelegramReply(chatId, summarise(parsed));

    return new Response(JSON.stringify({ ok: true, parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("telegram-webhook error", err);
    if (chatId) await sendTelegramReply(chatId, "⚠️ Something went wrong saving that. I'll keep trying.");
    // Always 200 so Telegram doesn't retry.
    return new Response(JSON.stringify({ ok: true, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
