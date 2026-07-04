import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callGateway(body: unknown) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI request failed (${res.status}): ${t.slice(0, 500)}`);
  }
  return (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
}

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

function guessMime(pathOrName: string): string {
  const lower = pathOrName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

export type BloodReport = {
  patient: { name: string; dob: string | null; date: string; time: string };
  overview: Array<{ severity: "very_bad" | "bad" | "neutral" | "good" | "very_good"; text: string }>;
  results: Array<{
    marker: string;
    value: string;
    unit: string;
    range: string;
    direction: "up" | "down" | "ok";
    status: "normal" | "abnormal";
    note: string;
  }>;
  questions: string[];
  disclaimer: string;
};

// ---------- Profile ----------

export const getMedicalProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("medical_profile")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const saveMedicalProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    doctor_name?: string | null;
    clinic_name?: string | null;
    clinic_address?: string | null;
    doctor_phone?: string | null;
    clinic_phone?: string | null;
    email?: string | null;
    website?: string | null;
    checkup_frequency_months?: number | null;
    last_visit_date?: string | null;
    notes?: string | null;
  }) =>
    z.object({
      doctor_name: z.string().max(200).nullable().optional(),
      clinic_name: z.string().max(200).nullable().optional(),
      clinic_address: z.string().max(500).nullable().optional(),
      doctor_phone: z.string().max(60).nullable().optional(),
      clinic_phone: z.string().max(60).nullable().optional(),
      email: z.string().max(200).nullable().optional(),
      website: z.string().max(300).nullable().optional(),
      checkup_frequency_months: z.number().int().min(1).max(24).nullable().optional(),
      last_visit_date: z.string().nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId };
    const { data: row, error } = await context.supabase
      .from("medical_profile")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const markCheckupDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await context.supabase
      .from("medical_profile")
      .update({ last_visit_date: today })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true, date: today };
  });

// ---------- Prescriptions ----------

export const listPrescriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("medical_prescriptions")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const savePrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    name: string;
    dosage_amount?: number | null;
    dosage_unit?: string | null;
    frequency?: string | null;
    notes?: string | null;
  }) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(200),
      dosage_amount: z.number().nullable().optional(),
      dosage_unit: z.string().max(20).nullable().optional(),
      frequency: z.string().max(100).nullable().optional(),
      notes: z.string().max(1000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("medical_prescriptions")
        .update({
          name: data.name,
          dosage_amount: data.dosage_amount ?? null,
          dosage_unit: data.dosage_unit ?? null,
          frequency: data.frequency ?? null,
          notes: data.notes ?? null,
        })
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("medical_prescriptions")
      .insert({
        user_id: context.userId,
        name: data.name,
        dosage_amount: data.dosage_amount ?? null,
        dosage_unit: data.dosage_unit ?? null,
        frequency: data.frequency ?? null,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deletePrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("medical_prescriptions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Blood reports ----------

export const listBloodReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("medical_blood_reports")
      .select("*")
      .eq("user_id", context.userId)
      .order("reported_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const saveBloodReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    title?: string | null;
    source_paths: string[];
    ai_report: unknown;
  }) =>
    z.object({
      title: z.string().max(200).nullable().optional(),
      source_paths: z.array(z.string()).max(20),
      ai_report: z.unknown(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("medical_blood_reports")
      .insert({
        user_id: context.userId,
        title: data.title ?? null,
        source_paths: data.source_paths,
        ai_report: data.ai_report as any,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteBloodReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("medical_blood_reports")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- AI analysis ----------

export const analyzeBloodResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    paths: string[];
    userName?: string | null;
    dob?: string | null;
  }) =>
    z.object({
      paths: z.array(z.string().min(1)).min(1).max(12),
      userName: z.string().max(200).nullable().optional(),
      dob: z.string().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Download each file via the authenticated user's client (owner RLS)
    const contentBlocks: Array<Record<string, unknown>> = [];

    for (const path of data.paths) {
      const { data: blob, error } = await context.supabase.storage
        .from("medical-uploads")
        .download(path);
      if (error || !blob) throw new Error(`Cannot read upload: ${path}`);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
      const b64 = btoa(binary);
      const mime = blob.type || guessMime(path);
      const filename = path.split("/").pop() ?? "upload";

      if (mime === "application/pdf") {
        contentBlocks.push({
          type: "file",
          file: { filename, file_data: `data:${mime};base64,${b64}` },
        });
      } else {
        contentBlocks.push({
          type: "image_url",
          image_url: { url: `data:${mime};base64,${b64}` },
        });
      }
    }

    const nowIso = new Date().toISOString();
    const patientLine = `Patient: ${data.userName ?? "the user"}${data.dob ? ` (DOB ${data.dob})` : ""}. Report generated ${nowIso}.`;

    const systemPrompt = `You are a clinical laboratory results summarizer producing an EDUCATIONAL research overview. You are NOT providing medical advice, diagnosis, or treatment. Always include a clear disclaimer that this is research information only and the user should discuss all results with their own physician.

You will receive one or more images or PDFs of blood test results. Extract every reported marker. Return ONLY valid JSON matching this exact schema, no prose outside JSON:

{
  "overview": [ { "severity": "very_bad" | "bad" | "neutral" | "good" | "very_good", "text": string } ],
  "results": [ {
    "marker": string,
    "value": string,
    "unit": string,
    "range": string,
    "direction": "up" | "down" | "ok",
    "status": "normal" | "abnormal",
    "note": string
  } ],
  "questions": string[],
  "disclaimer": string
}

Rules:
- "overview" is 3-6 plain-English bullets summarising the overall picture, each tagged with a severity.
- "results" lists EVERY marker seen on the report(s). "direction" is "up" if value is above the reference range, "down" if below, "ok" if inside range. "status" is "abnormal" for any out-of-range marker, otherwise "normal". "note" is a short educational explanation of what the marker measures and what an abnormal value can indicate.
- "questions" MUST include specific, targeted follow-up questions the user should ask their physician, especially for any markers that could suggest organ concerns (e.g. elevated ALT/AST/GGT → liver, elevated creatinine/eGFR abnormalities → kidney, abnormal TSH → thyroid, high LDL / low HDL → cardiovascular). Include questions about lifestyle, further testing, and interpretation in context.
- "disclaimer" is a standard note that this overview is for educational purposes only and is not medical advice; always consult your own physician.
- If the images are unclear or contain no lab results, return an empty results array and put a helpful message in overview.`;

    const body = await callGateway({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: `${patientLine}\n\nPlease analyse the attached blood test result(s) and return the JSON overview.` },
            ...contentBlocks,
          ],
        },
      ],
    });

    const raw = body.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(raw) as Partial<BloodReport> | null;
    if (!parsed) throw new Error("The AI response could not be parsed.");

    const report: BloodReport = {
      patient: {
        name: data.userName ?? "",
        dob: data.dob ?? null,
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toTimeString().slice(0, 5),
      },
      overview: Array.isArray(parsed.overview) ? parsed.overview.slice(0, 12) : [],
      results: Array.isArray(parsed.results) ? parsed.results.slice(0, 200) : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 20) : [],
      disclaimer:
        typeof parsed.disclaimer === "string" && parsed.disclaimer.length > 0
          ? parsed.disclaimer
          : "This overview is provided for educational and research purposes only and is not medical advice. Please discuss all results with your own physician.",
    };
    return report;
  });
