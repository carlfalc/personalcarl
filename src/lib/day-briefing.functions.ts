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
        .eq("day", weekday),
      supabase
        .from("roster_training")
        .select("staff_name,day,start_time,end_time,training_text")
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

    // Fetch LIVE market quotes (Yahoo chart v8 endpoint — works without auth).
    // Falls back to the DB cache so we always show a last-known price.
    const liveMarkets = await fetchMarketQuotes(
      [
        { symbol: "RKLB", name: "Rocket Lab", displaySymbol: "RKLB" },
        { symbol: "SPCX", name: "SpaceX (SPCX)", displaySymbol: "SPCX" },
        { symbol: "GC=F", name: "Gold spot", displaySymbol: "XAUUSD" },
      ],
      supabase,
    );

    const contextSummary = {
      date: data.date,
      weekday,
      roster: roster.map((r) => `${r.name}${r.is_off ? " (OFF)" : ` ${r.start ?? ""}-${r.end ?? ""}`} [${r.roster_type}]`),
      training: training.map((t) => `${t.name} ${t.start ?? ""}-${t.end ?? ""}: ${t.training_text ?? ""}`),
      tasks: tasks.map((t) => `P${t.priority ?? "?"} ${t.content}`),
      meetings: meetings.map((m) => `${m.datetime} — ${m.title}${m.location ? ` @ ${m.location}` : ""}`),
      live_markets: liveMarkets,
    };

    const prompt = `Generate a daily briefing as strict JSON for ${data.date} (${weekday}).

Context (already in the app, do not duplicate verbatim — reference it in the AI summary):
${JSON.stringify(contextSummary, null, 2)}

The live_markets array above contains REAL last-traded prices fetched live from Yahoo Finance just now. Reference those numbers in the AI summary — do NOT invent prices from your training data.

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
  "horoscope": {
    "sagittarius": "2-3 sentence personalised daily horoscope for a Sagittarius male born 30 Nov 1972 in Whanganui NZ",
    "chinese_rat": "2-3 sentence Chinese zodiac daily for Rat (1972)"
  },
  "ai_summary": "3-5 sentence intelligent summary tying together the day's roster, tasks, meetings, weather and the real market moves. Be specific, not generic."
}

(Markets are filled server-side from live_markets — do NOT include a markets key.)`;

    let ai: Record<string, unknown> = {};
    try {
      ai = (await callLovableAi(prompt)) as Record<string, unknown>;
    } catch (err) {
      console.error("Day briefing AI failed:", err);
      ai = {
        weather: { summary: "Weather unavailable", high_c: null, low_c: null, precipitation: "—", wind: "—", location: "Whanganui, NZ" },
        horoscope: { sagittarius: "Horoscope unavailable.", chinese_rat: "Horoscope unavailable." },
        ai_summary: "AI summary unavailable right now.",
      };
    }

    // Build markets from LIVE data — never trust the LLM for prices.
    const markets: DayBriefing["markets"] = liveMarkets.map((m) => {
      const dir: "up" | "down" | "flat" =
        m.changePct > 0.05 ? "up" : m.changePct < -0.05 ? "down" : "flat";
      const priceStr = m.displaySymbol === "XAUUSD"
        ? `$${m.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/oz`
        : `$${m.price.toFixed(2)}`;
      const cachedNote = m.cached
        ? `last known · cached ${m.fetchedAt ? new Date(m.fetchedAt).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : ""}`
        : `${m.marketState ?? "last trade"} · prev close $${m.previousClose?.toFixed(2) ?? "—"}`;
      return {
        symbol: m.displaySymbol,
        name: m.name,
        price: m.price > 0 ? priceStr : "—",
        change_pct: m.price > 0 ? `${m.changePct >= 0 ? "+" : ""}${m.changePct.toFixed(2)}%` : "—",
        direction: dir,
        note: m.error ?? cachedNote,
      };
    });

    return {
      date: data.date,
      weekday,
      weather: (ai.weather as DayBriefing["weather"]) ?? {
        summary: "—", high_c: null, low_c: null, precipitation: "—", wind: "—", location: "Whanganui, NZ",
      },
      markets,
      horoscope: (ai.horoscope as DayBriefing["horoscope"]) ?? { sagittarius: "—", chinese_rat: "—" },
      ai_summary: typeof ai.ai_summary === "string" ? ai.ai_summary : "—",
      roster,
      training,
      tasks,
      meetings,
      generated_at: new Date().toISOString(),
    };
  });

// ---------- Live quote fetcher with DB cache fallback ----------
type MarketCacheRow = {
  symbol: string;
  display_symbol: string;
  name: string;
  price: number;
  previous_close: number | null;
  change_pct: number | null;
  market_state: string | null;
  fetched_at: string;
};

type MarketQuote = {
  symbol: string;
  displaySymbol: string;
  name: string;
  price: number;
  previousClose: number | null;
  changePct: number;
  marketState: string | null;
  cached?: boolean;
  fetchedAt?: string;
  error?: string;
};

async function fetchOneYahooChart(
  symbol: string,
): Promise<{ price: number; previousClose: number | null; changePct: number; marketState: string | null } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: Array<{ meta?: Record<string, unknown> }> };
    };
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = Number(meta.regularMarketPrice ?? 0);
    if (!price) return null;
    const prev = meta.chartPreviousClose != null ? Number(meta.chartPreviousClose) : null;
    const changePct = prev ? ((price - prev) / prev) * 100 : 0;
    return {
      price,
      previousClose: prev,
      changePct,
      marketState: (meta.marketState as string) ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchMarketQuotes(
  tickers: Array<{ symbol: string; name: string; displaySymbol: string }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<MarketQuote[]> {
  // Load cached rows first so we can fall back on any miss
  const cacheRes = await supabase
    .from("market_quotes_cache")
    .select("symbol,display_symbol,name,price,previous_close,change_pct,market_state,fetched_at")
    .in("symbol", tickers.map((t) => t.symbol));
  const cacheRows: MarketCacheRow[] = (cacheRes.data as MarketCacheRow[] | null) ?? [];
  const cacheMap = new Map<string, MarketCacheRow>(cacheRows.map((r) => [r.symbol, r]));

  const live = await Promise.all(tickers.map((t) => fetchOneYahooChart(t.symbol)));

  const toUpsert: MarketCacheRow[] = [];
  const out: MarketQuote[] = tickers.map((t, i) => {
    const q = live[i];
    if (q) {
      toUpsert.push({
        symbol: t.symbol,
        display_symbol: t.displaySymbol,
        name: t.name,
        price: q.price,
        previous_close: q.previousClose,
        change_pct: q.changePct,
        market_state: q.marketState,
        fetched_at: new Date().toISOString(),
      });
      return {
        symbol: t.symbol, displaySymbol: t.displaySymbol, name: t.name,
        price: q.price, previousClose: q.previousClose, changePct: q.changePct,
        marketState: q.marketState,
      };
    }
    const c = cacheMap.get(t.symbol);
    if (c && Number(c.price) > 0) {
      return {
        symbol: t.symbol,
        displaySymbol: t.displaySymbol,
        name: t.name,
        price: Number(c.price),
        previousClose: c.previous_close != null ? Number(c.previous_close) : null,
        changePct: c.change_pct != null ? Number(c.change_pct) : 0,
        marketState: c.market_state,
        cached: true,
        fetchedAt: c.fetched_at,
      };
    }
    return {
      symbol: t.symbol, displaySymbol: t.displaySymbol, name: t.name,
      price: 0, previousClose: null, changePct: 0, marketState: null,
      error: "Live quote unavailable and no cached price yet",
    };
  });

  if (toUpsert.length > 0) {
    // Write through service-role client so RLS doesn't block the insert
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("market_quotes_cache").upsert(toUpsert, { onConflict: "symbol" });
    } catch (err) {
      console.error("market cache upsert failed", err);
    }
  }

  return out;
}
