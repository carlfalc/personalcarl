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
type MemoryCategory = "interest" | "project" | "preference" | "family" | "business" | "technology" | "travel";

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
    contact_email?: string | null;
    contact_phone?: string | null;
    relationship?: string | null;
    birth_date?: string | null;
  }>;
  email_intents: Array<{ recipient_query: string }>;
}

const EMPTY: ParsedNote = { entries: [], meetings: [], memory: [], email_intents: [] };

const SYSTEM_PROMPT = `You parse a personal-assistant voice note into structured data. Return ONLY valid JSON, no markdown, matching:

{
  entries: [{ type: 'task'|'idea'|'todo'|'diary', content: string, tags: string[], priority: 1|2|3, due_date: string|null }],
  meetings: [{ title: string, datetime: string, location: string|null, notes: string|null }],
  memory: [{ fact: string, category: 'interest'|'project'|'preference'|'family'|'business'|'technology'|'travel', confidence: number, contact_email: string|null, contact_phone: string|null, relationship: string|null, birth_date: string|null }],
  email_intents: [{ recipient_query: string }]
}

Rules:
- email_intents: include ONLY when the user clearly asks to email/send something to someone (e.g. "send email to kitchen", "email Sarah"). recipient_query is the name/word the user used to refer to the recipient. Do NOT invent a subject or body — those are gathered in a follow-up step.
- Never include email_intents for tasks, todos, meetings, ideas, diary notes, family/contact updates, birthdays, or generic "stop/cancel" messages.
- Tasks/to-dos → entries. Ideas → entries with type "idea". Scheduled calendar appointments → meetings. Durable facts → memory. Reflective notes → diary entries.
- Family/contact commands such as "add my sister Jane" or "add family name Jane" → memory with category "family". Put the person's name in fact if that is all you know, and fill contact_email, contact_phone, relationship, and birth_date only when provided.
- Business, technology, and travel facts/preferences → memory with their matching category when clearly requested.
- Empty arrays if nothing fits.`;

const COMPOSE_PROMPT = `You write a short professional email on behalf of the sender, based on what they just dictated. Return ONLY valid JSON: { "subject": string, "body": string }. Keep it concise, in the sender's voice, no signature block.`;

const FAMILY_PROFILE_PROMPT = `Extract family contact/profile details from the user's reply. Return ONLY valid JSON: { "contact_email": string|null, "contact_phone": string|null, "relationship": string|null, "birth_date": string|null, "has_no_more_details": boolean }. Use YYYY-MM-DD for birth_date when possible. If they say they don't have the details, set has_no_more_details true.`;

const INTENT_PROMPT = `Classify this Telegram message. Return ONLY JSON: { "intent": "query" | "capture" | "complete" }.
- "query": asking about existing data (tasks, meetings, ideas, memory, birthdays, schedule). Examples: "what's on today?", "when is my meeting with Sandesh?", "do I have anything overdue?".
- "complete": marking an existing task/todo as done. Examples: "done with the plumber one", "mark the FENZ email task as done", "finished the roster", "tick off buying milk", "I did the dishes".
- "capture": dictating new content to save (tasks, ideas, diary, meetings, memory, family, email requests). Examples: "add a task to call John", "remind me to buy milk", "email kitchen", "I had a good day".`;

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

async function callClaude(system: string, user: string, maxTokens = 1500): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`claude failed: ${JSON.stringify(data)}`);
  return (data.content?.[0]?.text ?? "").toString();
}

async function detectIntent(transcript: string): Promise<"query" | "capture"> {
  try {
    const raw = await callClaude(INTENT_PROMPT, transcript, 30);
    const parsed = JSON.parse(stripCodeFences(raw));
    return parsed.intent === "query" ? "query" : "capture";
  } catch (e) {
    console.error("detectIntent failed", e);
    return "capture";
  }
}

async function handleQuery(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  question: string,
  ownerId: string,
): Promise<void> {
  try {
    const sinceMeetings = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [entriesRes, meetingsRes, memoryRes, birthdaysRes] = await Promise.all([
      supabase.from("entries")
        .select("id, type, content, tags, priority, status, due_date, created_at")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("meetings")
        .select("title, datetime, location, notes, status")
        .eq("user_id", ownerId)
        .gte("datetime", sinceMeetings)
        .order("datetime", { ascending: true }),
      supabase.from("memory")
        .select("fact, category, confidence")
        .eq("user_id", ownerId),
      supabase.from("birthdays")
        .select("name, birth_date, notes")
        .eq("user_id", ownerId),
    ]);

    let entries = entriesRes.data ?? [];
    const meetings = meetingsRes.data ?? [];
    const memory = memoryRes.data ?? [];
    const birthdays = birthdaysRes.data ?? [];

    let payload = { entries, meetings, memory, birthdays };
    let json = JSON.stringify(payload);
    if (json.length > 60000) {
      // Truncate entries until under budget
      while (json.length > 60000 && entries.length > 20) {
        entries = entries.slice(0, Math.floor(entries.length * 0.7));
        payload = { entries, meetings, memory, birthdays };
        json = JSON.stringify(payload);
      }
    }

    const nowNz = new Date().toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "full", timeStyle: "short" });
    const system = `You are Carl's personal assistant. Answer his question using ONLY the data provided. Today's date/time in Pacific/Auckland is ${nowNz}. Be concise and direct — this is a Telegram chat, so plain text, no markdown headers, short lines. If the data doesn't contain the answer, say so plainly. When listing tasks or meetings, include due dates/times. Dates in the data are ISO format; present them in a friendly NZ format (e.g. 'Tue 9 Jun, 2:30pm').`;
    const userMsg = `Question: ${question}\n\nData:\n${json}`;
    const answer = (await callClaude(system, userMsg, 1000)).trim();
    await sendTelegram(chatId, answer || "I couldn't find an answer in your data.");
  } catch (e) {
    console.error("handleQuery failed", e);
    await sendTelegram(chatId, "⚠️ Couldn't look that up, try again.");
  }
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

async function extractFamilyProfileDetails(text: string): Promise<{
  contact_email: string | null;
  contact_phone: string | null;
  relationship: string | null;
  birth_date: string | null;
  has_no_more_details: boolean;
}> {
  try {
    const parsed = JSON.parse(stripCodeFences(await callClaude(FAMILY_PROFILE_PROMPT, text)));
    return {
      contact_email: parsed.contact_email ?? null,
      contact_phone: parsed.contact_phone ?? null,
      relationship: parsed.relationship ?? null,
      birth_date: parsed.birth_date ?? null,
      has_no_more_details: Boolean(parsed.has_no_more_details),
    };
  } catch (e) {
    console.error("extractFamilyProfileDetails parse error", e);
    return { contact_email: null, contact_phone: null, relationship: null, birth_date: null, has_no_more_details: /don'?t have|no details|not sure/i.test(text) };
  }
}

// ---------- Gmail (via Lovable gateway) ----------
async function lookupRecipientsInGmail(query: string): Promise<Array<{ name: string; email: string }>> {
  if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) return [];

  // Broad lookup: the user may say "info at the Avenue Hotel" — match the
  // local-part ("info"), domain ("avenuehotel"), display name, or any word.
  // Search both Sent (people the user emails) and the rest of the mailbox
  // (people who've emailed the user), then score by term overlap.
  const lower = query.trim().toLowerCase();
  const words = lower
    .split(/[^a-z0-9@.]+/i)
    .filter((w) => w && !["the", "a", "an", "at", "to", "for", "from", "of"].includes(w));
  const phrase = words.join(" ");
  const compact = words.join("");

  const terms = new Set<string>();
  if (phrase) terms.add(phrase);
  if (compact && compact !== phrase) terms.add(compact);
  for (const w of words) if (w.length >= 3) terms.add(w);
  if (!terms.size) terms.add(lower);

  const queries: string[] = [];
  for (const t of terms) {
    queries.push(`in:sent to:${t}`);
    queries.push(`in:anywhere from:${t}`);
    queries.push(`in:anywhere ${t}`);
  }

  const ids = new Set<string>();
  for (const q of queries) {
    const res = await fetch(
      `${GATEWAY}/google_mail/gmail/v1/users/me/messages?maxResults=8&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY } },
    );
    if (!res.ok) continue;
    const list = await res.json();
    for (const m of (list.messages ?? []).slice(0, 8)) ids.add(m.id);
    if (ids.size >= 30) break;
  }

  const seen = new Map<string, { name: string; email: string }>();
  for (const id of [...ids].slice(0, 30)) {
    const mres = await fetch(
      `${GATEWAY}/google_mail/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=To&metadataHeaders=From&metadataHeaders=Cc`,
      { headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY } },
    );
    if (!mres.ok) continue;
    const msg = await mres.json();
    const headers: Array<{ name: string; value: string }> = msg.payload?.headers ?? [];
    for (const h of headers) {
      const hn = h.name.toLowerCase();
      if (hn !== "to" && hn !== "from" && hn !== "cc") continue;
      for (const part of (h.value ?? "").split(/,(?![^<]*>)/)) {
        const m = part.trim().match(/^(?:"?([^"<]*)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?$/);
        if (!m) continue;
        const email = m[2].toLowerCase();
        const dn = (m[1] ?? "").trim().replace(/^"|"$/g, "");
        if (!seen.has(email)) seen.set(email, { email, name: dn });
      }
    }
  }

  const scored = [...seen.values()].map((r) => {
    const hay = `${r.name} ${r.email}`.toLowerCase();
    let score = 0;
    for (const t of terms) if (hay.includes(t)) score += t.length;
    return { r, score };
  }).filter((x) => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((x) => x.r);
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
const EMAIL_FLOW_TIMEOUT_MS = 30 * 60 * 1000;

interface Pending {
  id: string;
  status: string;
  recipient_email: string | null;
  recipient_name: string | null;
  candidates: Array<{ name: string; email: string }>;
  subject: string;
  body: string;
  updated_at?: string;
}

interface PendingFamilyProfile {
  id: string;
  memory_id: string;
  status: string;
  updated_at?: string;
  memory_name?: string | null;
}

function isCancelCommand(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return CANCEL_WORDS.includes(lower) || /\b(cancel|stop|abort|forget it|never mind|nevermind)\b/i.test(lower);
}

function looksLikeNewAssistantCommand(text: string): boolean {
  return /\b(add|create|organise|organize|schedule|book|make|save|remember|note|record)\b/i.test(text)
    || /\b(task|todo|to-do|meeting|appointment|idea|diary|family|birthday|business|technology|travel)\b/i.test(text);
}

function isFreshPending(pending: Pending): boolean {
  if (!pending.updated_at) return true;
  return Date.now() - new Date(pending.updated_at).getTime() <= EMAIL_FLOW_TIMEOUT_MS;
}

function isRecipientFlowReply(text: string, pending: Pending): boolean {
  const trimmed = text.trim().toLowerCase();
  const num = parseInt(trimmed, 10);
  return isCancelCommand(text)
    || EMAIL_RE.test(text)
    || YES_WORDS.includes(trimmed)
    || (!isNaN(num) && num >= 1 && num <= pending.candidates.length);
}

async function handlePendingFamilyProfile(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  text: string,
  pending: PendingFamilyProfile,
): Promise<boolean> {
  if (!isFreshPending(pending as Pending) || looksLikeNewAssistantCommand(text)) {
    await supabase.from("pending_family_profiles").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", pending.id);
    return false;
  }

  const details = await extractFamilyProfileDetails(text);
  if (details.has_no_more_details) {
    await supabase.from("pending_family_profiles").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", pending.id);
    await sendTelegram(chatId, `✅ No problem — ${pending.memory_name ?? "that family member"} is saved.`);
    return true;
  }

  const updates = {
    contact_email: details.contact_email,
    contact_phone: details.contact_phone,
    relationship: details.relationship,
    birth_date: details.birth_date,
    updated_at: new Date().toISOString(),
  };
  await supabase.from("memory").update(updates).eq("id", pending.memory_id);
  await supabase.from("pending_family_profiles").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", pending.id);
  await sendTelegram(chatId, `✅ Updated ${pending.memory_name ?? "the family profile"}.`);
  return true;
}

async function handleAwaitingRecipient(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  text: string,
  pending: Pending,
): Promise<void> {
  const trimmed = text.trim().toLowerCase();

  if (isCancelCommand(text)) {
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
  if (isCancelCommand(text)) {
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

    // Active family profile follow-up, unless this is clearly a new command
    const { data: familyPendingRows } = await supabase
      .from("pending_family_profiles")
      .select("id, memory_id, status, updated_at")
      .eq("chat_id", chatId)
      .eq("status", "awaiting_details")
      .order("created_at", { ascending: false })
      .limit(1);

    const familyPending = familyPendingRows?.[0] as PendingFamilyProfile | undefined;
    if (familyPending) {
      const { data: familyMemory } = await supabase.from("memory").select("fact").eq("id", familyPending.memory_id).maybeSingle();
      const handledFamily = await handlePendingFamilyProfile(supabase, chatId, transcript, {
        ...familyPending,
        memory_name: familyMemory?.fact ?? null,
      });
      if (handledFamily) {
        return new Response(JSON.stringify({ ok: true, handled: "family_profile" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Active email flow takes priority
    const { data: pendingRows } = await supabase
      .from("pending_email_intents")
      .select("id, status, recipient_email, recipient_name, candidates, subject, body, updated_at")
      .eq("chat_id", chatId)
      .in("status", ["awaiting_recipient", "awaiting_content"])
      .order("created_at", { ascending: false })
      .limit(1);

    const pending = pendingRows?.[0] as Pending | undefined;
    if (pending) {
      const shouldContinueEmailFlow = pending.status === "awaiting_content"
        ? isFreshPending(pending) && !looksLikeNewAssistantCommand(transcript)
        : isFreshPending(pending) && isRecipientFlowReply(transcript, pending);

      if (!shouldContinueEmailFlow) {
        await supabase.from("pending_email_intents").update({ status: "cancelled" }).eq("id", pending.id);
      } else {
      if (pending.status === "awaiting_recipient") {
        await handleAwaitingRecipient(supabase, chatId, transcript, pending);
      } else {
        await handleAwaitingContent(supabase, chatId, transcript, pending);
      }
      return new Response(JSON.stringify({ ok: true, handled: pending.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      }
    }

    // Resolve owner (single-user app): pick the first profile.
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const ownerId = ownerProfile?.id as string | undefined;
    if (!ownerId) {
      console.error("No owner profile found; cannot attribute new rows.");
    }

    // Intent detection: is this a question about existing data, or new content?
    if (ownerId) {
      const intent = await detectIntent(transcript);
      if (intent === "query") {
        await handleQuery(supabase, chatId, transcript, ownerId);
        return new Response(JSON.stringify({ ok: true, handled: "query" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Otherwise classify as note
    const parsed = await classifyNote(transcript);

    // Fallback: if nothing was extracted and the user didn't mention any known
    // keyword (task / meeting / idea / to-do / etc.), save the raw message as a task.
    const nothingExtracted =
      parsed.entries.length === 0 &&
      parsed.meetings.length === 0 &&
      parsed.memory.length === 0 &&
      parsed.email_intents.length === 0;
    const hasKnownKeyword = /\b(task|todo|to[-\s]?do|meeting|appointment|idea|diary|family|birthday|business|technology|travel|email)\b/i.test(transcript);
    if (nothingExtracted && !hasKnownKeyword && transcript.trim().length > 0) {
      parsed.entries.push({
        type: "task",
        content: transcript.trim(),
        tags: ["telegram"],
        priority: 3,
        due_date: null,
      });
    }

    if (parsed.entries.length && ownerId) {
      const rows = parsed.entries.map((e) => ({
        type: e.type, content: e.content, tags: e.tags ?? [],
        priority: e.priority ?? 2, status: "todo", due_date: e.due_date ?? null,
        user_id: ownerId,
      }));
      const { error } = await supabase.from("entries").insert(rows);
      if (error) console.error("entries insert error", error);
    }
    if (parsed.meetings.length && ownerId) {
      const rows = parsed.meetings.map((m) => ({
        title: m.title, datetime: m.datetime,
        location: m.location ?? null, notes: m.notes ?? null,
        user_id: ownerId,
      }));
      const { error } = await supabase.from("meetings").insert(rows);
      if (error) console.error("meetings insert error", error);
    }
    let familyFollowUp: { memory_id: string; name: string } | null = null;
    for (const m of parsed.memory) {
      if (!ownerId) break;
      const { data: existing } = await supabase
        .from("memory").select("id").eq("fact", m.fact).eq("user_id", ownerId).maybeSingle();
      if (existing) {
        await supabase.from("memory").update({
          category: m.category, confidence: m.confidence ?? 0.8,
          source: "telegram", updated_at: new Date().toISOString(),
          contact_email: m.contact_email ?? null,
          contact_phone: m.contact_phone ?? null,
          relationship: m.relationship ?? null,
          birth_date: m.birth_date ?? null,
        }).eq("id", existing.id);
        if (m.category === "family" && (!m.contact_email || !m.contact_phone || !m.relationship || !m.birth_date)) {
          familyFollowUp = { memory_id: existing.id, name: m.fact };
        }
      } else {
        const { data: inserted } = await supabase.from("memory").insert({
          fact: m.fact, category: m.category,
          confidence: m.confidence ?? 0.8, source: "telegram",
          contact_email: m.contact_email ?? null,
          contact_phone: m.contact_phone ?? null,
          relationship: m.relationship ?? null,
          birth_date: m.birth_date ?? null,
          user_id: ownerId,
        }).select("id").maybeSingle();
        if (m.category === "family" && inserted?.id && (!m.contact_email || !m.contact_phone || !m.relationship || !m.birth_date)) {
          familyFollowUp = { memory_id: inserted.id, name: m.fact };
        }
      }
    }

    if (familyFollowUp) {
      await supabase.from("pending_family_profiles").insert({
        chat_id: chatId,
        memory_id: familyFollowUp.memory_id,
        status: "awaiting_details",
      });
    }

    // Start at most one email flow per message (simplest UX)
    const firstIntent = parsed.email_intents[0];
    if (firstIntent?.recipient_query) {
      await startRecipientFlow(supabase, chatId, firstIntent.recipient_query);
    }

    const summary = summarise(parsed, firstIntent ? 1 : 0);
    if (summary) await sendTelegram(chatId, summary);
    if (familyFollowUp) {
      await sendTelegram(chatId, `👤 I added ${familyFollowUp.name} as family. Send any profile details you have — relationship, phone, email, address or birthday. If you don't have them, just say "I don't have it".`);
    }

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
