import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Hourly cron hits this endpoint. We only fire between 8 AM and 10 PM Sydney
// time, and only re-notify each open P1 task every 4h until it is completed.
// That covers both rules the user asked for:
//   - tasks added after 6 PM the previous day are surfaced at 8 AM the next day
//   - tasks added during the morning are surfaced at the next slot
// And then nagged every 4h until status flips off "todo"/"doing".

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NOTIFY_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const WAKING_HOURS_START = 8;   // 08:00 Sydney
const WAKING_HOURS_END = 22;    // 22:00 Sydney (exclusive)

function sydneyHour(): number {
  // Intl returns the hour in the requested time zone (handles AEST/AEDT DST).
  const h = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return parseInt(h, 10);
}

async function sendTelegram(chatId: string, text: string) {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    },
  );
  if (!res.ok) {
    throw new Error(`Telegram sendMessage failed [${res.status}]: ${await res.text()}`);
  }
}

export const Route = createFileRoute("/api/public/hooks/p1-task-notifier")({
  server: {
    handlers: {
      POST: async () => {
        if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          return Response.json(
            { error: "Missing required environment configuration" },
            { status: 500 },
          );
        }

        const hour = sydneyHour();
        if (hour < WAKING_HOURS_START || hour >= WAKING_HOURS_END) {
          return Response.json({ skipped: "outside_waking_hours", sydneyHour: hour });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Pull every open P1 task across all users (single-user app today,
        // but this stays correct if more profiles appear).
        const { data: tasks, error: tasksErr } = await supabase
          .from("entries")
          .select("id, content, user_id, created_at, priority, status")
          .eq("type", "task")
          .eq("priority", 1)
          .not("status", "in", "(done,deleted)");

        if (tasksErr) {
          return Response.json({ error: tasksErr.message }, { status: 500 });
        }
        if (!tasks || tasks.length === 0) {
          return Response.json({ ok: true, sent: 0, reason: "no_open_p1" });
        }

        // Last-sent timestamps so we don't spam — every 4h max per task.
        const ids = tasks.map((t) => t.id);
        const { data: lastSent } = await supabase
          .from("task_notifications")
          .select("entry_id, last_sent_at")
          .in("entry_id", ids);
        const lastSentMap = new Map(
          (lastSent ?? []).map((r) => [r.entry_id as string, new Date(r.last_sent_at as string).getTime()]),
        );

        // Cache chat_id per user so we don't re-query for each task.
        const chatIdCache = new Map<string, string | null>();
        const now = Date.now();
        let sent = 0;
        const errors: string[] = [];

        for (const t of tasks) {
          const last = lastSentMap.get(t.id);
          if (last && now - last < NOTIFY_INTERVAL_MS) continue;

          let chatId = chatIdCache.get(t.user_id) ?? null;
          if (!chatIdCache.has(t.user_id)) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("telegram_chat_id")
              .eq("id", t.user_id)
              .maybeSingle();
            chatId = (profile?.telegram_chat_id as string | null) ?? null;
            chatIdCache.set(t.user_id, chatId);
          }
          if (!chatId) continue;

          const title = (t.content as string).split("\n")[0] ?? "(untitled)";
          const message =
            `🚨 <b>P1 task still open</b>\n` +
            `${title}\n\n` +
            `Added ${new Date(t.created_at as string).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}.\n` +
            `Reminder will repeat every 4 hours until completed.`;

          try {
            await sendTelegram(chatId, message);
            await supabase.from("task_notifications").upsert({
              entry_id: t.id,
              last_sent_at: new Date().toISOString(),
            });
            sent++;
          } catch (e) {
            errors.push(`${t.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        return Response.json({
          ok: true,
          sent,
          considered: tasks.length,
          sydneyHour: hour,
          errors: errors.length ? errors : undefined,
        });
      },
    },
  },
});
