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

  const loadProfileAndRole = async (uid: string) => {
    const [{ data: roleRow }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
    ]);
    setRole((roleRow?.role as Role) ?? "field_agent");
    setFullName(profile?.full_name ?? "");
  };

  useEffect(() => {
    // 1. Listener first
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadProfileAndRole(sess.user.id), 0);
      } else {
        setRole(null);
        setFullName("");
      }
    });
    // 2. Then existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadProfileAndRole(sess.user.id).finally(() => setLoading(false));
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
    if (user) await loadProfileAndRole(user.id);
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
