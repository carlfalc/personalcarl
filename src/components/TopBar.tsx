import { useEffect, useState } from "react";
import { Home, Pencil, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const COLOR_KEY = "topbar:bgColor";
const FG_KEY = "topbar:fgColor";
const SHOW_DAY_KEY = "topbar:showDay";
const DEFAULT_BG = "#1f2740";
const DEFAULT_FG = "#f7f5ee";

function loadPref<T>(key: string, fallback: T, parser: (v: string) => T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : parser(v);
  } catch {
    return fallback;
  }
}

export function TopBar() {
  const [now, setNow] = useState(new Date());
  const [bgColor, setBgColor] = useState<string>(() => loadPref(COLOR_KEY, DEFAULT_BG, (v) => v));
  const [fgColor, setFgColor] = useState<string>(() => loadPref(FG_KEY, DEFAULT_FG, (v) => v));
  const [showDay, setShowDay] = useState<boolean>(() => loadPref(SHOW_DAY_KEY, true, (v) => v !== "false"));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(COLOR_KEY, bgColor); } catch { /* ignore */ }
  }, [bgColor]);
  useEffect(() => {
    try { window.localStorage.setItem(FG_KEY, fgColor); } catch { /* ignore */ }
  }, [fgColor]);
  useEffect(() => {
    try { window.localStorage.setItem(SHOW_DAY_KEY, String(showDay)); } catch { /* ignore */ }
  }, [showDay]);

  const time24 = format(now, "HH:mm");
  const day = format(now, "EEEE");
  const date = format(now, "MMMM d, yyyy");

  const resetDefaults = () => {
    setBgColor(DEFAULT_BG);
    setFgColor(DEFAULT_FG);
    setShowDay(true);
  };

  return (
    <header style={{ backgroundColor: bgColor, color: fgColor }}>
      <div className="flex items-center justify-between gap-6 px-6 py-5 sm:px-8">
        <div className="flex items-baseline gap-2 min-w-0 pl-[16rem]">
          <div className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
            {time24}
          </div>
          <span className="text-[10px] uppercase tracking-wider opacity-60">24H</span>
        </div>
        <div className="hidden md:flex items-center gap-3 text-2xl sm:text-3xl font-bold">
          {showDay && (
            <>
              <span>{day}</span>
              <span className="text-orange-accent">•</span>
            </>
          )}
          <span className="font-semibold opacity-90">{date}</span>
        </div>
        <div className="hidden lg:block">
          <GlobalSearch compact />
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                aria-label="Edit header appearance"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur transition hover:bg-white/10"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Header appearance</DialogTitle>
                <DialogDescription>Customize the header color and toggle the day of the week.</DialogDescription>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="header-bg">Background color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="header-bg"
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded border border-input bg-transparent"
                    />
                    <input
                      type="text"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="header-fg">Text color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="header-fg"
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded border border-input bg-transparent"
                    />
                    <input
                      type="text"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label htmlFor="show-day" className="text-sm font-medium">Show day of week</Label>
                    <p className="text-xs text-muted-foreground">Date always shows regardless.</p>
                  </div>
                  <Switch id="show-day" checked={showDay} onCheckedChange={setShowDay} />
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" size="sm" onClick={resetDefaults}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Reset
                  </Button>
                  <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <button className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/10">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-accent/90">
              <Home className="h-4 w-4 text-white" />
            </span>
            Dashboard
          </button>
        </div>
      </div>
    </header>
  );
}
