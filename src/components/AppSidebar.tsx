import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sun,
  CheckSquare,
  Lightbulb,
  ListChecks,
  BookOpen,
  Calendar,
  User,
  Sparkles,
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

const items = [
  { title: "Today", url: "/", icon: Sun },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Ideas", url: "/ideas", icon: Lightbulb },
  { title: "To-Dos", url: "/todos", icon: ListChecks },
  { title: "Diary", url: "/diary", icon: BookOpen },
  { title: "Meetings", url: "/meetings", icon: Calendar },
  { title: "About Me", url: "/about", icon: User },
];

export function AppSidebar() {
  const currentPath = useRouterState({
    select: (s) => s.location.pathname,
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-none">Personal OS</span>
            <span className="text-xs text-muted-foreground">your second brain</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active =
                  item.url === "/"
                    ? currentPath === "/"
                    : currentPath.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
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
