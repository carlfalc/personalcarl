ALTER PUBLICATION supabase_realtime ADD TABLE public.roster_training;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roster_training_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roster_training_meta;
ALTER TABLE public.roster_training REPLICA IDENTITY FULL;
ALTER TABLE public.roster_training_snapshots REPLICA IDENTITY FULL;
ALTER TABLE public.roster_training_meta REPLICA IDENTITY FULL;