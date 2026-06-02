// Telegram webhook — voice/text → entries + multi-step email-drafting flow.
//
// Email-drafting flow (one chat at a time):
//   1. User: "send email to Kitchen"
//      → row inserted with status='awaiting_recipient', candidates from Gmail Sent.
//      → bot replies: "Found Kitchen <kitchen@x.com>. Is this correct? Reply yes / no / paste an email."
//   2. User: "yes" (or "1", or pastes an email)
//      → status becomes 'awaiting_content'.
//      → bot replies: "Great — what should the email say?"
//   3. User: describes the email content (voice or text).
//      → Claude turns it into {subject, body}, draft saved to Gmail Drafts.
//      → bot replies with confirmation + Gmail link.
//
// "cancel" / "no" at any stage aborts.

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
  memory: Array<{ fact: string; category: MemoryCategory; confidence?: number }>;
  email_intents: Array<{ recipient_query: string }>;
}

const EMPTY: ParsedNote = { entries: [], meetings: [], memory: [], email_intents: [] };

const SYSTEM_PROMPT = `You parse a personal-assistant voice note into structured data. Return ONLY valid JSON, no markdown, matching:

{
  entries: [{ type: 'task'|'idea'|'todo'|'diary', content: string, tags: string[], priority: 1|2|3, due_date: string|null }],
  meetings: [{ title: string, datetime: string, location: string|null, notes: string|null }],
  memory: [{ fact: string, category: 'interest'|'project'|'preference', confidence: number }],
  email_intents: [{ recipient_query: string }]
}

Rules:
- email_intents: include ONLY when the user clearly asks to email/send something to someone (e.g. "send email to kitchen", "email Sarah"). recipient_query is the name/word the user used to refer to the recipient. Do NOT invent a subject or body — those are gathered in a follow-up step.
- Scheduled items → meetings. Durable facts → memory. Reflective → diary. Empty arrays if nothing fits.`;

const COMPOSE_PROMPT = `You write a short professional email on behalf of the sender, based on what they just dictated. Return ONLY valid JSON: { "subject": string, "body": string }. Keep it concise, in the sender's voice, no signature block.`;

// ---------- Telegram helpers ----------
async function sendTelegram(chatId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) { console.error("sendTelegram failed", e); }
}

async function downloadTelegramVoice(fileId: string): Promise<Blob> {
  const infoRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
  );
  const info = await infoRes.json();
  if (!info.ok) throw new Error(`getFile failed: ${JSON.stringify(info)}`);
  const fileRes = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${info.result.file_path}`);
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

async function callClaude(system: string, user: string): Promise<string> {
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
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`claude failed: ${JSON.stringify(data)}`);
  return (data.content?.[0]?.text ?? "").toString();
}

async function classifyNote(transcript: string): Promise<ParsedNote> {
  try {
    const parsed = JSON.parse(stripCodeFences(await callClaude(SYSTEM_PROMPT, transcript)));
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      meetings: Array.isArray(parsed.meetings) ? parsed.meetings : [],
      memory: Array.isArray(parsed.memory) ? parsed.memory : [],
      email_intents: Array.isArray(parsed.email_intents) ? parsed.email_intents : [],
    };
  } catch (e) {
    console.error("classifyNote parse error", e);
    return EMPTY;
  }
}

async function composeEmail(description: string): Promise<{ subject: string; body: string }> {
  const text = await callClaude(COMPOSE_PROMPT, description);
  try {
    const parsed = JSON.parse(stripCodeFences(text));
    return {
      subject: String(parsed.subject ?? "(no subject)").slice(0, 200),
      body: String(parsed.body ?? description),
    };
  } catch {
    return { subject: "(no subject)", body: description };
  }
}

// ---------- Gmail (via Lovable gateway) ----------
async function lookupRecipientsInGmail(query: string): Promise<Array<{ name: string; email: string }>> {
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

async function createGmailDraft(args: { to: string; subject: string; body: string }): Promise<string> {
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

// ---------- Email flow ----------
function formatRecipient(r: { name: string; email: string }): string {
  return r.name ? `${r.name} <${r.email}>` : r.email;
}

async function startRecipientFlow(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  recipientQuery: string,
): Promise<void> {
  const matches = await lookupRecipientsInGmail(recipientQuery);
  const top = matches[0] ?? null;

  await supabase.from("pending_email_intents").insert({
    chat_id: chatId,
    status: "awaiting_recipient",
    recipient_email: top?.email ?? null,
    recipient_name: top?.name ?? null,
    candidates: matches,
    subject: "",
    body: "",
  });

  let msg: string;
  if (matches.length === 0) {
    msg = `🔍 Couldn't find "${recipientQuery}" in your Sent folder.\nReply with the email address to use, or "cancel".`;
  } else if (matches.length === 1 && top) {
    msg = `📬 Found ${formatRecipient(top)}.\nIs this correct? Reply "yes", paste a different email, or "cancel".`;
  } else {
    msg = `📬 Found ${matches.length} matches for "${recipientQuery}":\n`;
    matches.forEach((r, i) => { msg += `${i + 1}. ${formatRecipient(r)}\n`; });
    msg += `Reply with the number, paste an email, or "cancel".`;
  }
  await sendTelegram(chatId, msg);
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const YES_WORDS = ["yes", "y", "ok", "yep", "yeah", "correct", "confirm", "send", "go"];
const CANCEL_WORDS = ["cancel", "no", "stop", "abort", "nope"];

interface Pending {
  id: string;
  status: string;
  recipient_email: string | null;
  recipient_name: string | null;
  candidates: Array<{ name: string; email: string }>;
  subject: string;
  body: string;
}

async function handleAwaitingRecipient(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  text: string,
  pending: Pending,
): Promise<void> {
  const trimmed = text.trim().toLowerCase();

  if (CANCEL_WORDS.includes(trimmed)) {
    await supabase.from("pending_email_intents").update({ status: "cancelled" }).eq("id", pending.id);
    await sendTelegram(chatId, "❌ Cancelled.");
    return;
  }

  let confirmedEmail: string | null = null;
  let confirmedName: string | null = null;

  // Pick by number
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= pending.candidates.length) {
    const picked = pending.candidates[num - 1];
    confirmedEmail = picked.email;
    confirmedName = picked.name;
  }

  // Pasted email
  if (!confirmedEmail) {
    const m = text.match(EMAIL_RE);
    if (m) { confirmedEmail = m[0]; confirmedName = ""; }
  }

  // Yes
  if (!confirmedEmail && YES_WORDS.includes(trimmed)) {
    if (!pending.recipient_email) {
      await sendTelegram(chatId, "I don't have an email address yet — paste one, or reply \"cancel\".");
      return;
    }
    confirmedEmail = pending.recipient_email;
    confirmedName = pending.recipient_name;
  }

  if (!confirmedEmail) {
    await sendTelegram(chatId, 'Reply "yes", a number, an email address, or "cancel".');
    return;
  }

  await supabase.from("pending_email_intents").update({
    status: "awaiting_content",
    recipient_email: confirmedEmail,
    recipient_name: confirmedName,
  }).eq("id", pending.id);

  await sendTelegram(
    chatId,
    `✅ Got it — ${confirmedName ? `${confirmedName} <${confirmedEmail}>` : confirmedEmail}.\n\n✍️ What should the email say? Send a voice note or text and I'll draft it.`,
  );
}

async function handleAwaitingContent(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  text: string,
  pending: Pending,
): Promise<void> {
  const trimmed = text.trim().toLowerCase();
  if (CANCEL_WORDS.includes(trimmed)) {
    await supabase.from("pending_email_intents").update({ status: "cancelled" }).eq("id", pending.id);
    await sendTelegram(chatId, "❌ Cancelled.");
    return;
  }

  try {
    const { subject, body } = await composeEmail(text);
    const draftId = await createGmailDraft({
      to: pending.recipient_email!,
      subject,
      body,
    });
    await supabase.from("pending_email_intents").update({
      status: "drafted",
      subject,
      body,
      gmail_draft_id: draftId,
    }).eq("id", pending.id);

    // Log to drafts_log so it shows up on the email page.
    // Single-user app: pick the first profile (owner).
    const { data: owner } = await supabase
      .from("profiles")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (owner?.id) {
      await supabase.from("drafts_log").insert({
        user_id: owner.id,
        gmail_draft_id: draftId,
        recipient: pending.recipient_email,
        subject,
        body_preview: body.slice(0, 200),
      });
    }


    await sendTelegram(
      chatId,
      `✅ Draft saved to Gmail.\nTo: ${pending.recipient_email}\nSubject: ${subject}\n\nOpen: https://mail.google.com/mail/u/0/#drafts`,
    );
  } catch (e) {
    console.error("draft failed", e);
    await sendTelegram(chatId, `⚠️ Couldn't save the draft: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

// ---------- Summary for non-email content ----------
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
  if (!msg && emailsStarted === 0) msg = "✅ Got it.";
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
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let transcript = "";
    if (message.voice?.file_id) {
      transcript = await transcribeWithWhisper(await downloadTelegramVoice(message.voice.file_id));
    } else if (typeof message.text === "string") {
      transcript = message.text.trim();
    } else {
      await sendTelegram(chatId, "Send me a voice note or text.");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!transcript) {
      await sendTelegram(chatId, "Couldn't read that, sorry.");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Active email flow takes priority
    const { data: pendingRows } = await supabase
      .from("pending_email_intents")
      .select("id, status, recipient_email, recipient_name, candidates, subject, body")
      .eq("chat_id", chatId)
      .in("status", ["awaiting_recipient", "awaiting_content"])
      .order("created_at", { ascending: false })
      .limit(1);

    const pending = pendingRows?.[0] as Pending | undefined;
    if (pending) {
      if (pending.status === "awaiting_recipient") {
        await handleAwaitingRecipient(supabase, chatId, transcript, pending);
      } else {
        await handleAwaitingContent(supabase, chatId, transcript, pending);
      }
      return new Response(JSON.stringify({ ok: true, handled: pending.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Otherwise classify as note
    const parsed = await classifyNote(transcript);

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

    // Start at most one email flow per message (simplest UX)
    const firstIntent = parsed.email_intents[0];
    if (firstIntent?.recipient_query) {
      await startRecipientFlow(supabase, chatId, firstIntent.recipient_query);
    }

    const summary = summarise(parsed, firstIntent ? 1 : 0);
    if (summary) await sendTelegram(chatId, summary);

    return new Response(JSON.stringify({ ok: true, parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("telegram-webhook error", err);
    if (chatId) await sendTelegram(chatId, "⚠️ Something went wrong.");
    return new Response(JSON.stringify({ ok: true, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
