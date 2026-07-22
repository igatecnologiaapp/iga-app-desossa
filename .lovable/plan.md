# Fases 4–8 — MEATPRO como plataforma fiel de gestão de desossa

Objetivo: consolidar o MEATPRO como simulação fiel da operação de um açougue, com fluxo end-to-end, cálculos server-side, rastreabilidade completa e experiência mobile enxuta. Sem novas telas desnecessárias — foco em consistência, reuso e arquitetura preparada para ERP.

---

## Princípios de arquitetura (aplicados a todas as fases)

- **Zero duplicação**: antes de criar componente/hook/server fn, procurar equivalente. Refatorar antes de adicionar.
- **Regras de negócio no servidor**: todo cálculo relevante (rendimento, divergência, custo, preço, agregações) em `createServerFn`. Frontend apenas consome DTOs.
- **Hooks centralizam lógica de UI**: `useReconciliation`, `usePricing`, `useOrderStatus`, `useDashboardFilters`, `useNotifications`, `usePermissions` (existente).
- **Componentização**: KPI card, ranking bar, timeline, painel de conciliação, filtros globais, dialog padrão — reaproveitados em desktop, mobile e relatórios.
- **Design system existente**: tokens, tipografia, espaçamentos e ícones já definidos; nenhuma tela nova quebra o padrão.
- **Escalabilidade**: colunas e nomenclatura preparadas para multiempresa (`tenant_id` já presente), lotes, códigos de barras, balanças (via `WeightInput` existente), etiquetas.
- **Sem regressão**: checklist funcional ao fim de cada fase; `tsgo --noEmit` limpo.

---

## Fase 4 — Fluxo operacional end-to-end com rastreabilidade

**Vínculo obrigatório Entrada → Ordem**
- `deboning_orders.stock_entry_id` passa a ser NOT NULL (migration com backfill para ordens legadas via `is_demo`/limpeza controlada).
- Criação de ordem exige selecionar uma Entrada de Mercadoria; peça, fornecedor, peso recebido e lote (quando houver) herdam da entrada e ficam somente-leitura na ordem.
- `stock_entries` ganha campo `lote` (opcional) e `saldo_disponivel_kg` (calculado) para impedir criar ordens com peso inicial > saldo.

**Identificação sequencial**
- Sequence `deboning_order_seq` por tenant + função `next_order_code(tenant)` retornando `OD-000001`. Gerada server-side no `createOrder`; nunca no cliente.
- Cabeçalho da ordem exibe: código, data, hora, responsável, fornecedor, peça, lote.

**Transições e histórico**
- Server functions dedicadas: `createOrder`, `assignOrder`, `startOrder`, `addPiece`, `updatePiece`, `deletePiece`, `updateLosses`, `updatePesoInicial`, `updateValorCompra`, `updateMargem`, `finishOrder`, `cancelOrder`. Cada uma:
  - valida permissão (has_role) e estado atual;
  - persiste alteração;
  - grava `deboning_order_history` com `user_id`, `event_type`, `field`, `old_value`, `new_value`, `created_at`;
  - dispara `notifications` para o público correto;
  - retorna DTO atualizado para invalidação de cache.
- Realtime apenas em `notifications` (canal único no `__root.tsx`, teardown no unmount).
- Cache TanStack invalidado por chave após cada mutação: `orders`, `order-detail`, `notifications`, `dashboard-*`, `stock-entries`.

## Fase 5 — Conciliação em tempo real (server-side)

- Novo hook `useReconciliation` consome server fn `computeReconciliation(orderId)` OU, para inputs ainda não persistidos, executa fórmula pura idêntica à do servidor (mesma função exportada de `deboning-calcs.ts`, já usada nos dois lados).
- Painel único de conciliação (componente existente) atualiza em tempo real conforme cortes/perdas são digitados; cores de tolerância vindas de `tenant_settings`.
- Finalização bloqueada fora da tolerância exceto com justificativa (fluxo atual). Mensagens revisadas.

## Fase 6 — Dashboards e indicadores

**Filtros globais** (componente `<DashboardFilters>` reaproveitado em dashboard e relatórios): período, fornecedor, peça, categoria, açougueiro, funcionário.

**Indicadores operacionais** (server fn `getOperationalKpis(filters)`):
- kg processados dia/mês, nº de ordens no período, tempo médio de desossa por peça e por açougueiro, aproveitamento médio por categoria/fornecedor/peça, índice médio de perdas.

**Dashboard Executivo** (server fn `getExecutiveKpis(filters)`):
- Lucro estimado, receita estimada, custo médio por kg, melhor fornecedor, fornecedor com maior perda, melhor rendimento por peça, melhor rendimento por funcionário, peças mais processadas.

**Gráficos** (Recharts, componentes `<KpiCard>`, `<RankingBar>`, `<TrendLine>`, `<LossPie>`):
- Evolução mensal de rendimento e perdas (linha).
- Rankings top 5: fornecedores, açougueiros, peças com maior/menor rendimento.
- Composição de perdas.

Toda query agregada é server-side, com `requireSupabaseAuth` e agregação em SQL (não busca linhas cruas para agregar no cliente).

## Fase 7 — Precificação

- Server fn `computePricing({ orderId, margemPct })`: custo real por kg, preço sugerido, receita estimada (preço × aproveitado), lucro estimado (receita − valor compra).
- Hook `usePricing(orderId)` alimenta o simulador na tela de detalhe e um bloco resumido no dashboard executivo.
- Persistência de `valor_compra` e `margem_pct` gera evento no histórico com valor anterior/novo.
- `tenant_settings.margem_padrao_pct` continua sendo default.

## Fase 8 — Mobile + Modo Demonstração

**Mobile (prioridade máxima)** — fluxo mínimo de cliques:
```
Selecionar ordem → Confirmar peso inicial → [ Selecionar corte → Peso → Confirmar ]* → Perdas → Resumo → Finalizar
```
- Botões min 56px, teclado numérico (`inputMode="decimal"`), painel de conciliação sticky no topo.
- Feedback: toast curto + `navigator.vibrate(30)` ao confirmar corte.
- Tela de resumo lista cortes + perdas + status de conciliação com botão único "Finalizar desossa".
- Sem formulários longos; cada passo em uma tela.

**Modo Demonstração** (server fn admin-only `reloadDemoData`):
- Migration adiciona `is_demo boolean default false` nas tabelas semeadas.
- Seed idempotente: 3 fornecedores, 5 funcionários (2 açougueiros), 8 entradas em 60 dias, 12 ordens em estados variados (2 pendentes, 2 atribuídas, 2 em execução, 5 finalizadas OK, 1 com divergência), peças/perdas/histórico/notificações coerentes.
- Botão "Recarregar dados de demonstração" em `configuracoes` (admin), limpa apenas `is_demo=true` e recria.

---

## Preparação para evolução (sem implementar agora)

Colunas/estrutura já compatíveis: `lote` em entrada, `barcode` reservado em produtos/cortes, `WeightInput` já isolado para balança, `tenant_id` em toda linha, server fns idempotentes prontas para expor via API pública futura.

## Revisão técnica ao fim de cada fase

Checklist:
- [ ] Sem duplicação de código (componentes/hooks/server fns).
- [ ] Cálculos idênticos entre desktop, mobile, dashboard e relatórios.
- [ ] Cada transição: history + notification + cache invalidado.
- [ ] Filtros dos dashboards funcionam e são reaproveitados.
- [ ] Mobile navegável com uma mão.
- [ ] Permissões respeitadas em rota e em server fn.
- [ ] Sem regressão nas fases 1–3.
- [ ] `tsgo --noEmit` limpo; imports/arquivos órfãos removidos.
- [ ] Resumo técnico das melhorias entregue no fim da fase.

---

## Estrutura de pastas alvo

```
src/
  components/         # UI reutilizável (KpiCard, RankingBar, DashboardFilters, ...)
  hooks/              # useReconciliation, usePricing, useDashboardFilters, ...
  lib/
    orders.functions.ts        # createOrder, assign, start, addPiece, finish, ...
    dashboard.functions.ts     # getOperationalKpis, getExecutiveKpis, rankings
    pricing.functions.ts       # computePricing
    demo.functions.ts          # reloadDemoData
    deboning-calcs.ts          # fórmula pura compartilhada
    order-history.ts           # helpers de log (já existe, ampliado)
  routes/             # sem novas rotas nesta etapa
```

Arquivos grandes existentes (`ordens.$id.tsx`, `mobile/desossa.$id.tsx`) serão divididos em subcomponentes quando ultrapassarem responsabilidades claras.
