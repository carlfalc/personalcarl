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
    throw new Error(`AI request failed (${res.status}): ${t.slice(0, 300)}`);
  }
  return (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
}

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

// Nearby places around an accommodation address
export const nearbyPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accommodation: string; city?: string; country?: string; query: string }) =>
    z.object({
      accommodation: z.string().min(1).max(500),
      city: z.string().max(200).optional(),
      country: z.string().max(200).optional(),
      query: z.string().min(1).max(1000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const locationLine = [data.accommodation, data.city, data.country].filter(Boolean).join(", ");
    const body = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a local travel concierge. Given an accommodation address and a user request, suggest specific real places nearby. Return ONLY valid JSON with shape: {\"places\":[{\"name\":string,\"category\":string,\"address\":string,\"distance\":string,\"why\":string}]}. Include 5-10 places. Distances should be like '350 m' or '1.2 km' — rough walking distance from the accommodation. No commentary outside JSON.",
        },
        {
          role: "user",
          content: `Accommodation: ${locationLine}\n\nRequest: ${data.query}`,
        },
      ],
    });
    const raw = body.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(raw) as { places?: Array<{ name: string; category: string; address: string; distance: string; why: string }> } | null;
    return { places: parsed?.places ?? [] };
  });

// Airport/station info summary
export const stationInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: "airport" | "train" | "bus"; name: string }) =>
    z.object({
      kind: z.enum(["airport", "train", "bus"]),
      name: z.string().min(1).max(300),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const label = data.kind === "airport" ? "airport" : data.kind === "train" ? "train station" : "bus station/terminal";
    const body = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a travel information assistant. Given a station/airport name, return ONLY valid JSON: {\"summary\":string,\"lounges\":[string],\"parking\":[string],\"transit\":[string],\"tips\":[string]}. Keep each item short. If unknown, use empty arrays.",
        },
        { role: "user", content: `Provide info for this ${label}: ${data.name}` },
      ],
    });
    const raw = body.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(raw) as {
      summary?: string; lounges?: string[]; parking?: string[]; transit?: string[]; tips?: string[];
    } | null;
    return {
      summary: parsed?.summary ?? "",
      lounges: parsed?.lounges ?? [],
      parking: parsed?.parking ?? [],
      transit: parsed?.transit ?? [],
      tips: parsed?.tips ?? [],
    };
  });
