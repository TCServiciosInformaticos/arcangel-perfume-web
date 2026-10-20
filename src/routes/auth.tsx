import { createFileRoute, Link, useNavigate, type SearchSchemaInput } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: SearchSchemaInput & { next?: string }) => ({ next: oauthReturnPath(search.next) }),
  head: () => ({ meta: [
    { title: "Acceso · El Arcángel" },
    { name: "description", content: "Acceso a la administración de Perfumería El Arcángel." },
    { property: "og:title", content: "Acceso al panel — El Arcángel" },
    { property: "og:description", content: "Ingresá a tu cuenta de administración." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) {
      const destination = next && next !== "/" ? next : "/admin";
      navigate({ to: destination });
    }
  }, [loading, user, isAdmin, navigate, next]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.info("Sesión cerrada");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Sesión iniciada");
        const destination = next && next !== "/" ? next : "/admin";
        navigate({ to: destination });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: new URL(next === "/" ? "/admin" : next, window.location.origin).href },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("¡Cuenta creada exitosamente!");
          const destination = next && next !== "/" ? next : "/admin";
          navigate({ to: destination });
        } else {
          toast.success("Cuenta creada. Verificá tu correo o ingresá con tus credenciales.");
          setMode("signin");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al autenticar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
          {!loading && user && !isAdmin ? (
            <div className="text-center space-y-4">
              <h1 className="font-serif text-2xl text-foreground">Acceso restringido</h1>
              <p className="text-sm text-muted-foreground">
                Iniciaste sesión como <strong className="text-foreground">{user.email}</strong>, pero esta cuenta no tiene permisos de administrador.
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <Button variant="outline" onClick={handleSignOut} className="w-full">
                  Cerrar sesión e ingresar con otra cuenta
                </Button>
                <Link to="/" className="text-xs text-muted-foreground hover:text-primary pt-2 block">
                  ← Volver a la tienda
                </Link>
              </div>
            </div>
          ) : !loading && user && isAdmin ? (
            <div className="text-center space-y-4">
              <h1 className="font-serif text-2xl text-foreground">Redirigiendo...</h1>
              <p className="text-sm text-muted-foreground">
                Sesión activa como administrador ({user.email}).
              </p>
              <Button onClick={() => navigate({ to: next && next !== "/" ? next : "/admin" })} className="w-full">
                Ir al panel de administración
              </Button>
            </div>
          ) : (
            <>
              <h1 className="font-serif text-3xl text-foreground">
                {mode === "signin" ? "Acceso al panel" : "Crear cuenta admin"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Ingresá con tu email y contraseña."
                  : "La primera cuenta registrada se convierte automáticamente en administradora."}
              </p>

              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="admin@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Procesando…" : mode === "signin" ? "Ingresar" : "Crear cuenta"}
                </Button>
              </form>

              <Button
                variant="link"
                type="button"
                onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
                className="mt-4 w-full text-sm text-primary hover:underline"
              >
                {mode === "signin" ? "¿No tenés cuenta? Crear una" : "Ya tengo cuenta, ingresar"}
              </Button>

              <Link to="/" className="mt-6 block text-center text-xs text-muted-foreground hover:text-primary">
                ← Volver al sitio
              </Link>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
