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
  .inputValidator((input: { accommodation: string; city?: string; country?: string; query: string; category?: string }) =>
    z.object({
      accommodation: z.string().min(1).max(500),
      city: z.string().max(200).optional(),
      country: z.string().max(200).optional(),
      query: z.string().min(1).max(1000),
      category: z.string().max(60).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const locationLine = [data.accommodation, data.city, data.country].filter(Boolean).join(", ");
    const focus = data.category && data.category !== "all" ? `Focus on ${data.category}. ` : "";
    const body = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a local travel concierge. Given an accommodation address and a user request, suggest specific real places nearby. Return ONLY valid JSON with shape: {\"places\":[{\"name\":string,\"category\":string,\"address\":string,\"distance\":string,\"distance_meters\":number,\"why\":string}]}. Category MUST be one of: restaurants, bars, shopping, events, coffee, other. Include 6-12 places, sorted closest first. `distance` is a human string like '350 m' or '1.2 km'; `distance_meters` is the same value expressed as an integer number of meters (rough walking distance from the accommodation). No commentary outside JSON.",
        },
        {
          role: "user",
          content: `Accommodation: ${locationLine}\n\n${focus}Request: ${data.query}`,
        },
      ],
    });
    const raw = body.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(raw) as {
      places?: Array<{ name: string; category: string; address: string; distance: string; distance_meters?: number; why: string }>;
    } | null;
    const places = (parsed?.places ?? []).map((p) => ({
      name: p.name,
      category: (p.category || "other").toLowerCase(),
      address: p.address,
      distance: p.distance,
      distance_meters: typeof p.distance_meters === "number" ? p.distance_meters : parseDistanceMeters(p.distance),
      why: p.why,
    }));
    places.sort((a, b) => (a.distance_meters ?? 9e9) - (b.distance_meters ?? 9e9));
    return { places };
  });

function parseDistanceMeters(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/([\d.]+)\s*(km|m)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  return m[2].toLowerCase() === "km" ? Math.round(n * 1000) : Math.round(n);
}

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
