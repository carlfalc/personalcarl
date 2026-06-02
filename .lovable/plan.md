## What the logs actually say

Most recent `telegram-webhook` error from the voice attempt:

```
Error: whisper failed: {"error":{"message":"Incorrect API key provided: sk-ant-a***...***ygAA. You can find your API key at https://platform.openai.com/account/api-keys.","type":"invalid_request_error","code":"invalid_api_key","param":null},"status":401}
    at transcribeWithWhisper (telegram-webhook/index.ts:50)
```

## Answers to your questions

1. **Exact error**: see above — OpenAI returned `invalid_api_key`.
2. **Failed step**: the OpenAI Whisper transcription call. The Telegram file download succeeded (we got far enough to POST audio to OpenAI).
3. **Whisper call wiring is correct**: model `whisper-1`, sent as `multipart/form-data` via `FormData`, reads `Deno.env.get("OPENAI_API_KEY")` and sends it as `Authorization: Bearer ...`. No code bug.
4. **HTTP status**: **401 Unauthorized**.

## Root cause

The value stored in the `OPENAI_API_KEY` secret is actually an **Anthropic** key — it starts with `sk-ant-...`. OpenAI sees a key that isn't theirs and rejects it. Most likely the OpenAI and Anthropic values got swapped when the secrets were updated earlier.

(Implication: `ANTHROPIC_API_KEY` is probably holding the OpenAI key, so text classification via Claude will start failing the same way as soon as Claude is invoked again.)

## Fix

1. Update the `OPENAI_API_KEY` secret with a real OpenAI key from https://platform.openai.com/account/api-keys (must start with `sk-...`, not `sk-ant-...`, no whitespace/newline, and the account must have Whisper access + available credit).
2. Re-check `ANTHROPIC_API_KEY` — if it currently holds the OpenAI value (`sk-...`), replace it with the real Anthropic key (`sk-ant-...`).
3. No code changes needed — `supabase/functions/telegram-webhook/index.ts` reads both env vars correctly.
4. After updating, send the bot a voice note and re-check `telegram-webhook` logs to confirm no `whisper failed` / no `claude failed`, and that rows land in `entries` / `meetings` / `memory`.

## Fallback if you don't want to manage an OpenAI key

Switch transcription to the Lovable AI Gateway (no new secret needed, uses the existing `LOVABLE_API_KEY`). Tell me if you'd prefer that and I'll wire it in instead.
