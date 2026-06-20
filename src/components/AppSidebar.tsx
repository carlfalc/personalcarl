import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Sun,
  CheckSquare,
  Lightbulb,
  ListTodo,
  BookOpen,
  CalendarDays,
  Mail,
  Image as ImageIcon,
  UserCircle2,
  Clock,
  Users,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useUserName } from "@/hooks/useUserName";
import { useAvatar } from "@/hooks/useAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

type CountKey = "tasks" | "ideas" | "todos" | "meetings" | "images";
type CountColor = "red" | "green" | "black";

const items: Array<{
  title: string; subtitle: string; url: string; icon: LucideIcon;
  countKey?: CountKey; countColor?: CountColor;
}> = [
  { title: "Today",     subtitle: "Day at a glance",            url: "/",          icon: Sun },
  { title: "Tasks",     subtitle: "Things to do",               url: "/tasks",     icon: CheckSquare,   countKey: "tasks",    countColor: "red" },
  { title: "Ideas",     subtitle: "Capture & explore",          url: "/ideas",     icon: Lightbulb,     countKey: "ideas",    countColor: "green" },
  { title: "To-Dos",    subtitle: "Quick lists",                url: "/todos",     icon: ListTodo,      countKey: "todos",    countColor: "red" },
  { title: "Diary",     subtitle: "Notes & reflections",        url: "/diary",     icon: BookOpen },
  { title: "Meetings",  subtitle: "Calendar & agenda",          url: "/meetings",  icon: CalendarDays,  countKey: "meetings", countColor: "red" },
  { title: "Email",     subtitle: "Voice → Gmail drafts",       url: "/email",     icon: Mail },
  { title: "Images",    subtitle: "Photos from Telegram",       url: "/images",    icon: ImageIcon,     countKey: "images",   countColor: "black" },
  { title: "About Me",  subtitle: "Profile & memory",           url: "/about",     icon: UserCircle2 },
  { title: "Schedules", subtitle: "Recurring AI briefings",     url: "/schedules", icon: Clock },
  { title: "Roster",    subtitle: "Glasshouse weekly roster",   url: "/roster",    icon: Users },
  { title: "Settings",  subtitle: "Telegram & birthdays",       url: "/settings",  icon: SettingsIcon },
];

const COUNT_COLOR_CLASS: Record<CountColor, string> = {
  red: "text-destructive",
  green: "text-primary",
  black: "text-foreground",
};

function useSidebarCounts() {
  useRealtimeTable("entries", ["sidebar-counts"]);
  useRealtimeTable("meetings", ["sidebar-counts"]);
  useRealtimeTable("images", ["sidebar-counts"]);

  return useQuery({
    queryKey: ["sidebar-counts"],
    queryFn: async (): Promise<Record<CountKey, number>> => {
      const nowIso = new Date().toISOString();
      const [tasks, ideas, todos, meetings, images] = await Promise.all([
        supabase.from("entries").select("id", { count: "exact", head: true })
          .eq("type", "task").not("status", "in", "(done,deleted)"),
        supabase.from("entries").select("id", { count: "exact", head: true })
          .eq("type", "idea").neq("status", "deleted"),
        supabase.from("entries").select("id", { count: "exact", head: true })
          .eq("type", "todo").neq("status", "done"),
        supabase.from("meetings").select("id", { count: "exact", head: true })
          .neq("status", "cancelled").gte("datetime", nowIso),
        supabase.from("images").select("id", { count: "exact", head: true }),
      ]);
      return {
        tasks: tasks.count ?? 0,
        ideas: ideas.count ?? 0,
        todos: todos.count ?? 0,
        meetings: meetings.count ?? 0,
        images: images.count ?? 0,
      };
    },
    staleTime: 15_000,
  });
}

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const [userName] = useUserName();
  const avatarUrl = useAvatar();
  const { data: counts } = useSidebarCounts();


  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="bg-sidebar">
        <div className="flex items-center gap-3 px-2 py-3">
          <Link
            to="/settings"
            title="Change profile picture"
            className="group/avatar relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20 transition hover:ring-2 hover:ring-accent"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={`${userName}'s avatar`} className="h-full w-full object-cover" />
            ) : (
              <UserCircle2 className="h-6 w-6" />
            )}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/70 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground opacity-0 transition group-hover/avatar:opacity-100">
              Edit
            </span>
          </Link>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-base font-bold leading-tight text-primary">{userName}'s</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-foreground/80">
              Command Centre
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const active =
                  item.url === "/" ? currentPath === "/" : currentPath.startsWith(item.url);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className={cn(
                        "h-auto py-2 rounded-lg transition-colors",
                        "hover:bg-secondary/60",
                        active && "bg-primary text-primary-foreground hover:bg-primary",
                      )}
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                            active
                              ? "bg-accent text-primary"
                              : "bg-secondary text-primary ring-1 ring-border",
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col items-start leading-tight group-data-[collapsible=icon]:hidden">
                          <span className="flex w-full items-center gap-1.5">
                            <span className={cn(
                              "text-sm font-semibold",
                              active ? "text-primary-foreground" : "text-foreground",
                            )}>
                              {item.title}
                            </span>
                            {item.countKey && item.countColor && counts && counts[item.countKey] > 0 && (
                              <span className={cn(
                                "ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                                active
                                  ? "bg-accent text-primary"
                                  : cn("bg-background ring-1 ring-border", COUNT_COLOR_CLASS[item.countColor]),
                              )}>
                                {counts[item.countKey]}
                              </span>
                            )}
                          </span>
                          <span className={cn(
                            "text-[11px]",
                            active ? "text-primary-foreground/70" : "text-muted-foreground",
                          )}>
                            {item.subtitle}
                          </span>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <button
              onClick={async () => {
                const { supabase } = await import("@/integrations/supabase/client");
                await supabase.auth.signOut();
              }}
              className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
            >
              Sign out
            </button>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
