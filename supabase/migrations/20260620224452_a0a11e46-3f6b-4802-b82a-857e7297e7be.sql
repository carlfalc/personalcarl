
-- roster_staff: one row per (staff, day) entry
CREATE TABLE public.roster_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  day TEXT NOT NULL CHECK (day IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  is_off BOOLEAN NOT NULL DEFAULT false,
  start_time TEXT,
  end_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_staff TO authenticated;
GRANT ALL ON public.roster_staff TO service_role;
ALTER TABLE public.roster_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view roster" ON public.roster_staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert roster" ON public.roster_staff FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update roster" ON public.roster_staff FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete roster" ON public.roster_staff FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_roster_staff_updated BEFORE UPDATE ON public.roster_staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- roster_snapshots: history log
CREATE TABLE public.roster_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  saved_by UUID,
  label TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_snapshots TO authenticated;
GRANT ALL ON public.roster_snapshots TO service_role;
ALTER TABLE public.roster_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view snapshots" ON public.roster_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert snapshots" ON public.roster_snapshots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete snapshots" ON public.roster_snapshots FOR DELETE TO authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.roster_staff;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roster_snapshots;

-- Seed initial roster
INSERT INTO public.roster_staff (staff_name, position, day, is_off, start_time, end_time) VALUES
('Jayda',0,'Mon',true,NULL,NULL),
('Jayda',0,'Tue',false,'06:00','10:30'),
('Jayda',0,'Wed',false,'06:00','10:30'),
('Jayda',0,'Thu',false,'06:00','10:30'),
('Jayda',0,'Fri',false,'06:00','14:00'),
('Jayda',0,'Sat',false,'07:00','15:00'),
('Jayda',0,'Sun',true,NULL,NULL),
('Lauren',1,'Tue',false,'15:00','21:30'),
('Lauren',1,'Wed',false,'15:00','21:30'),
('Lauren',1,'Fri',false,'16:00','21:00'),
('Lauren',1,'Sat',false,'13:00','20:00'),
('Abigail',2,'Thu',false,'16:00','21:00'),
('Abigail',2,'Fri',false,'10:30','15:00'),
('Abigail',2,'Sat',false,'10:30','15:00'),
('Sarah',3,'Mon',false,'13:00','21:00'),
('Sarah',3,'Tue',false,'13:00','21:00'),
('Sarah',3,'Wed',false,'13:00','21:00'),
('Sarah',3,'Thu',true,NULL,NULL),
('Sarah',3,'Fri',false,'13:00','21:00'),
('Sarah',3,'Sat',false,'13:00','21:00'),
('Sarah',3,'Sun',true,NULL,NULL),
('Izabella',4,'Mon',false,'07:00','10:30'),
('Izabella',4,'Tue',false,'15:00','21:30'),
('Izabella',4,'Thu',false,'15:00','21:30'),
('Izabella',4,'Sat',false,'10:00','18:00'),
('Izabella',4,'Sun',false,'07:00','15:00'),
('Danielle',5,'Tue',false,'17:00','22:00'),
('Danielle',5,'Wed',false,'17:00','21:00'),
('Danielle',5,'Thu',false,'16:00','21:30'),
('Danielle',5,'Fri',false,'16:00','21:00'),
('Danielle',5,'Sat',false,'16:00','22:00'),
('Savannah McDougall',6,'Mon',false,NULL,NULL);
DELETE FROM public.roster_staff WHERE staff_name='Savannah McDougall';
INSERT INTO public.roster_staff (staff_name, position, day, is_off, start_time, end_time) VALUES
('Savannah McDougall',6,'Mon',true,NULL,NULL);
