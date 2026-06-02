import { useQuery } from "@tanstack/react-query";
import { Cake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { Card } from "@/components/ui/card";

type Entry = { id: string; name: string; birth_date: string; source: "birthdays" | "family" };

function daysUntil(birthDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(birthDate);
  const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

export function BirthdayBanner() {
  useRealtimeTable("birthdays", ["birthdays-upcoming"]);
  useRealtimeTable("memory", ["birthdays-upcoming"]);
  const { data = [] } = useQuery({
    queryKey: ["birthdays-upcoming"],
    queryFn: async () => {
      const [b, m] = await Promise.all([
        supabase.from("birthdays").select("id,name,birth_date"),
        supabase.from("memory").select("id,fact,birth_date").eq("category", "family").not("birth_date", "is", null),
      ]);
      if (b.error) throw b.error;
      if (m.error) throw m.error;
      const list: Entry[] = [
        ...(b.data ?? []).map((r) => ({ id: r.id, name: r.name, birth_date: r.birth_date, source: "birthdays" as const })),
        ...(m.data ?? []).map((r) => ({ id: r.id, name: r.fact, birth_date: r.birth_date as string, source: "family" as const })),
      ];
      return list;
    },
  });

  const upcoming = data
    .map((b) => ({ ...b, days: daysUntil(b.birth_date) }))
    .filter((b) => b.days >= 0 && b.days <= 7)
    .sort((a, b) => a.days - b.days);

  if (upcoming.length === 0) return null;

  return (
    <Card className="rounded-3xl border-border/60 bg-gradient-to-r from-pink-100 to-rose-100 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Cake className="h-5 w-5 text-rose-500" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-600">
            Birthdays this week
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-foreground">
            {upcoming.map((b) => (
              <span key={`${b.source}-${b.id}`}>
                🎂 {b.name} —{" "}
                {b.days === 0 ? "today" : b.days === 1 ? "tomorrow" : `in ${b.days} days`}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
