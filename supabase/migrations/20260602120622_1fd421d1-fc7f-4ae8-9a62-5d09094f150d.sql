create policy "No client access to pending family profiles"
on public.pending_family_profiles
for all
to authenticated
using (false)
with check (false);