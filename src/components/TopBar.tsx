import { useEffect, useState } from "react";
import { Home } from "lucide-react";
import { format } from "date-fns";

export function TopBar() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  const time12 = format(now, "hh:mm a");
  const time24 = format(now, "HH:mm");
  const day = format(now, "EEEE");
  const date = format(now, "MMMM d, yyyy");

  return (
    <header className="bg-header text-header-foreground">
      <div className="flex items-center justify-between gap-6 px-10 py-5 sm:px-16 lg:px-20">
        <div className="flex items-baseline gap-4 min-w-0">
          <div className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
            {time12}
          </div>
          <div className="hidden sm:flex items-baseline gap-1 text-white/70">
            <span className="text-xl font-semibold tabular-nums">{time24}</span>
            <span className="text-[10px] uppercase tracking-wider">24H</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 text-2xl sm:text-3xl font-bold">
          <span>{day}</span>
          <span className="text-orange-accent">•</span>
          <span className="font-semibold text-white/90">{date}</span>
        </div>
        <button className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/10">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-accent/90">
            <Home className="h-4 w-4 text-white" />
          </span>
          Dashboard
        </button>
      </div>
    </header>
  );
}
