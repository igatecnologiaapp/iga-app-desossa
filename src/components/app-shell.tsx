import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { NotificationsBell } from "./notifications-bell";

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-panel flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
          <div className="min-w-0">
            <h1 className="font-semibold text-lg truncate">{title}</h1>
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
      </main>
    </div>
  );
}
