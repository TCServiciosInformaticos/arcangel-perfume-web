import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { staffClient, type StaffAccount } from "@/lib/staff-client";
import { createStaffAccount } from "@/lib/staff.functions";
import { STAFF_MODULES, STAFF_LABELS, type StaffModule } from "@/lib/staff-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export const Route = createFileRoute("/_authenticated/admin/usuarios")({ component: Users });
function Modules({
  value,
  onChange,
  disabled,
}: {
  value: StaffModule[];
  onChange: (v: StaffModule[]) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="mb-2 font-medium">Módulos permitidos</legend>
      {STAFF_MODULES.map((m) => (
        <label key={m} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.includes(m)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, m] : value.filter((v) => v !== m))
            }
          />
          {STAFF_LABELS[m]}
        </label>
      ))}
    </fieldset>
  );
}
function Users() {
  const { isAdmin, session } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modules, setModules] = useState<StaffModule[]>([]);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["admin", "staff"],
    enabled: isAdmin,
    queryFn: async () => {
      const r = await staffClient.from("staff_accounts").select("*").order("name");
      if (r.error) throw r.error;
      return r.data;
    },
  });
  if (!isAdmin) return <p>Solo el administrador puede gestionar usuarios.</p>;
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Usuarios</h1>
      <p className="text-sm text-muted-foreground">
        Creá cuentas individuales para el personal. Usuarios, estadísticas y herramientas con costos
        quedan reservados al administrador. Desactivar una cuenta retira sus permisos de empleado,
        conservando el historial.
      </p>
      <form
        className="max-w-xl space-y-4 rounded-xl border bg-card p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!session?.access_token) return;
          setBusy(true);
          try {
            await createStaffAccount({
              data: { accessToken: session.access_token, name, email, password, modules },
            });
            setName("");
            setEmail("");
            setPassword("");
            setModules([]);
            await qc.invalidateQueries({ queryKey: ["admin", "staff"] });
            toast.success(
              "Empleado creado. Entregale su contraseña por un canal privado; no se envió correo.",
            );
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo crear el empleado");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="text-lg font-medium">Nuevo empleado</h2>
        <label className="block text-sm">
          Nombre
          <Input
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="block text-sm">
          Correo
          <Input
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="block text-sm">
          Contraseña inicial (mínimo 12 caracteres)
          <Input
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </label>
        <Modules value={modules} onChange={setModules} disabled={busy} />
        <p className="text-xs text-muted-foreground">
          Sin módulos seleccionados, la cuenta no puede ingresar al panel.
        </p>
        <Button disabled={busy}>{busy ? "Creando…" : "Crear empleado"}</Button>
      </form>
      <h2 className="text-xl font-medium">Personal</h2>
      {q.isPending ? (
        <p>Cargando usuarios…</p>
      ) : q.isError ? (
        <p role="alert">
          No se pudieron cargar los empleados.{" "}
          <Button variant="outline" onClick={() => q.refetch()}>
            Reintentar
          </Button>
        </p>
      ) : q.data?.length === 0 ? (
        <p>Todavía no hay empleados creados.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data?.map((u) => (
            <Employee key={u.user_id + u.updated_at} employee={u} />
          ))}
        </div>
      )}
    </div>
  );
}
function Employee({ employee: u }: { employee: StaffAccount }) {
  const qc = useQueryClient();
  const [name, setName] = useState(u.name);
  const [modules, setModules] = useState(u.modules);
  const [enabled, setEnabled] = useState(u.enabled);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await staffClient.rpc("admin_save_staff", {
            employee_id: u.user_id,
            employee_name: name,
            allowed_modules: modules,
            active: enabled,
            expected_version: u.updated_at,
          });
          if (r.error) throw r.error;
          await qc.invalidateQueries({ queryKey: ["admin", "staff"] });
          toast.success("Permisos guardados");
        } catch (e) {
          toast.error(
            e instanceof Error
              ? e.message
              : ((e as { message?: string })?.message ?? "No se pudieron guardar los permisos"),
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="break-all text-sm">{u.email}</p>
      <label className="block text-sm">
        Nombre
        <Input
          required
          minLength={2}
          maxLength={120}
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Acceso de empleado activo
      </label>
      <Modules value={modules} onChange={setModules} disabled={busy} />
      <Button disabled={busy}>{busy ? "Guardando…" : "Guardar permisos"}</Button>
    </form>
  );
}
