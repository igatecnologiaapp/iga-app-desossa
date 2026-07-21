import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/use-auth";
import { formatKg, formatDate } from "@/lib/format";
import { ChevronRight, LogOut, Scale } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mobile/")({
  head: () => ({ meta: [{ title: "Minhas Desossas — CarnePro" }] }),
  component: MobileHome,
});

function MobileHome() {
  const { context, isLoading } = useUserContext();
  const navigate = useNavigate();

  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders", context?.employee?.id],
    enabled: !!context?.employee?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deboning_orders")
        .select(
          "id, order_code, peso_inicial, status, order_date, products:product_id(name), suppliers:supplier_id(razao_social, nome_fantasia)",
        )
        .eq("assigned_employee_id", context!.employee!.id)
        .neq("status", "finalizada")
        .order("order_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!isLoading && context && !context.employee) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="max-w-sm text-center space-y-4">
          <div className="size-16 mx-auto rounded-full bg-warning/15 flex items-center justify-center">
            <Scale className="size-7 text-amber-700" />
          </div>
          <h1 className="text-xl font-bold">Aguardando vínculo</h1>
          <p className="text-sm text-muted-foreground">
            Peça ao administrador para cadastrar seu perfil de açougueiro usando o mesmo e-mail deste acesso.
          </p>
          <button onClick={signOut} className="text-sm font-semibold text-primary">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-panel border-b px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Olá,
          </div>
          <div className="font-bold text-base leading-tight">
            {context?.employee?.full_name ?? context?.profile?.full_name ?? "Açougueiro"}
          </div>
        </div>
        <button onClick={signOut} className="p-2 -mr-2 text-muted-foreground">
          <LogOut className="size-5" />
        </button>
      </header>

      <div className="p-4 space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1">
          Suas ordens pendentes ({orders.length})
        </div>

        {orders.length === 0 ? (
          <div className="bg-panel border rounded-lg p-8 text-center">
            <div className="text-sm text-muted-foreground">
              Nenhuma ordem atribuída no momento.
            </div>
          </div>
        ) : (
          orders.map((o: any) => (
            <Link
              key={o.id}
              to="/mobile/desossa/$id"
              params={{ id: o.id }}
              className="block bg-panel border rounded-lg p-4 active:bg-secondary transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground">
                      {o.order_code ?? o.id.slice(0, 6)}
                    </span>
                    <StatusPill status={o.status} />
                  </div>
                  <div className="font-bold text-lg leading-tight mt-1 truncate">
                    {o.products?.name ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {o.suppliers?.nome_fantasia ?? o.suppliers?.razao_social ?? "—"} ·{" "}
                    {formatDate(o.order_date)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-xl">{formatKg(o.peso_inicial)}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    kg iniciais
                  </div>
                </div>
                <ChevronRight className="size-5 text-muted-foreground shrink-0" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { l: string; cls: string }> = {
    pendente: { l: "Pendente", cls: "bg-secondary text-muted-foreground" },
    em_andamento: { l: "Em desossa", cls: "bg-warning/15 text-amber-700" },
  };
  const s = map[status] ?? map.pendente;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${s.cls}`}
    >
      {s.l}
    </span>
  );
}
