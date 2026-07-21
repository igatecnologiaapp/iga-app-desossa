Vou construir o MVP do **CarnePro** — Sistema de Gestão de Desossa — usando a direção "ERP Estruturado" que você escolheu (sidebar branca, primary `#be123c`, fonte Inter + JetBrains Mono, tema claro).

## Escopo desta primeira entrega

O sistema é grande. Para a apresentação ao cliente, vou entregar de ponta a ponta o **fluxo operacional completo** (o que ele precisa ver funcionando), deixando cadastros auxiliares em nível funcional-porém-enxuto. Não vou fatiar em várias mensagens — entrego tudo agora.

### Backend (Lovable Cloud)
Vou ativar o Lovable Cloud e criar o schema já preparado para multi-tenant (coluna `tenant_id` em todas as tabelas + RLS), operando com um único tenant nesta versão:

- `tenants`, `profiles`, `user_roles` (enum: `admin`, `acougueiro`)
- `suppliers`, `employees`, `product_categories`, `products`
- `stock_entries` (entrada de produtos)
- `deboning_orders` (ordens de desossa) com status `pendente` / `em_andamento` / `finalizada`
- `deboning_pieces` (peças extraídas)
- `deboning_losses` (ossos, gordura, retalhos, descarte)
- Trigger para criar perfil + role no signup
- Função `has_role()` security-definer
- Seed automático das categorias (Dianteiro/Traseiro Bovino, Frango, Suíno, Ovino, Miúdos, Outros) e produtos de exemplo (Picanha, Contra Filé, Alcatra, Patinho, Acém, Paleta, Peito Frango, Pernil, etc.)

### Autenticação
- Email/senha (sem confirmação de email para agilizar demo)
- Google sign-in (via broker Lovable)
- Página `/auth` pública

### Áreas construídas

**Admin (desktop, layout ERP com sidebar):**
1. **Dashboard** — 4 KPIs (Desossas hoje, Peso recebido, Peso aproveitado, Rendimento %), gráfico de aproveitamento histórico (Recharts), tabela de ordens em andamento, ranking de fornecedores e açougueiros
2. **Fornecedores** — CRUD completo (Razão Social, CNPJ, contato, telefone, email, observações)
3. **Funcionários** — CRUD (nome, CPF, cargo, status). Criação de login separada em fluxo simplificado.
4. **Produtos & Categorias** — CRUD unificado com filtro por categoria
5. **Entrada de Produtos** — registro de peso bruto por fornecedor/produto/lote/nota
6. **Ordens de Desossa** — criar ordem (produto, fornecedor, peso inicial, açougueiro), listar por status, ver detalhes/conciliação
7. **Relatórios** — filtros por período/fornecedor/produto/funcionário/categoria, tabela + gráficos (exportação Excel/PDF fica para v2, conforme brief)

**Açougueiro (mobile-first):**
1. **Minhas Desossas** — cards das ordens atribuídas
2. **Execução da desossa** — header preto com produto + peso inicial + peso aproveitado em tempo real, lista de peças adicionadas, botão "Adicionar peça" (dialog com produto + peso + quantidade + obs), seção de perdas (ossos, gordura, retalhos, descarte, outros), rodapé fixo com saldo restante e "Finalizar Desossa"
3. **Conciliação automática** ao finalizar: Peso Inicial − peças − perdas = Saldo. Divergência > 2% destacada em vermelho.

### Cálculos automáticos
Rendimento %, Perda %, peso aproveitado/descartado, aproveitamento por fornecedor/produto/funcionário, custo por kg, preço sugerido (com margem configurável simples).

### Design System
Vou portar os tokens do protótipo direto para `src/styles.css` em `oklch`:
- Primary `#be123c` (vermelho industrial)
- Background `#f8fafc`, panels brancos, borders `#e2e8f0`
- Fontes Inter (UI) + JetBrains Mono (números tabulares)
- Sidebar branca com ícones Lucide, KPIs com `tabular-nums`, animação `fade-in` suave

### Rotas
```
/                            landing público com CTA "Entrar"
/auth                        login + cadastro
/_authenticated/
  ├─ dashboard               (admin)
  ├─ fornecedores
  ├─ funcionarios
  ├─ produtos
  ├─ entradas
  ├─ ordens                  (lista + criar + detalhe)
  ├─ ordens/$id
  ├─ relatorios
  └─ mobile/                 (interface do açougueiro)
      ├─ index               (Minhas Desossas)
      └─ desossa/$id         (execução)
```
Roteamento por role: açougueiros caem em `/mobile`; admins caem em `/dashboard`.

## Detalhes técnicos
- TanStack Start + Router + Query
- `createServerFn` com `requireSupabaseAuth` para mutations sensíveis
- RLS por `tenant_id` usando `has_tenant()` + `has_role()`
- shadcn/ui customizado com os tokens ERP
- Recharts para gráficos
- Responsivo total: sidebar colapsa em mobile via Sheet

## Fora de escopo desta versão (declarado)
- Exportação real Excel/PDF (marcado como "em breve")
- Multi-tenant switcher de UI (arquitetura pronta, sem UI ainda)
- Password reset flow (podemos adicionar depois se quiser)
- Cadastro de senha para açougueiro pelo admin com API Auth Admin — nesta versão o açougueiro faz o próprio signup e o admin vincula ele à lista de funcionários por email

Confirma que posso seguir com esse escopo?