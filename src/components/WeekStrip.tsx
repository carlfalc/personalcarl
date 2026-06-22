import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { DayDetailDialog } from "@/components/DayDetailDialog";

type Meeting = {
  id: string;
  title: string;
  datetime: string;
  status: string | null;
};

export function WeekStrip() {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const endIso = addDays(today, 7).toISOString();
  const [openDay, setOpenDay] = useState<Date | null>(null);

  const { data: meetings = [] } = useQuery({
    queryKey: ["today-meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,datetime,status")
        .gte("datetime", today.toISOString())
        .lt("datetime", endIso)
        .order("datetime", { ascending: true });
      if (error) throw error;
      return (data as Meeting[]).filter((m) => m.status !== "cancelled");
    },
  });

  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((d) => {
          const active = isSameDay(d, today);
          const dayMeetings = meetings.filter((m) => isSameDay(new Date(m.datetime), d));
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => setOpenDay(d)}
              className={cn(
                "relative flex h-24 flex-col justify-between rounded-2xl border bg-card p-3 text-left shadow-sm transition cursor-pointer",
                active
                  ? "border-orange-accent/40 bg-gradient-to-br from-[oklch(0.96_0.05_70)] to-[oklch(0.93_0.07_55)] ring-2 ring-orange-accent/30"
                  : "border-border/60 hover:border-border hover:shadow-md",
              )}
            >
              <div className="flex items-start justify-between">
                <span className={cn(
                  "text-lg font-bold",
                  active ? "text-orange-accent" : "text-foreground/80",
                )}>
                  {format(d, "EEE")}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {format(d, "d")}
                </span>
              </div>
              {dayMeetings.length === 0 ? (
                <div className="text-xs text-muted-foreground/70">—</div>
              ) : (
                <div className="space-y-0.5 overflow-hidden">
                  {dayMeetings.slice(0, 2).map((m) => (
                    <div
                      key={m.id}
                      className="truncate text-[10px] font-medium text-foreground/80"
                      title={`${format(new Date(m.datetime), "HH:mm")} · ${m.title}`}
                    >
                      <span className="tabular-nums text-orange-accent">
                        {format(new Date(m.datetime), "HH:mm")}
                      </span>{" "}
                      {m.title}
                    </div>
                  ))}
                  {dayMeetings.length > 2 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{dayMeetings.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <DayDetailDialog
        open={!!openDay}
        onOpenChange={(o) => !o && setOpenDay(null)}
        date={openDay}
      />
    </>
  );
}
