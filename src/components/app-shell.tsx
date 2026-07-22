import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { NotificationsBell } from "./notifications-bell";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  return (
    <>
      <AppSidebar />
      <SidebarInset className="bg-background min-w-0">
        <header className="h-16 border-b bg-panel flex items-center gap-3 px-3 lg:px-6 sticky top-0 z-10">
          <SidebarTrigger className="shrink-0" />
          <Separator orientation="vertical" className="h-6" />
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-base lg:text-lg truncate leading-tight">{title}</h1>
            {subtitle ? (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            <NotificationsBell />
          </div>
        </header>
        <div className="p-4 lg:p-8 space-y-6 flex-1 animate-fade-in">{children}</div>
      </SidebarInset>
    </>
  );
}
