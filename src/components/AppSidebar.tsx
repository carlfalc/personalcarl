import { Link, useRouterState } from "@tanstack/react-router";
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

const items = [
  { title: "Today",     subtitle: "Day at a glance",            url: "/",         emoji: "☀️", tint: "from-amber-200 to-orange-300" },
  { title: "Tasks",     subtitle: "Things to do",               url: "/tasks",    emoji: "✅", tint: "from-emerald-200 to-emerald-300" },
  { title: "Ideas",     subtitle: "Capture & explore",          url: "/ideas",    emoji: "💡", tint: "from-yellow-200 to-amber-300" },
  { title: "To-Dos",    subtitle: "Quick lists",                url: "/todos",    emoji: "📋", tint: "from-sky-200 to-sky-300" },
  { title: "Diary",     subtitle: "Notes & reflections",        url: "/diary",    emoji: "📓", tint: "from-rose-200 to-rose-300" },
  { title: "Meetings",  subtitle: "Calendar & agenda",          url: "/meetings", emoji: "📅", tint: "from-violet-200 to-violet-300" },
  { title: "About Me",  subtitle: "Profile & memory",           url: "/about",    emoji: "🧠", tint: "from-fuchsia-200 to-pink-300" },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="bg-sidebar">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-300 to-orange-500 text-xl shadow-sm">
            🧑‍🍳
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-base font-bold leading-tight">{userName}'s</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-accent">
              Command Centre
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {items.map((item) => {
                const active =
                  item.url === "/" ? currentPath === "/" : currentPath.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className={cn(
                        "h-auto py-2 rounded-xl",
                        active && "bg-white shadow-sm",
                      )}
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg shadow-sm",
                            item.tint,
                          )}
                        >
                          {item.emoji}
                        </span>
                        <span className="flex flex-col items-start leading-tight group-data-[collapsible=icon]:hidden">
                          <span className="text-sm font-semibold text-foreground">
                            {item.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
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
      </SidebarContent>
    </Sidebar>
  );
}
