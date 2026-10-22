import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { staffClient } from "./staff-client";
import { validStaffModules, type StaffModule } from "./staff-permissions";
import type { Session, User } from "@supabase/supabase-js";
type AuthState = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  modules: StaffModule[];
  loading: boolean;
};
const empty = {
  user: null,
  session: null,
  isAdmin: false,
  modules: [],
  loading: true,
} satisfies AuthState;
const AuthContext = createContext<AuthState>(empty);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(empty);
  const qc = useQueryClient();
  useEffect(() => {
    let alive = true;
    let serial = 0;
    let activeSession: Session | null = null;
    let fingerprint = "";
    const refresh = async (session: Session | null) => {
      const request = ++serial;
      activeSession = session;
      let isAdmin = false;
      let modules: StaffModule[] = [];
      try {
        if (session?.user.id) {
          const role = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .eq("role", "admin")
            .maybeSingle();
          isAdmin = !role.error && !!role.data;
          if (!isAdmin) {
            const r = await staffClient
              .from("staff_accounts")
              .select("modules,enabled")
              .eq("user_id", session.user.id)
              .maybeSingle();
            if (!r.error && r.data?.enabled) modules = validStaffModules(r.data.modules);
          }
        }
      } catch {
        isAdmin = false;
        modules = [];
      }
      if (!alive || request !== serial) return;
      const next = JSON.stringify([session?.user.id, isAdmin, modules]);
      if (next !== fingerprint) {
        qc.removeQueries({ queryKey: ["admin"] });
        fingerprint = next;
      }
      setState({ user: session?.user ?? null, session, isAdmin, modules, loading: false });
    };
    void supabase.auth.getSession().then(({ data }) => {
      if (serial === 0) void refresh(data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Keep API calls outside the auth callback's lock; serial guards stale sessions.
      serial++;
      activeSession = session;
      setState({
        user: session?.user ?? null,
        session,
        isAdmin: false,
        modules: [],
        loading: !!session,
      });
      setTimeout(() => {
        if (alive && activeSession === session) void refresh(session);
      }, 0);
    });
    const onFocus = () => {
      void refresh(activeSession);
    };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 60000);
    return () => {
      alive = false;
      serial++;
      subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [qc]);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  return useContext(AuthContext);
}
