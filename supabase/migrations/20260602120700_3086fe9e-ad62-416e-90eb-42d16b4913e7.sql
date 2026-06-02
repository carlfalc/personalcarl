create policy "No client access to pending email intents"
on public.pending_email_intents
for all
to authenticated
using (false)
with check (false);