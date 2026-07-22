import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, LogIn, KeyRound } from "lucide-react";
import { fetchUserRoles, homeForRoles } from "@/lib/route-guards";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — CarnePro" },
      { name: "description", content: "Acesso ao CarnePro — sistema de gestão de desossa." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const roles = await fetchUserRoles(data.user.id);
        navigate({ to: homeForRoles(roles), replace: true });
      }
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Falha ao entrar", { description: error.message });
      return;
    }
    const { data: userRes } = await supabase.auth.getUser();
    if (userRes.user) {
      const roles = await fetchUserRoles(userRes.user.id);
      toast.success("Bem-vindo!");
      navigate({ to: homeForRoles(roles), replace: true });
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("Informe seu e-mail primeiro.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível enviar", { description: error.message });
      return;
    }
    toast.success("E-mail enviado", { description: "Verifique sua caixa de entrada." });
    setMode("login");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Lado visual */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary via-primary to-[oklch(0.35_0.18_15)] text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 21px)",
        }} />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="size-11 bg-white/15 backdrop-blur rounded-md flex items-center justify-center font-bold text-xl border border-white/20">
              C
            </div>
            <div>
              <div className="font-bold tracking-tight text-2xl leading-none">CARNEPRO</div>
              <div className="text-[10px] uppercase tracking-widest opacity-80 mt-1">
                Sistema de Gestão de Desossa
              </div>
            </div>
          </div>
        </div>
        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold leading-tight max-w-md">
            Controle total do processo de desossa em tempo real.
          </h2>
          <div className="grid grid-cols-3 gap-4 max-w-md">
            <Stat label="Aproveitamento" value="74,7%" />
            <Stat label="Ordens/dia" value="18" />
            <Stat label="Divergência" value="0,3kg" />
          </div>
        </div>
        <div className="relative text-xs uppercase tracking-widest opacity-70">
          Rendimento · Precificação · Conciliação
        </div>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3">
              <div className="size-11 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-xl">
                C
              </div>
              <div className="text-left">
                <div className="font-bold tracking-tight text-xl leading-none">
                  CARNE<span className="text-primary">PRO</span>
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                  Gestão de Desossa
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "login" ? "Bem-vindo de volta" : "Recuperar acesso"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Entre com suas credenciais para acessar o sistema."
                : "Enviaremos um link de redefinição para o seu e-mail."}
            </p>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-l">E-mail</Label>
                <Input
                  id="email-l"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@acougue.com"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pw-l">Senha</Label>
                  <button
                    type="button"
                    onClick={() => setMode("reset")}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="pw-l"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted-foreground hover:text-foreground"
                    aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="size-4 mr-2" /> Entrar
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-r">E-mail cadastrado</Label>
                <Input
                  id="email-r"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@acougue.com"
                  className="h-11"
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <KeyRound className="size-4 mr-2" /> Enviar link de redefinição
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                ← Voltar
              </button>
            </form>
          )}

          <p className="text-center text-[11px] text-muted-foreground mt-8">
            Acesso restrito · Somente usuários cadastrados pelo administrador
          </p>
          <p className="text-center text-xs text-muted-foreground mt-4">
            <Link to="/" className="hover:text-foreground">
              ← Voltar à página inicial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-md p-3 border border-white/15">
      <div className="text-[10px] uppercase tracking-widest opacity-80">{label}</div>
      <div className="font-mono font-bold text-lg leading-tight">{value}</div>
    </div>
  );
}
