import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ user: null, session: null, isAdmin: false, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, session: null, isAdmin: false, loading: true });

  useEffect(() => {
    let unsub = () => {};
    async function checkAdmin(userId: string | undefined): Promise<boolean> {
      if (!userId) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      return !!data;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const isAdmin = await checkAdmin(data.session?.user.id);
      setState({ user: data.session?.user ?? null, session: data.session, isAdmin, loading: false });
    });

    const sub = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED" && event !== "INITIAL_SESSION") return;
      const isAdmin = session?.user.id ? await checkAdmin(session.user.id) : false;
      setState({ user: session?.user ?? null, session, isAdmin, loading: false });
    });
    unsub = () => sub.data.subscription.unsubscribe();
    return unsub;
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
