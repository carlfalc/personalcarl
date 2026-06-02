import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

export function WeekStrip() {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => {
        const active = isSameDay(d, today);
        return (
          <div
            key={d.toISOString()}
            className={cn(
              "relative flex h-24 flex-col justify-between rounded-2xl border bg-card p-3 shadow-sm transition",
              active
                ? "border-orange-accent/40 bg-gradient-to-br from-[oklch(0.96_0.05_70)] to-[oklch(0.93_0.07_55)] ring-2 ring-orange-accent/30"
                : "border-border/60 hover:border-border",
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
            <div className="text-xs text-muted-foreground/70">—</div>
          </div>
        );
      })}
    </div>
  );
}
