import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getMedicalProfile } from "@/lib/medical.functions";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function CheckupBanner() {
  const fetchProfile = useServerFn(getMedicalProfile);
  const { data } = useQuery({
    queryKey: ["medical-profile-banner"],
    queryFn: () => fetchProfile(),
    staleTime: 5 * 60_000,
  });

  if (!data || !data.checkup_frequency_months || !data.last_visit_date) return null;

  const nextDue = addMonths(new Date(data.last_visit_date), data.checkup_frequency_months);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  nextDue.setHours(0, 0, 0, 0);
  const days = Math.round((nextDue.getTime() - today.getTime()) / 86_400_000);

  if (days > 7) return null;

  const label =
    days < 0
      ? `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
      : days === 0
      ? "due today"
      : days === 1
      ? "due tomorrow"
      : `due in ${days} days`;

  return (
    <Link
      to="/medical"
      className="block"
    >
      <Card className="rounded-3xl border-border/60 bg-gradient-to-r from-sky-100 to-emerald-100 p-4 shadow-sm transition hover:brightness-105">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
            <Stethoscope className="h-5 w-5 text-sky-600" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">
              Doctor checkup {label}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              🩺 Your regular doctor's check-up is due — click to open your medical page.
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
