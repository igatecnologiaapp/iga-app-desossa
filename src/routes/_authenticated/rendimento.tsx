import { createFileRoute } from "@tanstack/react-router";
import { assertAnyRole } from "@/lib/route-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ListTree, Scissors } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/rendimento")({
  head: () => ({
    meta: [
      { title: "Rendimento Esperado — CarnePro" },
      { name: "description", content: "Tabela de cortes por peça de entrada e rendimento esperado." },
    ],
  }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin"]),
  component: Rendimento,
});

function Rendimento() {
  const qc = useQueryClient();
  const [selectedPeca, setSelectedPeca] = useState<string>("");
  const [addingCorte, setAddingCorte] = useState<string>("");
  const [rendimento, setRendimento] = useState<string>("");

  const { data: pecas = [] } = useQuery({
    queryKey: ["pecas-entrada-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pecas_entrada")
        .select("id, name, category_id, product_categories:category_id(name)")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: cortesAll = [] } = useQuery({
    queryKey: ["cortes-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cortes")
        .select("id, name, code, category_id")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ["peca-cortes", selectedPeca],
    enabled: !!selectedPeca,
    queryFn: async () => {
      const { data } = await supabase
        .from("peca_cortes")
        .select("id, corte_id, rendimento_esperado_pct, cortes:corte_id(name, code)")
        .eq("peca_id", selectedPeca);
      return data ?? [];
    },
  });

  const peca: any = pecas.find((p: any) => p.id === selectedPeca);
  const cortesElegiveis = (cortesAll as any[]).filter(
    (c) => !peca?.category_id || c.category_id === peca.category_id,
  );

  const addMut = useMutation({
    mutationFn: async () => {
      if (!selectedPeca || !addingCorte) throw new Error("Selecione o corte.");
      const { error } = await supabase.from("peca_cortes").insert({
        peca_id: selectedPeca,
        corte_id: addingCorte,
        rendimento_esperado_pct: rendimento ? Number(rendimento) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["peca-cortes", selectedPeca] });
      setAddingCorte("");
      setRendimento("");
      toast.success("Corte vinculado");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("peca_cortes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["peca-cortes", selectedPeca] });
      toast.success("Vínculo removido");
    },
  });

  return (
    <AppShell
      title="Rendimento Esperado"
      subtitle="Configure quais cortes podem ser produzidos a partir de cada peça de entrada"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-panel border rounded-lg p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ListTree className="size-4 text-primary" />
              <div className="font-bold">Peça de Entrada</div>
            </div>
            <Select value={selectedPeca} onValueChange={setSelectedPeca}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma peça" />
              </SelectTrigger>
              <SelectContent>
                {(pecas as any[]).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.product_categories?.name ? (
                      <span className="text-muted-foreground text-xs ml-2">
                        · {p.product_categories.name}
                      </span>
                    ) : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {peca ? (
              <div className="text-xs text-muted-foreground pt-2 border-t">
                {mappings.length} corte{mappings.length === 1 ? "" : "s"} configurado
                {mappings.length === 1 ? "" : "s"}
              </div>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!selectedPeca ? (
            <div className="bg-panel border rounded-lg p-12 text-center text-sm text-muted-foreground">
              Selecione uma peça para configurar seus cortes possíveis.
            </div>
          ) : (
            <>
              <div className="bg-panel border rounded-lg p-4 space-y-3">
                <div className="font-bold text-sm">Adicionar corte à peça</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select value={addingCorte} onValueChange={setAddingCorte}>
                    <SelectTrigger className="md:col-span-2">
                      <SelectValue placeholder="Selecione o corte" />
                    </SelectTrigger>
                    <SelectContent>
                      {cortesElegiveis.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          Nenhum corte na categoria.
                        </div>
                      ) : (
                        cortesElegiveis.map((c: any) => {
                          const alreadyIn = (mappings as any[]).some((m) => m.corte_id === c.id);
                          return (
                            <SelectItem key={c.id} value={c.id} disabled={alreadyIn}>
                              {c.name} {alreadyIn ? "· já vinculado" : ""}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Rendimento esperado (%)"
                    value={rendimento}
                    onChange={(e) => setRendimento(e.target.value)}
                  />
                </div>
                <Button onClick={() => addMut.mutate()} disabled={!addingCorte || addMut.isPending}>
                  <Plus className="size-4 mr-1" /> Adicionar
                </Button>
              </div>

              <div className="bg-panel border rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b font-bold text-sm">Cortes configurados</div>
                {mappings.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum corte vinculado ainda.
                  </div>
                ) : (
                  <div className="divide-y">
                    {(mappings as any[]).map((m) => (
                      <div key={m.id} className="px-6 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Scissors className="size-4 text-muted-foreground" />
                          <div>
                            <div className="font-semibold text-sm">{m.cortes?.name ?? "—"}</div>
                            {m.cortes?.code ? (
                              <div className="text-[10px] text-muted-foreground font-mono">{m.cortes.code}</div>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {m.rendimento_esperado_pct ? (
                            <span className="text-xs font-mono font-bold text-primary">
                              {m.rendimento_esperado_pct}%
                            </span>
                          ) : null}
                          <Button variant="ghost" size="icon" onClick={() => delMut.mutate(m.id)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
