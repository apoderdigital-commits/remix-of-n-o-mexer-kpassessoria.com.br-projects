import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  clientId: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAdmin: false,
    clientId: null,
  });

  useEffect(() => {
    let isMounted = true;

    const applyAuthState = async (user: User | null) => {
      if (!isMounted) return;

      if (!user) {
        setState({ user: null, loading: false, isAdmin: false, clientId: null });
        return;
      }

      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const isAdmin = roles?.some((role) => role.role === "admin") ?? false;

        let clientId: string | null = null;
        if (!isAdmin) {
          const { data: client } = await supabase
            .from("clients")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          clientId = client?.id ?? null;
        }

        if (!isMounted) return;
        setState({ user, loading: false, isAdmin, clientId });
      } catch (error) {
        console.error("Erro ao carregar autenticação:", error);

        if (!isMounted) return;
        setState({ user, loading: false, isAdmin: false, clientId: null });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void applyAuthState(session?.user ?? null);
      }
    );

    void supabase.auth.getSession().then(({ data: { session } }) => {
      void applyAuthState(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
}
