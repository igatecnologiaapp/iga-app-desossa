import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, ClipboardList, Scale } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sistema de Gestão de Desossa para Açougues" },
      {
        name: "description",
        content:
          "Controle completo do processo de desossa: rendimento, perdas, ordens, fornecedores e produtividade em tempo real.",
      },
      { property: "og:title", content: "Sistema de Gestão de Desossa para Açougues" },
      {
        property: "og:description",
        content: "Controle completo do processo de desossa: rendimento, perdas, ordens, fornecedores e produtividade em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-panel">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="size-9 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">
              C
            </div>
            <div className="font-bold tracking-tight text-lg">
              CARNE<span className="text-primary">PRO</span>
            </div>
          </div>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-95 transition"
          >
            Entrar <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-panel px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-widest">
                <span className="size-1.5 rounded-full bg-success" /> MVP
              </div>
              <h1 className="mt-6 text-4xl lg:text-5xl font-bold tracking-tight text-balance">
                Cada quilo controlado. Cada corte contabilizado.
              </h1>
              <p className="mt-4 text-lg text-muted-foreground text-pretty max-w-lg">
                Da entrada da carne até a peça na balança: acompanhe rendimento,
                perdas e produtividade da sua desossa em tempo real, no desktop
                e no celular do açougueiro.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold"
                >
                  Acessar o sistema <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-xl border bg-panel shadow-sm p-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Peso Recebido", value: "1.240", unit: "kg" },
                  { label: "Aproveitado", value: "982,5", unit: "kg" },
                  { label: "Rendimento", value: "79,2", unit: "%" },
                  { label: "Ordens Hoje", value: "14", unit: "" },
                ].map((k) => (
                  <div key={k.label} className="rounded-md border p-4 bg-background">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {k.label}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="font-mono text-2xl font-bold">{k.value}</span>
                      <span className="text-xs text-muted-foreground">{k.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-20 grid md:grid-cols-3 gap-4">
            {[
              {
                icon: ClipboardList,
                title: "Ordens em tempo real",
                text: "Admin cria a ordem no desktop, o açougueiro executa no celular. Sem papel, sem retrabalho.",
              },
              {
                icon: Scale,
                title: "Conciliação automática",
                text: "Peso inicial menos peças e perdas. Divergências são destacadas antes de finalizar.",
              },
              {
                icon: BarChart3,
                title: "Indicadores que importam",
                text: "Rendimento por fornecedor, produto e açougueiro. Custo real por kg e preço sugerido.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-panel p-6">
                <f.icon className="size-6 text-primary" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground text-pretty">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t bg-panel">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} CarnePro · Sistema de Gestão de Desossa
        </div>
      </footer>
    </div>
  );
}
