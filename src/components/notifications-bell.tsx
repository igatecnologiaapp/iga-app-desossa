import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/use-auth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { markNotificationsRead as markNotificationsReadFn } from "@/lib/notifications.functions";


interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  order_id: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationsBell() {
  const { userId } = useUserContext();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as Notification[];
    },
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["notifications", userId] });
          const n = payload.new as Notification;
          toast(n.title, { description: n.body ?? undefined });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  const markAll = useMutation({
    mutationFn: async () => {
      const ids = notifications.filter((n) => !n.read_at).map((n) => n.id);
      if (ids.length === 0) return;
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  if (!userId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-md hover:bg-secondary transition-colors"
          aria-label="Notificações"
        >
          <Bell className="size-5 text-muted-foreground" />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-bold text-sm">Notificações</h3>
          {unreadCount > 0 ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAll.mutate()}>
              <CheckCheck className="size-3.5 mr-1" /> Marcar todas
            </Button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Sem notificações ainda.
            </div>
          ) : (
            notifications.map((n) => {
              const content = (
                <div
                  className={cn(
                    "px-4 py-3 border-b hover:bg-secondary/60 transition-colors cursor-pointer",
                    !n.read_at && "bg-primary/5",
                  )}
                  onClick={() => {
                    if (!n.read_at) markOne.mutate(n.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full mt-1.5 shrink-0",
                        n.read_at ? "bg-transparent" : "bg-primary",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">{n.title}</div>
                      {n.body ? (
                        <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
                      ) : null}
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                        {formatRelative(n.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              );
              return n.order_id ? (
                <Link key={n.id} to="/ordens/$id" params={{ id: n.order_id }}>
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
