import { createFileRoute } from "@tanstack/react-router";
import { assertAnyRole } from "@/lib/route-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings2, Save, AlertTriangle } from "lucide-react";
import { formatKg } from "@/lib/format";
import { usePermissions } from "@/hooks/use-permissions";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — PRO MEAT" },
      { name: "description", content: "Parâmetros operacionais do sistema." },
    ],
  }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin"]),
  component: Config,
});

function Config() {
  const qc = useQueryClient();
  const perms = usePermissions();
  const [form, setForm] = useState({
    divergencia_maxima_kg: 0.5,
    atencao_pct: 2,
    critico_pct: 5,
    margem_padrao_pct: 30,
  });
  const [loaded, setLoaded] = useState(false);

  const { data } = useQuery({
    queryKey: ["settings-page"],
    queryFn: async () => {
      const { data } = await supabase.from("tenant_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  if (data && !loaded) {
    setForm({
      divergencia_maxima_kg: Number(data.divergencia_maxima_kg ?? 0.5),
      atencao_pct: Number(data.atencao_pct ?? 2),
      critico_pct: Number(data.critico_pct ?? 5),
      margem_padrao_pct: Number(data.margem_padrao_pct ?? 30),
    });
    setLoaded(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const tenantId = "00000000-0000-0000-0000-000000000001";
      const { error } = await supabase
        .from("tenant_settings")
        .upsert(
          {
            tenant_id: tenantId,
            divergencia_maxima_kg: form.divergencia_maxima_kg,
            atencao_pct: form.atencao_pct,
            critico_pct: form.critico_pct,
            margem_padrao_pct: form.margem_padrao_pct,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-settings"] });
      qc.invalidateQueries({ queryKey: ["settings-page"] });
      toast.success("Configurações salvas");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  if (!perms.isAdmin) {
    return (
      <AppShell title="Configurações">
        <div className="text-sm text-muted-foreground">Somente administradores podem acessar esta tela.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Configurações" subtitle="Parâmetros operacionais do sistema">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMut.mutate();
        }}
        className="max-w-3xl space-y-6"
      >
        <section className="bg-panel border rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" />
            <h2 className="font-bold">Validação de Divergência</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Define quando o sistema exibe alerta de divergência ao finalizar uma desossa.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Limite máximo (kg)</Label>
              <Input
                type="number"
                step="0.001"
                value={form.divergencia_maxima_kg}
                onChange={(e) =>
                  setForm((f) => ({ ...f, divergencia_maxima_kg: Number(e.target.value) || 0 }))
                }
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Atual: {formatKg(form.divergencia_maxima_kg, 3)} kg
              </p>
            </div>
            <div className="space-y-2">
              <Label>Atenção (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.atencao_pct}
                onChange={(e) => setForm((f) => ({ ...f, atencao_pct: Number(e.target.value) || 0 }))}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">🟡 abaixo deste %</p>
            </div>
            <div className="space-y-2">
              <Label>Crítico (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.critico_pct}
                onChange={(e) => setForm((f) => ({ ...f, critico_pct: Number(e.target.value) || 0 }))}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">🔴 acima deste %</p>
            </div>
          </div>
        </section>

        <section className="bg-panel border rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-primary" />
            <h2 className="font-bold">Precificação</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Margem padrão sugerida (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.margem_padrao_pct}
                onChange={(e) =>
                  setForm((f) => ({ ...f, margem_padrao_pct: Number(e.target.value) || 0 }))
                }
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Aplicada no cálculo de preço sugerido nas ordens finalizadas.
              </p>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={saveMut.isPending}>
            {saveMut.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Save className="size-4 mr-2" /> Salvar configurações
              </>
            )}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
