// Telegram webhook — full pipeline with email-drafting round-trip.
// - Receives Telegram updates (text or voice).
// - If there's a pending email confirmation for this chat, treats the message
//   as a reply (yes / no / pick-a-number / paste-an-email) and creates the
//   Gmail draft via the Lovable connector gateway.
// - Otherwise: transcribes, classifies with Claude into entries/meetings/memory
//   AND optional email_intents. For each email intent, searches Gmail Sent for
//   the recipient and asks the user to confirm in Telegram.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY")!;
const GATEWAY = "https://connector-gateway.lovable.dev";

type EntryType = "task" | "idea" | "todo" | "diary";
type MemoryCategory = "interest" | "project" | "preference";

interface EmailIntent {
  recipient_query: string; // e.g. "Sarah" or "sarah@" or "sarah jones"
  subject: string;
  body: string;
}

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
  email_intents: EmailIntent[];
}

const EMPTY: ParsedNote = { entries: [], meetings: [], memory: [], email_intents: [] };

const SYSTEM_PROMPT = `You parse a personal-assistant voice note into structured data. Return ONLY valid JSON, no markdown, no preamble, matching:

{
  entries: [{ type: 'task'|'idea'|'todo'|'diary', content: string, tags: string[], priority: 1|2|3, due_date: string|null }],
  meetings: [{ title: string, datetime: string, location: string|null, notes: string|null }],
  memory: [{ fact: string, category: 'interest'|'project'|'preference', confidence: number }],
  email_intents: [{ recipient_query: string, subject: string, body: string }]
}

Rules:
- A single note may produce multiple items across categories.
- email_intents: ONLY when the user clearly asks to email/send something to someone (e.g. "email Sarah about the invoice", "send John a note saying..."). recipient_query is the name or partial email the user said. Write a concise subject and a professional body in the user's voice. If the user did not ask to email anyone, return [].
- Put scheduled/calendar items in meetings. Durable facts in memory. Reflective/journal content in diary. Empty arrays if nothing fits. Infer priority (1=high).`;

// ---------- Telegram helpers ----------
async function sendTelegram(chatId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error("sendTelegram failed", e);
  }
}

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

// ---------- Transcription + classification ----------
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
      email_intents: Array.isArray(parsed.email_intents) ? parsed.email_intents : [],
    };
  } catch (e) {
    console.error("Failed to parse Claude JSON:", text);
    return EMPTY;
  }
}

// ---------- Gmail (via Lovable gateway) ----------
async function lookupRecipientsInGmail(
  query: string,
): Promise<Array<{ name: string; email: string }>> {
  if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) return [];
  const q = encodeURIComponent(`in:sent to:${query}`);
  const listRes = await fetch(
    `${GATEWAY}/google_mail/gmail/v1/users/me/messages?maxResults=10&q=${q}`,
    { headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY } },
  );
  if (!listRes.ok) return [];
  const list = await listRes.json();
  const ids: string[] = (list.messages ?? []).slice(0, 10).map((m: { id: string }) => m.id);

  const seen = new Map<string, { name: string; email: string }>();
  for (const id of ids) {
    const mres = await fetch(
      `${GATEWAY}/google_mail/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=To`,
      { headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY } },
    );
    if (!mres.ok) continue;
    const msg = await mres.json();
    const toHeader: string = msg.payload?.headers?.find(
      (h: { name: string }) => h.name.toLowerCase() === "to",
    )?.value ?? "";
    for (const part of toHeader.split(/,(?![^<]*>)/)) {
      const m = part.trim().match(/^(?:"?([^"<]*)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?$/);
      if (!m) continue;
      const email = m[2].toLowerCase();
      const name = (m[1] ?? "").trim();
      if (!seen.has(email)) seen.set(email, { email, name });
    }
  }
  const needle = query.toLowerCase();
  return [...seen.values()]
    .filter((r) => r.email.includes(needle) || r.name.toLowerCase().includes(needle))
    .slice(0, 5);
}

function base64url(input: string): string {
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createGmailDraft(args: {
  to: string;
  subject: string;
  body: string;
}): Promise<string> {
  const rfc2822 = [
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    args.body,
  ].join("\r\n");
  const res = await fetch(`${GATEWAY}/google_mail/gmail/v1/users/me/drafts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { raw: base64url(rfc2822) } }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gmail draft failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const draft = await res.json();
  return draft.id ?? "";
}

// ---------- Email-intent handling ----------
function formatRecipient(r: { name: string; email: string }): string {
  return r.name ? `${r.name} <${r.email}>` : r.email;
}

async function startEmailFlow(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  intent: EmailIntent,
): Promise<void> {
  const matches = await lookupRecipientsInGmail(intent.recipient_query);
  const top = matches[0] ?? null;

  await supabase.from("pending_email_intents").insert({
    chat_id: chatId,
    status: "awaiting_confirmation",
    recipient_email: top?.email ?? null,
    recipient_name: top?.name ?? null,
    candidates: matches,
    subject: intent.subject,
    body: intent.body,
  });

  let msg = `✉️ Draft ready for "${intent.subject}".\n\n`;
  if (matches.length === 0) {
    msg += `Couldn't find "${intent.recipient_query}" in your Sent folder. Reply with the email address to use, or "cancel".`;
  } else if (matches.length === 1 && top) {
    msg += `Send to ${formatRecipient(top)}?\nReply "yes", paste a different email, or "cancel".`;
  } else {
    msg += `Found ${matches.length} matches — pick one:\n`;
    matches.forEach((r, i) => { msg += `${i + 1}. ${formatRecipient(r)}\n`; });
    msg += `Reply with the number, paste a different email, or "cancel".`;
  }
  await sendTelegram(chatId, msg);
}

async function finalizeEmailDraft(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  intentId: string,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  try {
    const draftId = await createGmailDraft({ to, subject, body });
    await supabase.from("pending_email_intents").update({
      status: "drafted",
      recipient_email: to,
      gmail_draft_id: draftId,
    }).eq("id", intentId);

    // Also log to drafts_log so it shows in the Email page side panel
    await supabase.from("drafts_log").insert({
      user_id: "00000000-0000-0000-0000-000000000000", // telegram-origin marker; replace if you map chat→user
      gmail_draft_id: draftId,
      recipient: to,
      subject,
      body_preview: body.slice(0, 200),
    }).then(({ error }) => { if (error) console.warn("drafts_log insert skipped:", error.message); });

    await sendTelegram(
      chatId,
      `✅ Draft saved to Gmail for ${to}.\nOpen: https://mail.google.com/mail/u/0/#drafts`,
    );
  } catch (e) {
    console.error("finalizeEmailDraft", e);
    await sendTelegram(chatId, `⚠️ Couldn't save the draft: ${e instanceof Error ? e.message : "unknown error"}`);
  }
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

async function handlePendingReply(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  text: string,
  pending: {
    id: string;
    recipient_email: string | null;
    candidates: Array<{ name: string; email: string }>;
    subject: string;
    body: string;
  },
): Promise<boolean> {
  const trimmed = text.trim().toLowerCase();

  if (["cancel", "no", "stop", "abort"].includes(trimmed)) {
    await supabase.from("pending_email_intents").update({ status: "cancelled" }).eq("id", pending.id);
    await sendTelegram(chatId, "❌ Cancelled. The draft was not saved.");
    return true;
  }

  // Pick by number
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= pending.candidates.length) {
    const picked = pending.candidates[num - 1];
    await finalizeEmailDraft(supabase, chatId, pending.id, picked.email, pending.subject, pending.body);
    return true;
  }

  // Pasted email address
  const emailMatch = text.match(EMAIL_RE);
  if (emailMatch) {
    await finalizeEmailDraft(supabase, chatId, pending.id, emailMatch[0], pending.subject, pending.body);
    return true;
  }

  // Yes / confirm
  if (["yes", "y", "ok", "yep", "yeah", "send", "confirm"].includes(trimmed)) {
    if (!pending.recipient_email) {
      await sendTelegram(chatId, "I don't have an email address yet — paste one and I'll save the draft.");
      return true;
    }
    await finalizeEmailDraft(
      supabase, chatId, pending.id, pending.recipient_email, pending.subject, pending.body,
    );
    return true;
  }

  // Unrecognised — leave intent open, gentle nudge
  await sendTelegram(chatId, 'Reply "yes", a number (1, 2...), an email address, or "cancel".');
  return true;
}

// ---------- Persistence summary ----------
function summarise(p: ParsedNote, emailsStarted: number): string {
  const parts: string[] = [];
  const counts: Record<string, number> = {};
  for (const e of p.entries) counts[e.type] = (counts[e.type] ?? 0) + 1;
  for (const [t, n] of Object.entries(counts)) parts.push(`${n} ${t}${n > 1 ? "s" : ""}`);
  if (p.meetings.length) parts.push(`${p.meetings.length} meeting${p.meetings.length > 1 ? "s" : ""}`);

  let msg = parts.length ? `✅ Saved ${parts.join(", ")}.` : "";
  if (p.memory.length) {
    const facts = p.memory.map((m) => m.fact).slice(0, 2).join("; ");
    msg += (msg ? " " : "") + `Noted: ${facts}.`;
  }
  if (emailsStarted > 0) {
    msg += (msg ? " " : "") + `📨 ${emailsStarted} email draft${emailsStarted > 1 ? "s" : ""} pending your confirmation above.`;
  }
  if (!msg) msg = "✅ Got it — nothing to save.";
  return msg;
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let chatId: number | null = null;
  try {
    const update = await req.json();
    const message = update.message ?? update.edited_message;
    chatId = message?.chat?.id ?? null;

    if (!message || !chatId) {
      return new Response(JSON.stringify({ ok: true, ignored: "no message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get text — voice or typed
    let transcript = "";
    if (message.voice?.file_id) {
      const audio = await downloadTelegramVoice(message.voice.file_id);
      transcript = await transcribeWithWhisper(audio);
    } else if (typeof message.text === "string") {
      transcript = message.text.trim();
    } else {
      await sendTelegram(chatId, "Send me a voice note or text and I'll save it.");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!transcript) {
      await sendTelegram(chatId, "Couldn't read that, sorry.");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. If there's a pending email confirmation, treat this message as the reply
    const { data: pendingRows } = await supabase
      .from("pending_email_intents")
      .select("id, recipient_email, candidates, subject, body")
      .eq("chat_id", chatId)
      .eq("status", "awaiting_confirmation")
      .order("created_at", { ascending: false })
      .limit(1);

    if (pendingRows && pendingRows.length > 0) {
      const handled = await handlePendingReply(
        supabase,
        chatId,
        transcript,
        pendingRows[0] as never,
      );
      if (handled) {
        return new Response(JSON.stringify({ ok: true, handled: "pending_email" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Normal classification
    const parsed = await classifyWithClaude(transcript);

    if (parsed.entries.length) {
      const rows = parsed.entries.map((e) => ({
        type: e.type, content: e.content, tags: e.tags ?? [],
        priority: e.priority ?? 2, status: "todo", due_date: e.due_date ?? null,
      }));
      const { error } = await supabase.from("entries").insert(rows);
      if (error) console.error("entries insert error", error);
    }
    if (parsed.meetings.length) {
      const rows = parsed.meetings.map((m) => ({
        title: m.title, datetime: m.datetime,
        location: m.location ?? null, notes: m.notes ?? null,
      }));
      const { error } = await supabase.from("meetings").insert(rows);
      if (error) console.error("meetings insert error", error);
    }
    for (const m of parsed.memory) {
      const { data: existing } = await supabase
        .from("memory").select("id").eq("fact", m.fact).maybeSingle();
      if (existing) {
        await supabase.from("memory").update({
          category: m.category, confidence: m.confidence ?? 0.8,
          source: "telegram", updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("memory").insert({
          fact: m.fact, category: m.category,
          confidence: m.confidence ?? 0.8, source: "telegram",
        });
      }
    }

    // 3. Kick off email confirmation flows
    for (const intent of parsed.email_intents) {
      await startEmailFlow(supabase, chatId, intent);
    }

    // 4. Final summary (only if non-email content; email flows already replied)
    if (parsed.entries.length || parsed.meetings.length || parsed.memory.length || parsed.email_intents.length === 0) {
      await sendTelegram(chatId, summarise(parsed, parsed.email_intents.length));
    }

    return new Response(JSON.stringify({ ok: true, parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("telegram-webhook error", err);
    if (chatId) await sendTelegram(chatId, "⚠️ Something went wrong. I'll keep trying.");
    return new Response(JSON.stringify({ ok: true, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
