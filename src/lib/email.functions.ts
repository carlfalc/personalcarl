import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authorizeAppUserOAuth, callAsAppUser } from "@/integrations/lovable/appUserConnector";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

// ---- Start Gmail OAuth (per-user) ----
export const startGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetOrigin: string; returnUrl: string }) =>
    z.object({
      targetOrigin: z.string().url(),
      returnUrl: z.string().url(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const clientId = process.env.GOOGLE_APP_USER_CONNECTOR_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        "Gmail isn't set up yet. Ask the app builder to add the GOOGLE_APP_USER_CONNECTOR_CLIENT_ID secret.",
      );
    }
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: "google",
      appUserId: context.userId,
      connectorClientId: clientId,
      returnUrl: data.returnUrl,
      responseMode: "web_message",
      webMessageTargetOrigin: data.targetOrigin,
      credentialsConfiguration: {
        scopes: [
          "https://www.googleapis.com/auth/gmail.compose",
          "https://www.googleapis.com/auth/userinfo.email",
        ],
      },
    });
    return { authorizationUrl };
  });

// ---- Persist connection_id on profile ----
export const saveGmailConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { connectionId: string }) =>
    z.object({ connectionId: z.string().min(1).max(255) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Try to look up email from Gmail profile.
    let email: string | null = null;
    try {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionId: data.connectionId,
        connectorId: "google_mail",
        path: "/gmail/v1/users/me/profile",
      });
      if (res.ok) {
        const profile = (await res.json()) as { emailAddress?: string };
        email = profile.emailAddress ?? null;
      }
    } catch {
      // Non-fatal; we'll still save the connection.
    }

    const { error } = await supabase
      .from("profiles")
      .update({ gmail_connection_id: data.connectionId, gmail_email: email })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, email };
  });

// ---- Disconnect Gmail ----
export const disconnectGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ gmail_connection_id: null, gmail_email: null })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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

    // Use Gemini Flash multimodal for transcription via chat completions
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio exactly as spoken. Return only the transcript, no commentary." },
              {
                type: "input_audio",
                input_audio: { data: data.audioBase64, format: data.mimeType.includes("webm") ? "webm" : data.mimeType.includes("mp3") ? "mp3" : "wav" },
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
    const transcript = body.choices?.[0]?.message?.content?.trim() ?? "";
    return { transcript };
  });

// ---- Polish transcript into structured email via Lovable AI ----
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
      headers: {
        "Lovable-API-Key": apiKey,
        "Content-Type": "application/json",
      },
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
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
    return {
      to: parsed.to ?? "",
      subject: parsed.subject ?? "(no subject)",
      body: parsed.body ?? data.transcript,
    };
  });

// ---- Create Gmail draft ----
function base64url(input: string): string {
  // RFC 2822 message → base64url
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(input, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(input)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const createGmailDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string; subject: string; body: string }) =>
    z.object({
      to: z.string().max(500),
      subject: z.string().min(1).max(998),
      body: z.string().min(1).max(50_000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("gmail_connection_id")
      .eq("id", userId)
      .single();
    if (profileErr) throw new Error(profileErr.message);
    const connectionId = profile?.gmail_connection_id;
    if (!connectionId) throw new Error("Gmail isn't connected. Click Connect Gmail first.");

    const rfc2822 = [
      data.to ? `To: ${data.to}` : "",
      `Subject: ${data.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      data.body,
    ]
      .filter(Boolean)
      .join("\r\n");

    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionId,
      connectorId: "google_mail",
      path: "/gmail/v1/users/me/drafts",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: { raw: base64url(rfc2822) } }),
      },
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

    return { draftId: draft.id ?? "" };
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

// ---- Get current profile (display name + gmail status) ----
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, gmail_connection_id, gmail_email")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { display_name: "Carl", gmail_connection_id: null, gmail_email: null };
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
