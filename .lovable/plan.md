# Daily Briefing AI — copy-paste bundle (no Telegram)

Package everything needed to reproduce the "who's in today / wins & losses / weather / markets / horoscope" briefing in a new project. Delivered as files under `/mnt/documents/daily-briefing-source/` plus a single master prompt you can paste into any LLM.

## What goes in the bundle

### 1. Server function — the brain
`lib/day-briefing.functions.ts` (existing file, unchanged)
- Pulls today's roster (`roster_staff` where `day = weekday`)
- Pulls today's training shifts (`roster_training`)
- Pulls today's tasks (`entries` type=task, due today or high-priority)
- Pulls today's meetings (`meetings` where datetime in day range)
- Fetches LIVE market quotes from Yahoo Finance + caches in `market_quotes_cache`
- Calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with a structured JSON prompt for weather + horoscope + AI summary
- Returns one `DayBriefing` object

### 2. New "wins & losses" extension
Add a second server fn `lib/wins-losses.functions.ts` that aggregates the last 24h across the platform:
- Tasks completed today (`entries` status=done, updated today) → wins
- Tasks overdue / still open past due_date → losses
- Meetings held vs cancelled
- Emails drafted (`drafts_log` count today)
- Memory facts added today
- New ideas / diary entries today
Feeds a compact JSON blob into an AI call that returns `{ wins: string[], losses: string[], summary: string }`.

### 3. UI component
`components/DayBriefingCard.tsx` — reads via `useSuspenseQuery`, renders:
- Header: date + weekday + weather line
- "Who's in today" list (from `roster` array, split by roster_type, off-staff greyed)
- Training shifts block
- Wins ✅ / Losses ⚠️ two-column list
- Markets ticker row
- Horoscope + AI summary footer

### 4. SQL
`sql/schema.sql` — only what this feature needs:
- `roster_staff`, `roster_training` (staffing source of truth)
- `entries`, `meetings` (activity source for wins/losses)
- `drafts_log` (activity signal)
- `market_quotes_cache` (price fallback)
- Full RLS + GRANTs on each

### 5. Master prompt (the "even if it's a prompt" ask)
`PROMPT.md` — a single self-contained system+user prompt you can paste into ChatGPT/Claude/Gemini with a JSON context blob. It returns the same shape the app uses, so you can wire it into any project without the server code if you want:

```
SYSTEM: You are a daily-briefing assistant. Given today's roster,
activity log, and location, return strict JSON: {
  weather:{summary,high_c,low_c,precipitation,wind,location},
  whos_in:[{name,shift,role}],
  wins:[string],  losses:[string],
  markets:[{symbol,price,change_pct,note}],
  horoscope:{sagittarius,chinese_rat},
  ai_summary: string
}
Rules: reference real numbers only; mark approximations; 3-5 sentence summary tying it all together.

USER: <paste today's context JSON here>
```

### 6. README
Wiring steps, required secrets (`LOVABLE_API_KEY` only — no Telegram, no OpenAI, no Anthropic), how to call the server fn, how to swap the prompt-only path in if you have no backend.

## Technical details

- Model: `google/gemini-3-flash-preview` via `https://ai.gateway.lovable.dev/v1/chat/completions` with `response_format: json_object`
- Auth: `requireSupabaseAuth` middleware on both server fns
- Location hard-coded to Whanganui, NZ (parameterise in the new project by passing `location` into input)
- Weekday derived from provided `date` param so the same fn works for tomorrow/yesterday previews
- Market prices fetched live from `query1.finance.yahoo.com/v8/finance/chart/<symbol>` with a DB-cached fallback (never trust the LLM for prices)

## Deliverables

```
/mnt/documents/daily-briefing-source/
  README.md
  PROMPT.md                           ← standalone prompt you can paste anywhere
  sql/schema.sql
  lib/day-briefing.functions.ts
  lib/wins-losses.functions.ts        ← NEW
  components/DayBriefingCard.tsx      ← NEW
  integrations/auth-middleware.ts
  integrations/client.server.ts
```

Plus a zipped `daily-briefing-source.zip` for one-click download.

## Out of scope
- Telegram webhook, voice transcription, intent classification, memory dedup — explicitly excluded.
- No changes to the live app; this is a copy-paste export only.
