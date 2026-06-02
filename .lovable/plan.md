## Problem

The Telegram bot's "something went wrong saving" reply is misleading. The real failure is at the Claude classification step:

```
claude failed: {"error":{"type":"authentication_error","message":"invalid x-api-key"}}
```

Anthropic is rejecting the stored `ANTHROPIC_API_KEY`. The function never reaches the Supabase inserts, so RLS / service role / schema are not the issue.

## Fix

1. Update the `ANTHROPIC_API_KEY` secret with a valid key from https://console.anthropic.com/settings/keys.
   - Make sure it starts with `sk-ant-...` and has no leading/trailing whitespace or newline.
   - Confirm the key's workspace has access to the `claude-sonnet-4-5` model (or we switch the model name).
2. No code change needed — `supabase/functions/telegram-webhook/index.ts` already reads `ANTHROPIC_API_KEY` correctly and uses the service role client for inserts.
3. After updating the secret, send a test message to the bot and re-check `telegram-webhook` logs to confirm:
   - No more `claude failed` error
   - Rows appear in `entries` / `meetings` / `memory`
   - Bot replies with the ✅ summary

## Fallback if Anthropic access is a blocker

If you'd rather not manage an Anthropic key, I can switch `classifyWithClaude` to use the Lovable AI Gateway (`google/gemini-2.5-flash` or `openai/gpt-5-mini`) which uses the already-present `LOVABLE_API_KEY` — no new secret required. Tell me which you'd prefer.
