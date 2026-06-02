import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

function gcalHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const calKey = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!lovableKey || !calKey) throw new Error("Google Calendar connector not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": calKey,
    "Content-Type": "application/json",
  };
}

export const cancelCalendarEvent = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ eventId: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const res = await fetch(
      `${GATEWAY}/calendars/primary/events/${encodeURIComponent(data.eventId)}`,
      { method: "DELETE", headers: gcalHeaders() },
    );
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new Error(`Google Calendar delete failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    return { ok: true };
  });

export const rescheduleCalendarEvent = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      eventId: z.string().min(1).max(200),
      startIso: z.string().min(10).max(40),
      endIso: z.string().min(10).max(40),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const tz = "UTC";
    const res = await fetch(
      `${GATEWAY}/calendars/primary/events/${encodeURIComponent(data.eventId)}`,
      {
        method: "PATCH",
        headers: gcalHeaders(),
        body: JSON.stringify({
          start: { dateTime: data.startIso, timeZone: tz },
          end: { dateTime: data.endIso, timeZone: tz },
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`Google Calendar patch failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    return { ok: true };
  });

export const createCalendarEvent = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      title: z.string().min(1).max(300),
      startIso: z.string().min(10).max(40),
      endIso: z.string().min(10).max(40),
      location: z.string().max(300).optional().nullable(),
      description: z.string().max(5000).optional().nullable(),
      attendees: z.array(z.string().email()).max(50).default([]),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const body: Record<string, unknown> = {
      summary: data.title,
      start: { dateTime: data.startIso, timeZone: "UTC" },
      end: { dateTime: data.endIso, timeZone: "UTC" },
    };
    if (data.location) body.location = data.location;
    if (data.description) body.description = data.description;
    if (data.attendees.length > 0) {
      body.attendees = data.attendees.map((email) => ({ email }));
    }
    const url = `${GATEWAY}/calendars/primary/events?sendUpdates=all`;
    const res = await fetch(url, {
      method: "POST",
      headers: gcalHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Google Calendar create failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    const json = await res.json() as { id?: string };
    return { ok: true, eventId: json.id ?? null };
  });
