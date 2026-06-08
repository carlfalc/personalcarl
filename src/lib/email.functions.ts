import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

// ---- Transcribe audio via Lovable AI Gateway ----
export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { audioBase64: string; mimeType: string }) =>
    z.object({
      audioBase64: z.string().min(10).max(20_000_000),
      mimeType: z.string().min(3).max(100),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio exactly as spoken. Return only the transcript, no commentary." },
              {
                type: "input_audio",
                input_audio: {
                  data: data.audioBase64,
                  format: data.mimeType.includes("webm") ? "webm" : data.mimeType.includes("mp3") ? "mp3" : "wav",
                },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Transcription failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { transcript: body.choices?.[0]?.message?.content?.trim() ?? "" };
  });

// ---- Polish transcript into structured email ----
export const polishToEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transcript: string }) =>
    z.object({ transcript: z.string().min(1).max(10_000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You convert a spoken voice memo into a polished email draft. Extract the recipient email if mentioned (otherwise leave empty), a concise subject, and a professional body. Return ONLY valid JSON matching the schema. No prose, no markdown fences.",
          },
          {
            role: "user",
            content: `Voice memo:\n"""${data.transcript}"""\n\nReturn JSON: { "to": string, "subject": string, "body": string }`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Polish failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = body.choices?.[0]?.message?.content ?? "{}";
    let parsed: { to?: string; subject?: string; body?: string };
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    return {
      to: parsed.to ?? "",
      subject: parsed.subject ?? "(no subject)",
      body: parsed.body ?? data.transcript,
    };
  });

// ---- Create Gmail draft via connector gateway ----
function base64url(input: string): string {
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(input, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(input)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function chunkBase64(b64: string, width = 76): string {
  const parts: string[] = [];
  for (let i = 0; i < b64.length; i += width) parts.push(b64.slice(i, i + width));
  return parts.join("\r\n");
}

export const createGmailDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string; subject: string; body: string; attachmentIds?: string[] }) =>
    z.object({
      to: z.string().max(500),
      subject: z.string().min(1).max(998),
      body: z.string().min(1).max(50_000),
      attachmentIds: z.array(z.string().uuid()).max(10).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured.");
    if (!gmailKey) throw new Error("Gmail connector is not linked.");

    // Load any attachments
    type Att = { filename: string; mime: string; b64: string };
    const attachments: Att[] = [];
    const ids = data.attachmentIds ?? [];
    if (ids.length > 0) {
      const { data: rows, error } = await supabase
        .from("images")
        .select("id, storage_path, mime_type")
        .in("id", ids)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      const list = (rows ?? []) as Array<{ id: string; storage_path: string; mime_type: string | null }>;
      for (const r of list) {
        const { data: file, error: dErr } = await supabase.storage.from("telegram-images").download(r.storage_path);
        if (dErr || !file) throw new Error(`Couldn't load attachment: ${dErr?.message ?? "unknown"}`);
        const buf = Buffer.from(await file.arrayBuffer());
        if (buf.byteLength > 20 * 1024 * 1024) throw new Error("Attachment over 20 MB");
        const filename = r.storage_path.split("/").pop() || `image-${r.id}.jpg`;
        attachments.push({ filename, mime: r.mime_type ?? "image/jpeg", b64: buf.toString("base64") });
      }
    }

    let raw: string;
    if (attachments.length === 0) {
      raw = [
        data.to ? `To: ${data.to}` : "",
        `Subject: ${data.subject}`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "",
        data.body,
      ].filter(Boolean).join("\r\n");
    } else {
      const boundary = `bnd_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      const lines: string[] = [];
      if (data.to) lines.push(`To: ${data.to}`);
      lines.push(`Subject: ${data.subject}`);
      lines.push("MIME-Version: 1.0");
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      lines.push("");
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push("Content-Transfer-Encoding: 7bit");
      lines.push("");
      lines.push(data.body);
      for (const a of attachments) {
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${a.mime}; name="${a.filename}"`);
        lines.push(`Content-Disposition: attachment; filename="${a.filename}"`);
        lines.push("Content-Transfer-Encoding: base64");
        lines.push("");
        lines.push(chunkBase64(a.b64));
      }
      lines.push(`--${boundary}--`);
      raw = lines.join("\r\n");
    }

    const rawB64 = Buffer.from(raw, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const res = await fetch(`${GATEWAY_BASE_URL}/google_mail/gmail/v1/users/me/drafts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmailKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: { raw: rawB64 } }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gmail draft failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const draft = (await res.json()) as { id?: string };

    await supabase.from("drafts_log").insert({
      user_id: userId,
      gmail_draft_id: draft.id ?? "unknown",
      recipient: data.to || null,
      subject: data.subject,
      body_preview: data.body.slice(0, 200),
    });

    return { draftId: draft.id ?? "", attachmentCount: attachments.length };
  });

// ---- List recent drafts ----
export const listRecentDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("drafts_log")
      .select("id, gmail_draft_id, recipient, subject, body_preview, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data;
  });

// ---- Get current profile ----
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { display_name: "Carl" };
  });

// ---- Update display name ----
export const updateDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName: string }) =>
    z.object({ displayName: z.string().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: data.displayName });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Look up past recipients from Gmail Sent folder ----
export const lookupRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) =>
    z.object({ query: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!lovableKey || !gmailKey) throw new Error("Gmail not connected.");

    const q = encodeURIComponent(`in:sent to:${data.query}`);
    const listRes = await fetch(
      `${GATEWAY_BASE_URL}/google_mail/gmail/v1/users/me/messages?maxResults=10&q=${q}`,
      { headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmailKey } },
    );
    if (!listRes.ok) throw new Error(`Search failed (${listRes.status})`);
    const list = (await listRes.json()) as { messages?: Array<{ id: string }> };
    const ids = (list.messages ?? []).slice(0, 10).map((m) => m.id);

    const seen = new Map<string, { name: string; email: string }>();
    for (const id of ids) {
      const mres = await fetch(
        `${GATEWAY_BASE_URL}/google_mail/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=To`,
        { headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmailKey } },
      );
      if (!mres.ok) continue;
      const msg = (await mres.json()) as { payload?: { headers?: Array<{ name: string; value: string }> } };
      const toHeader = msg.payload?.headers?.find((h) => h.name.toLowerCase() === "to")?.value ?? "";
      for (const part of toHeader.split(/,(?![^<]*>)/)) {
        const m = part.trim().match(/^(?:"?([^"<]*)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?$/);
        if (!m) continue;
        const email = m[2].toLowerCase();
        const name = (m[1] ?? "").trim();
        if (!seen.has(email)) seen.set(email, { email, name });
      }
    }

    const needle = data.query.toLowerCase();
    const ranked = [...seen.values()]
      .filter((r) => r.email.includes(needle) || r.name.toLowerCase().includes(needle))
      .slice(0, 5);
    return { matches: ranked };
  });
