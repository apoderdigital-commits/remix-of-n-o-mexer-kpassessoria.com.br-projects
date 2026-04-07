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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          // Check role
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id);

          const isAdmin = roles?.some((r) => r.role === "admin") ?? false;

          // Check if linked to a client
          let clientId: string | null = null;
          if (!isAdmin) {
            const { data: client } = await supabase
              .from("clients")
              .select("id")
              .eq("user_id", session.user.id)
              .maybeSingle();
            clientId = client?.id ?? null;
          }

          setState({ user: session.user, loading: false, isAdmin, clientId });
        } else {
          setState({ user: null, loading: false, isAdmin: false, clientId: null });
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setState({ user: null, loading: false, isAdmin: false, clientId: null });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
}
