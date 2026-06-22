import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type DayBriefing = {
  date: string;
  weekday: string;
  weather: {
    summary: string;
    high_c: number | null;
    low_c: number | null;
    precipitation: string;
    wind: string;
    location: string;
  };
  markets: Array<{
    symbol: string;
    name: string;
    price: string;
    change_pct: string;
    direction: "up" | "down" | "flat";
    note: string;
  }>;
  horoscope: {
    sagittarius: string;
    chinese_rat: string;
  };
  ai_summary: string;
  roster: Array<{ name: string; day: string; start: string | null; end: string | null; roster_type: string; is_off: boolean }>;
  training: Array<{ name: string; start: string | null; end: string | null; training_text: string | null }>;
  tasks: Array<{ id: string; content: string; priority: number | null; status: string | null; tags: string[] | null }>;
  meetings: Array<{ id: string; title: string; datetime: string; location: string | null; notes: string | null }>;
  generated_at: string;
};

async function callLovableAi(prompt: string): Promise<unknown> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "raw-fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a daily-briefing data assistant. You MUST respond with valid JSON only — no markdown fences, no prose outside JSON. Use your best current knowledge for forecasts and approximate last-known market prices; clearly note approximations in the `note` field.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    // Strip code fences if model added them
    const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
    return JSON.parse(cleaned);
  }
}

export const getDayBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<DayBriefing> => {
    const { supabase, userId } = context;
    const dateObj = new Date(data.date + "T00:00:00");
    const weekday = DAY_NAMES[dateObj.getDay()];
    const dayStart = new Date(data.date + "T00:00:00").toISOString();
    const dayEnd = new Date(new Date(data.date + "T00:00:00").getTime() + 24 * 3600 * 1000).toISOString();

    const [rosterRes, trainingRes, tasksRes, meetingsRes] = await Promise.all([
      supabase
        .from("roster_staff")
        .select("staff_name,day,start_time,end_time,is_off,roster_type")
        .eq("user_id", userId)
        .eq("day", weekday),
      supabase
        .from("roster_training")
        .select("staff_name,day,start_time,end_time,training_text")
        .eq("user_id", userId)
        .eq("day", weekday),
      supabase
        .from("entries")
        .select("id,content,priority,status,tags,due_date,type")
        .eq("user_id", userId)
        .eq("type", "task")
        .or(`due_date.eq.${data.date},due_date.is.null`)
        .neq("status", "done")
        .neq("status", "deleted")
        .order("priority", { ascending: true, nullsFirst: false })
        .limit(50),
      supabase
        .from("meetings")
        .select("id,title,datetime,location,notes,status")
        .eq("user_id", userId)
        .gte("datetime", dayStart)
        .lt("datetime", dayEnd)
        .order("datetime", { ascending: true }),
    ]);

    const roster = (rosterRes.data ?? []).map((r) => ({
      name: r.staff_name,
      day: r.day,
      start: r.start_time,
      end: r.end_time,
      roster_type: r.roster_type ?? "main",
      is_off: !!r.is_off,
    }));
    const training = (trainingRes.data ?? []).map((r) => ({
      name: r.staff_name,
      start: r.start_time,
      end: r.end_time,
      training_text: r.training_text,
    }));
    const tasks = (tasksRes.data ?? [])
      .filter((t) => t.due_date === data.date || (t.priority ?? 99) <= 2)
      .map((t) => ({
        id: t.id,
        content: t.content,
        priority: t.priority,
        status: t.status,
        tags: t.tags,
      }));
    const meetings = (meetingsRes.data ?? [])
      .filter((m) => m.status !== "cancelled")
      .map((m) => ({
        id: m.id,
        title: m.title,
        datetime: m.datetime,
        location: m.location,
        notes: m.notes,
      }));

    const contextSummary = {
      date: data.date,
      weekday,
      roster: roster.map((r) => `${r.name}${r.is_off ? " (OFF)" : ` ${r.start ?? ""}-${r.end ?? ""}`} [${r.roster_type}]`),
      training: training.map((t) => `${t.name} ${t.start ?? ""}-${t.end ?? ""}: ${t.training_text ?? ""}`),
      tasks: tasks.map((t) => `P${t.priority ?? "?"} ${t.content}`),
      meetings: meetings.map((m) => `${m.datetime} — ${m.title}${m.location ? ` @ ${m.location}` : ""}`),
    };

    const prompt = `Generate a daily briefing as strict JSON for ${data.date} (${weekday}).

Context (already in the app, do not duplicate verbatim — reference it in the AI summary):
${JSON.stringify(contextSummary, null, 2)}

Required JSON shape — return EXACTLY these keys, nothing else:
{
  "weather": {
    "summary": "1 sentence forecast for Whanganui, New Zealand on this date (use seasonal/typical conditions if exact forecast unavailable; note 'typical' in summary if so)",
    "high_c": number,
    "low_c": number,
    "precipitation": "e.g. '20% chance light showers'",
    "wind": "e.g. 'WSW 15 km/h'",
    "location": "Whanganui, NZ"
  },
  "markets": [
    {"symbol":"RKLB","name":"Rocket Lab","price":"$XX.XX","change_pct":"+X.X%","direction":"up|down|flat","note":"closing/last known price; flag if approximate"},
    {"symbol":"SPCE-PROXY","name":"SpaceX (proxy via DXYZ Destiny Tech100 or recent SPCX listing if applicable)","price":"$XX.XX","change_pct":"+X.X%","direction":"up|down|flat","note":"explain which proxy used; SpaceX direct listing if you know it"},
    {"symbol":"XAUUSD","name":"Gold spot","price":"$X,XXX.XX/oz","change_pct":"+X.X%","direction":"up|down|flat","note":"last known spot"}
  ],
  "horoscope": {
    "sagittarius": "2-3 sentence personalised daily horoscope for a Sagittarius male born 30 Nov 1972 in Whanganui NZ",
    "chinese_rat": "2-3 sentence Chinese zodiac daily for Rat (1972)"
  },
  "ai_summary": "3-5 sentence intelligent summary tying together the day's roster, tasks, meetings, weather and any notable market/horoscope cues. Be specific, not generic."
}`;

    let ai: Record<string, unknown> = {};
    try {
      ai = (await callLovableAi(prompt)) as Record<string, unknown>;
    } catch (err) {
      console.error("Day briefing AI failed:", err);
      ai = {
        weather: { summary: "Weather unavailable", high_c: null, low_c: null, precipitation: "—", wind: "—", location: "Whanganui, NZ" },
        markets: [],
        horoscope: { sagittarius: "Horoscope unavailable.", chinese_rat: "Horoscope unavailable." },
        ai_summary: "AI summary unavailable right now.",
      };
    }

    return {
      date: data.date,
      weekday,
      weather: (ai.weather as DayBriefing["weather"]) ?? {
        summary: "—", high_c: null, low_c: null, precipitation: "—", wind: "—", location: "Whanganui, NZ",
      },
      markets: Array.isArray(ai.markets) ? (ai.markets as DayBriefing["markets"]) : [],
      horoscope: (ai.horoscope as DayBriefing["horoscope"]) ?? { sagittarius: "—", chinese_rat: "—" },
      ai_summary: typeof ai.ai_summary === "string" ? ai.ai_summary : "—",
      roster,
      training,
      tasks,
      meetings,
      generated_at: new Date().toISOString(),
    };
  });
