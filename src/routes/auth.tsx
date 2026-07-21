import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Entrar — CarnePro" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "acougueiro">("admin");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
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
    // Roteia por role
    const { data: userRes } = await supabase.auth.getUser();
    if (userRes.user) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userRes.user.id);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      navigate({ to: isAdmin ? "/dashboard" : "/mobile", replace: true });
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, role },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Falha ao cadastrar", { description: error.message });
      return;
    }
    toast.success("Conta criada!", { description: "Faça login para continuar." });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="size-9 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">
              C
            </div>
            <div className="font-bold tracking-tight text-xl">
              CARNE<span className="text-primary">PRO</span>
            </div>
          </Link>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
            Sistema de Gestão de Desossa
          </p>
        </div>

        <div className="rounded-xl border bg-panel p-6 shadow-sm">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-6">
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw-l">Senha</Label>
                  <Input
                    id="pw-l"
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name-s">Nome completo</Label>
                  <Input
                    id="name-s"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-s">E-mail</Label>
                  <Input
                    id="email-s"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw-s">Senha</Label>
                  <Input
                    id="pw-s"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Perfil</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole("admin")}
                      className={`rounded-md border px-3 py-2 text-sm font-medium ${role === "admin" ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"}`}
                    >
                      Administrador
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("acougueiro")}
                      className={`rounded-md border px-3 py-2 text-sm font-medium ${role === "acougueiro" ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"}`}
                    >
                      Açougueiro
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    O admin gerencia cadastros e ordens; o açougueiro executa
                    desossas no celular.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link to="/" className="hover:text-foreground">
            ← Voltar
          </Link>
        </p>
      </div>
    </div>
  );
}
