import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  clientId: string | null;
  dashboards: string[];
  accessibleClientIds: string[];
  squadCount: number;
  hasCrm: boolean;
}

const INACTIVITY_TIMEOUT = 6 * 60 * 60 * 1000; // 6 hours in ms
const LAST_ACTIVITY_KEY = "last_activity_ts";

function trackActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAdmin: false,
    clientId: null,
    dashboards: [],
    accessibleClientIds: [],
    squadCount: 0,
    hasCrm: false,
  });

  useEffect(() => {
    let isMounted = true;

    const applyAuthState = async (user: User | null) => {
      if (!isMounted) return;

      if (!user) {
        setState({ user: null, loading: false, isAdmin: false, clientId: null, dashboards: [], accessibleClientIds: [], squadCount: 0, hasCrm: false });
        return;
      }

      // Check inactivity on load
      const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (lastActivity && Date.now() - Number(lastActivity) > INACTIVITY_TIMEOUT) {
        await supabase.auth.signOut();
        return;
      }
      trackActivity();

      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const isAdmin = roles?.some((role) => role.role === "admin") ?? false;

        let dashboards: string[] = [];
        if (!isAdmin) {
          const { data: dashAccess } = await supabase
            .from("user_dashboard_access")
            .select("dashboard_key")
            .eq("user_id", user.id);
          dashboards = (dashAccess || []).map((d) => d.dashboard_key);
        }

        let accessibleClientIds: string[] = [];
        let clientId: string | null = null;
        if (!isAdmin) {
          const { data: clientAccess } = await supabase
            .from("user_client_access")
            .select("client_id")
            .eq("user_id", user.id);
          accessibleClientIds = (clientAccess || []).map((ca) => ca.client_id);

          const { data: client } = await supabase
            .from("clients")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          clientId = client?.id ?? null;
          if (clientId && !accessibleClientIds.includes(clientId)) {
            accessibleClientIds.push(clientId);
          }
        }

        // Squad membership count (any user)
        const { count: squadCount } = await supabase
          .from("squad_members")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (!isMounted) return;
        setState({ user, loading: false, isAdmin, clientId, dashboards, accessibleClientIds, squadCount: squadCount || 0, hasCrm });
      } catch (error) {
        console.error("Erro ao carregar autenticação:", error);
        if (!isMounted) return;
        setState({ user, loading: false, isAdmin: false, clientId: null, dashboards: [], accessibleClientIds: [], squadCount: 0, hasCrm: false });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (_event === "SIGNED_IN") trackActivity();
        void applyAuthState(session?.user ?? null);
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        void applyAuthState(session?.user ?? null);
      })
      .catch((err) => {
        console.error("getSession falhou:", err);
        if (isMounted) setState({ user: null, loading: false, isAdmin: false, clientId: null, dashboards: [], accessibleClientIds: [], squadCount: 0, hasCrm: false });
      });

    // Fail-safe: se por qualquer motivo (sessão corrompida no localStorage,
    // chave rotacionada, rede) o getSession não resolver, libera a tela em 6s
    // para o usuário conseguir ver o login em vez de ficar em "Carregando...".
    const loadingSafetyTimeout = window.setTimeout(() => {
      if (!isMounted) return;
      setState((prev) => (prev.loading ? { ...prev, loading: false } : prev));
    }, 6000);

    // Track user activity
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    const onActivity = () => trackActivity();
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    // Check inactivity every 5 minutes
    const interval = setInterval(async () => {
      const last = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (last && Date.now() - Number(last) > INACTIVITY_TIMEOUT) {
        await supabase.auth.signOut();
      }
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(interval);
      clearTimeout(loadingSafetyTimeout);
    };
  }, []);

  const signOut = async () => {
    // Evita o login com biometria disparar sozinho logo após sair.
    try { sessionStorage.setItem("kp-bio-skip-once", "1"); } catch { /* sem sessionStorage */ }
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
}
