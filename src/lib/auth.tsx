import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "field_agent";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: Role | null;
  fullName: string;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProfileAndRole = async (uid: string, email: string | undefined) => {
    const [{ data: roleRow }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
    ]);

    let resolvedRole = (roleRow?.role as Role | undefined) ?? null;

    // Auto-link approved signup requests by email → assign role on first login
    if (!resolvedRole && email) {
      const { data: req } = await supabase
        .from("signup_requests")
        .select("id, status, requested_role")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      if (req?.status === "approved") {
        await supabase
          .from("user_roles")
          .insert({ user_id: uid, role: req.requested_role });
        await supabase
          .from("signup_requests")
          .update({ user_id: uid })
          .eq("id", req.id);
        resolvedRole = req.requested_role as Role;
      }
    }

    setRole(resolvedRole);
    setFullName(profile?.full_name ?? "");
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadProfileAndRole(sess.user.id, sess.user.email), 0);
      } else {
        setRole(null);
        setFullName("");
      }
    });
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user)
        loadProfileAndRole(sess.user.id, sess.user.email).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };
  const signOut = async () => {
    await supabase.auth.signOut();
  };
  const refreshRole = async () => {
    if (user) await loadProfileAndRole(user.id, user.email);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, role, fullName, loading, signIn, signOut, refreshRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
