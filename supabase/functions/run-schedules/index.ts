// Edge function: run-schedules
// Triggered by pg_cron every 15 minutes.
// Evaluates due schedules in Pacific/Auckland tz, runs Anthropic web_search,
// pushes results to Telegram, and sends daily birthday reminders.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TZ = "Pacific/Auckland";

type Schedule = {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  frequency: "once" | "hourly" | "daily" | "weekly";
  time_of_day: string | null;
  day_of_week: number | null;
  enabled: boolean;
  last_run: string | null;
  created_at: string;
};

function nowInAuckland(): { date: Date; hour: number; minute: number; dow: number; ymd: string; hm: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const hour = parseInt(parts.hour, 10);
  const minute = parseInt(parts.minute, 10);
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: new Date(),
    hour, minute,
    dow: dowMap[parts.weekday] ?? 0,
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    hm: `${parts.hour}:${parts.minute}`,
  };
}

function lastRunYmdInAuckland(iso: string | null): string | null {
  if (!iso) return null;
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function lastRunHourInAuckland(iso: string | null): string | null {
  if (!iso) return null;
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;
}

// Schedule time is HH:MM:SS — check if current Auckland time is at-or-past it (within last 30 min window)
function isAtOrPastTime(scheduleTime: string, now: { hour: number; minute: number }): boolean {
  const [sh, sm] = scheduleTime.split(":").map((n) => parseInt(n, 10));
  const sMin = sh * 60 + sm;
  const nMin = now.hour * 60 + now.minute;
  return nMin >= sMin;
}

function isDue(s: Schedule, now: ReturnType<typeof nowInAuckland>): boolean {
  if (!s.enabled) return false;
  const lastYmd = lastRunYmdInAuckland(s.last_run);
  const lastHour = lastRunHourInAuckland(s.last_run);
  const curHour = `${now.ymd}T${String(now.hour).padStart(2, "0")}`;

  if (s.frequency === "hourly") {
    return lastHour !== curHour;
  }
  if (s.frequency === "daily") {
    if (!s.time_of_day) return false;
    if (lastYmd === now.ymd) return false;
    return isAtOrPastTime(s.time_of_day, now);
  }
  if (s.frequency === "weekly") {
    if (!s.time_of_day || s.day_of_week === null) return false;
    if (s.day_of_week !== now.dow) return false;
    if (lastYmd === now.ymd) return false;
    return isAtOrPastTime(s.time_of_day, now);
  }
  if (s.frequency === "once") {
    if (s.last_run) return false;
    if (!s.time_of_day) return true;
    return isAtOrPastTime(s.time_of_day, now);
  }
  return false;
}

async function db(path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      ...(init.headers ?? {}),
    },
  });
}

async function callAnthropic(prompt: string): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Anthropic ${r.status}: ${t}`);
  }
  const data = await r.json();
  const blocks = Array.isArray(data?.content) ? data.content : [];
  return blocks.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n\n").trim()
    || "(no text returned)";
}

async function sendTelegram(chatId: string, text: string): Promise<void> {
  // Telegram limit: 4096 chars
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 3800) chunks.push(text.slice(i, i + 3800));
  for (const chunk of chunks) {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
    if (!r.ok) {
      console.error("Telegram send failed", r.status, await r.text());
    }
  }
}

async function getOwnerChatId(): Promise<string | null> {
  const r = await db("profiles?select=telegram_chat_id&order=created_at.asc&limit=1");
  if (!r.ok) return null;
  const rows = await r.json();
  return rows?.[0]?.telegram_chat_id ?? null;
}

type OwnerProfile = {
  id: string;
  telegram_chat_id: string | null;
  briefing_enabled: boolean;
  briefing_time: string | null;
  last_briefing_sent: string | null;
  nudge_enabled: boolean;
  nudge_time: string | null;
  last_nudge_sent: string | null;
  weekly_review_enabled: boolean;
  weekly_review_day: number | null;
  weekly_review_time: string | null;
  last_weekly_review_sent: string | null;
  grocery_send_enabled: boolean;
  grocery_send_day: number | null;
  grocery_send_time: string | null;
  last_grocery_sent: string | null;
  diary_summary_enabled: boolean;
  last_diary_summary: string | null;
};

async function getOwnerProfile(): Promise<OwnerProfile | null> {
  const r = await db("profiles?select=id,telegram_chat_id,briefing_enabled,briefing_time,last_briefing_sent,nudge_enabled,nudge_time,last_nudge_sent,weekly_review_enabled,weekly_review_day,weekly_review_time,last_weekly_review_sent,grocery_send_enabled,grocery_send_day,grocery_send_time,last_grocery_sent,diary_summary_enabled,last_diary_summary&order=created_at.asc&limit=1");
  if (!r.ok) return null;
  const rows = await r.json();
  return rows?.[0] ?? null;
}

function aklDateString(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

async function fetchWeather(): Promise<{ tmax: number; tmin: number; precipPct: number; code: number } | null> {
  try {
    const r = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=-39.93&longitude=175.05&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Pacific%2FAuckland",
    );
    if (!r.ok) return null;
    const data = await r.json();
    const d = data?.daily;
    if (!d) return null;
    return {
      tmax: d.temperature_2m_max?.[0],
      tmin: d.temperature_2m_min?.[0],
      precipPct: d.precipitation_probability_max?.[0] ?? 0,
      code: d.weather_code?.[0] ?? 0,
    };
  } catch (e) {
    console.error("weather fetch failed", e);
    return null;
  }
}

async function callClaudeBriefing(userJson: string): Promise<string> {
  const system = "Write Carl's morning briefing for Telegram. Plain text, no markdown headers. Friendly but brief. Structure: a one-line greeting with the date and weather (max/min temp, rain chance in plain words), then '📅 Today:' with meetings (times in NZ format), then '✅ Tasks:' with due/overdue tasks (flag overdue ones), then '🎂' birthdays if any. If a section is empty, skip it. If everything is empty, say it's a clear day. End with one short encouraging line.";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: userJson }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic briefing ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const blocks = Array.isArray(data?.content) ? data.content : [];
  return blocks.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n\n").trim();
}

async function runMorningBriefing(owner: OwnerProfile, now: ReturnType<typeof nowInAuckland>): Promise<void> {
  if (!owner.briefing_enabled || !owner.telegram_chat_id || !owner.briefing_time) return;
  const todayYmd = now.ymd;
  const lastYmd = owner.last_briefing_sent ? aklDateString(new Date(owner.last_briefing_sent)) : null;
  if (lastYmd === todayYmd) return;
  if (!isAtOrPastTime(owner.briefing_time, now)) return;

  // Today's meetings
  const dayStartUtc = new Date(`${todayYmd}T00:00:00+13:00`).toISOString();
  const dayEndUtc = new Date(`${todayYmd}T23:59:59+13:00`).toISOString();
  const meetingsRes = await db(
    `meetings?select=title,datetime,location,notes&user_id=eq.${owner.id}&datetime=gte.${dayStartUtc}&datetime=lte.${dayEndUtc}&order=datetime.asc`,
  );
  const meetings = meetingsRes.ok ? await meetingsRes.json() : [];

  // Tasks due today or overdue
  const tasksRes = await db(
    `entries?select=content,priority,status,due_date,type&user_id=eq.${owner.id}&due_date=lte.${todayYmd}&status=neq.done&order=priority.asc,due_date.asc`,
  );
  const tasks = tasksRes.ok ? await tasksRes.json() : [];

  // Birthdays today + next 7 days
  const bdRes = await db(`birthdays?select=name,birth_date,notes&user_id=eq.${owner.id}`);
  const allBdays = bdRes.ok ? (await bdRes.json() as Array<{ name: string; birth_date: string; notes: string | null }>) : [];
  const upcomingBdays: Array<{ name: string; birth_date: string; days_away: number }> = [];
  const today = new Date(`${todayYmd}T00:00:00`);
  for (const b of allBdays) {
    const [, mm, dd] = b.birth_date.split("-");
    for (let i = 0; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const tm = String(d.getMonth() + 1).padStart(2, "0");
      const td = String(d.getDate()).padStart(2, "0");
      if (tm === mm && td === dd) {
        upcomingBdays.push({ name: b.name, birth_date: b.birth_date, days_away: i });
        break;
      }
    }
  }

  const weather = await fetchWeather();

  const payload = {
    date_nz: new Date().toLocaleDateString("en-NZ", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }),
    weather,
    meetings,
    tasks,
    birthdays: upcomingBdays,
  };

  const text = await callClaudeBriefing(JSON.stringify(payload));
  if (text) await sendTelegram(owner.telegram_chat_id, text);

  await db(`profiles?id=eq.${owner.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_briefing_sent: new Date().toISOString() }),
  });
}

async function runEveningNudge(owner: OwnerProfile, now: ReturnType<typeof nowInAuckland>): Promise<void> {
  if (!owner.nudge_enabled || !owner.telegram_chat_id || !owner.nudge_time) return;
  const todayYmd = now.ymd;
  const lastYmd = owner.last_nudge_sent ? aklDateString(new Date(owner.last_nudge_sent)) : null;
  if (lastYmd === todayYmd) return;
  if (!isAtOrPastTime(owner.nudge_time, now)) return;

  // Open tasks/todos due today or overdue
  const tasksRes = await db(
    `entries?select=id,content,priority,status,due_date,type&user_id=eq.${owner.id}&type=in.(task,todo)&due_date=lte.${todayYmd}&status=neq.done&order=due_date.asc,priority.asc`,
  );
  const tasks = tasksRes.ok ? await tasksRes.json() as Array<{ content: string; due_date: string | null }> : [];

  if (tasks.length === 0) {
    // Still mark as sent so we don't keep checking every 15 min
    await db(`profiles?id=eq.${owner.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_nudge_sent: new Date().toISOString() }),
    });
    return;
  }

  const lines = tasks.map((t) => {
    const overdue = t.due_date && t.due_date < todayYmd;
    return `• ${overdue ? "⚠️ OVERDUE — " : ""}${t.content}`;
  }).join("\n");
  const msg = `🌆 Still open today:\n${lines}\n\nReply "done with ..." to tick any off.`;
  await sendTelegram(owner.telegram_chat_id, msg);

  await db(`profiles?id=eq.${owner.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_nudge_sent: new Date().toISOString() }),
  });
}

async function callClaudeWeeklyReview(userJson: string): Promise<string> {
  const system = "Write Carl's weekly review for Telegram. Plain text, warm but efficient, no markdown headers. Sections: '🏁 Wins' (completed items, summarised), '⏳ Carried over' (open/overdue), '📓 Week in brief' (2-3 sentence synthesis of the diary entries — themes, not a list), '📅 Week ahead' (upcoming meetings), '🧠 Learned about you' (new memory facts, if any). Skip empty sections. End with one short reflective question for the week ahead.";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: userJson }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic weekly review ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const blocks = Array.isArray(data?.content) ? data.content : [];
  return blocks.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n\n").trim();
}

async function runWeeklyReview(owner: OwnerProfile, now: ReturnType<typeof nowInAuckland>): Promise<void> {
  if (!owner.weekly_review_enabled || !owner.telegram_chat_id || owner.weekly_review_day === null || !owner.weekly_review_time) return;
  if (owner.weekly_review_day !== now.dow) return;
  const todayYmd = now.ymd;
  const lastYmd = owner.last_weekly_review_sent ? aklDateString(new Date(owner.last_weekly_review_sent)) : null;
  if (lastYmd === todayYmd) return;
  if (!isAtOrPastTime(owner.weekly_review_time, now)) return;

  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekAheadIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const [doneRes, openRes, diaryRes, pastMeetingsRes, futureMeetingsRes, memoryRes] = await Promise.all([
    db(`entries?select=content,type,priority,due_date,updated_at&user_id=eq.${owner.id}&type=in.(task,todo)&status=eq.done&updated_at=gte.${weekAgoIso}&order=updated_at.desc`),
    db(`entries?select=content,type,priority,due_date&user_id=eq.${owner.id}&type=in.(task,todo)&status=neq.done&due_date=lte.${todayYmd}&order=due_date.asc`),
    db(`entries?select=content,created_at,tags&user_id=eq.${owner.id}&type=eq.diary&created_at=gte.${weekAgoIso}&order=created_at.asc`),
    db(`meetings?select=title,datetime,location,notes&user_id=eq.${owner.id}&datetime=gte.${weekAgoIso}&datetime=lt.${nowIso}&order=datetime.asc`),
    db(`meetings?select=title,datetime,location,notes&user_id=eq.${owner.id}&datetime=gte.${nowIso}&datetime=lte.${weekAheadIso}&order=datetime.asc`),
    db(`memory?select=fact,category,created_at&user_id=eq.${owner.id}&created_at=gte.${weekAgoIso}&order=created_at.desc`),
  ]);

  const payload = {
    date_nz: new Date().toLocaleDateString("en-NZ", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }),
    completed: doneRes.ok ? await doneRes.json() : [],
    open_or_overdue: openRes.ok ? await openRes.json() : [],
    diary_entries: diaryRes.ok ? await diaryRes.json() : [],
    past_meetings: pastMeetingsRes.ok ? await pastMeetingsRes.json() : [],
    upcoming_meetings: futureMeetingsRes.ok ? await futureMeetingsRes.json() : [],
    new_memory: memoryRes.ok ? await memoryRes.json() : [],
  };

  const text = await callClaudeWeeklyReview(JSON.stringify(payload));
  if (text) await sendTelegram(owner.telegram_chat_id, text);

  await db(`profiles?id=eq.${owner.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_weekly_review_sent: new Date().toISOString() }),
  });
}

async function runGrocerySend(owner: OwnerProfile, now: ReturnType<typeof nowInAuckland>): Promise<void> {
  if (!owner.grocery_send_enabled || !owner.telegram_chat_id || !owner.grocery_send_time) return;
  // null day means every day; otherwise must match Auckland day-of-week
  if (owner.grocery_send_day !== null && owner.grocery_send_day !== now.dow) return;
  const todayYmd = now.ymd;
  const lastYmd = owner.last_grocery_sent ? aklDateString(new Date(owner.last_grocery_sent)) : null;
  if (lastYmd === todayYmd) return;
  if (!isAtOrPastTime(owner.grocery_send_time, now)) return;

  const r = await db(
    `grocery_items?select=item,quantity&user_id=eq.${owner.id}&checked=eq.false&order=created_at.asc`,
  );
  const items = r.ok ? await r.json() as Array<{ item: string; quantity: string | null }> : [];

  if (items.length === 0) {
    // Still mark sent so we don't keep evaluating every 15 minutes
    await db(`profiles?id=eq.${owner.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_grocery_sent: new Date().toISOString() }),
    });
    return;
  }

  const lines = items.map((i) => `• ${i.quantity ? `${i.quantity} ${i.item}` : i.item}`).join("\n");
  await sendTelegram(owner.telegram_chat_id, `🛒 Grocery list:\n${lines}`);

  await db(`profiles?id=eq.${owner.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_grocery_sent: new Date().toISOString() }),
  });
}

async function callClaudeDiarySummary(diaryJson: string): Promise<string> {
  const system =
    "You are summarising Carl's diary entries from today into one tidy, warm paragraph (3-5 sentences) that captures the shape of the day: themes, mood, key moments. Plain text, no bullet points, no markdown. Do not add a heading.";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: diaryJson }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic diary-summary ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const blocks = Array.isArray(data?.content) ? data.content : [];
  return blocks.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n\n").trim();
}

async function runDailySummary(owner: OwnerProfile, now: ReturnType<typeof nowInAuckland>): Promise<void> {
  if (!owner.diary_summary_enabled) return;
  const todayYmd = now.ymd;
  const lastYmd = owner.last_diary_summary ? aklDateString(new Date(owner.last_diary_summary)) : null;
  if (lastYmd === todayYmd) return;
  // Due once per day at 21:30 NZ
  if (!isAtOrPastTime("21:30", now)) return;

  const dayStartUtc = new Date(`${todayYmd}T00:00:00+13:00`).toISOString();
  const dayEndUtc = new Date(`${todayYmd}T23:59:59+13:00`).toISOString();

  const r = await db(
    `entries?select=content,created_at,tags&user_id=eq.${owner.id}&type=eq.diary&created_at=gte.${dayStartUtc}&created_at=lte.${dayEndUtc}&order=created_at.asc`,
  );
  if (!r.ok) return;
  const rows = await r.json() as Array<{ content: string; created_at: string; tags: string[] | null }>;
  // Exclude prior auto-summaries
  const real = rows.filter((e) => !(e.tags ?? []).includes("daily-summary"));
  if (real.length < 2) return;

  const text = await callClaudeDiarySummary(JSON.stringify({ date: todayYmd, entries: real.map((e) => e.content) }));
  if (!text) return;

  await db("entries", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      type: "diary",
      content: `📝 Day summary: ${text}`,
      tags: ["daily-summary"],
      priority: 3,
      status: "logged",
      user_id: owner.id,
    }),
  });

  await db(`profiles?id=eq.${owner.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_diary_summary: new Date().toISOString() }),
  });
}

async function runBirthdayCheck(chatId: string, now: ReturnType<typeof nowInAuckland>): Promise<void> {
  // Run once per day, around 8am local. We use a marker row in a dedicated lightweight approach:
  // store the last birthday-check date in a schedules-like marker by abusing schedule's last_run? Simpler:
  // just use the most recent birthday-check log via entries table is overkill — track in memory of cron.
  // Easiest: only send when local hour >= 8 and we haven't sent today (tracked via entries diary).
  if (now.hour < 8) return;

  // Check if we already logged today
  const since = `${now.ymd}T00:00:00`;
  const check = await db(
    `entries?select=id&type=eq.diary&tags=cs.{birthday-check}&created_at=gte.${since}&limit=1`,
  );
  if (check.ok) {
    const rows = await check.json();
    if (rows.length > 0) return;
  }

  const bd = await db("birthdays?select=name,birth_date,notes");
  if (!bd.ok) return;
  const birthdays = await bd.json() as Array<{ name: string; birth_date: string; notes: string | null }>;
  const todayMD = `${String(now.date.getMonth() + 1).padStart(2, "0")}-${String(now.date.getDate()).padStart(2, "0")}`;
  // Use Auckland month/day
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, month: "2-digit", day: "2-digit" });
  const aklParts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const aklMD = `${aklParts.month}-${aklParts.day}`;

  const todays = birthdays.filter((b) => b.birth_date.slice(5) === aklMD);

  // Always log to prevent re-running today (even if nobody has a birthday)
  await db("entries", {
    method: "POST",
    body: JSON.stringify({
      type: "diary",
      content: todays.length
        ? `🎂 Birthday reminder sent: ${todays.map((b) => b.name).join(", ")}`
        : "Birthday check ran (none today)",
      tags: ["birthday-check"],
      priority: 3,
      status: "logged",
    }),
  });

  if (todays.length === 0) return;
  const msg = "🎂 Birthdays today:\n" +
    todays.map((b) => `• ${b.name}${b.notes ? ` — ${b.notes}` : ""}`).join("\n");
  await sendTelegram(chatId, msg);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const now = nowInAuckland();
    const owner = await getOwnerProfile();
    const chatId = owner?.telegram_chat_id ?? null;

    // Schedules
    const r = await db("schedules?select=*&enabled=eq.true");
    if (!r.ok) throw new Error(`Failed to load schedules: ${await r.text()}`);
    const schedules = await r.json() as Schedule[];

    const due = schedules.filter((s) => isDue(s, now));
    console.log(`run-schedules: ${schedules.length} enabled, ${due.length} due, chatId=${chatId ?? "none"}`);

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const s of due) {
      try {
        const text = await callAnthropic(s.prompt);
        const body = `📌 ${s.title}\n\n${text}`;
        if (chatId) await sendTelegram(chatId, body);
        const patch: Record<string, unknown> = { last_run: new Date().toISOString() };
        if (s.frequency === "once") patch.enabled = false;
        await db(`schedules?id=eq.${s.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
        results.push({ id: s.id, ok: true });
      } catch (e) {
        console.error(`schedule ${s.id} failed`, e);
        results.push({ id: s.id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Daily birthday check
    if (chatId) {
      try {
        await runBirthdayCheck(chatId, now);
      } catch (e) {
        console.error("birthday check failed", e);
      }
    }

    // Morning briefing (gated by user preferences + already-sent-today check)
    if (owner) {
      try {
        await runMorningBriefing(owner, now);
      } catch (e) {
        console.error("morning briefing failed", e);
      }

      try {
        await runEveningNudge(owner, now);
      } catch (e) {
        console.error("evening nudge failed", e);
      }

      try {
        await runWeeklyReview(owner, now);
      } catch (e) {
        console.error("weekly review failed", e);
      }

      try {
        await runGrocerySend(owner, now);
      } catch (e) {
        console.error("grocery send failed", e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, now: now.ymd + "T" + now.hm, evaluated: schedules.length, ran: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("run-schedules fatal", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
