import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, onSignedOut } from "../api";
import type { Role } from "../roles";

export type User = {
  id: string;
  role: Role;
  name: string;
  email: string;
  timezone: string;
  title: string | null;
  bio: string | null;
};

export type SignUpInput = {
  role: Role;
  name: string;
  email: string;
  password: string;
  timezone: string;
  title?: string;
  bio?: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signUp: (input: SignUpInput) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onSignedOut(() => setUser(null)), []);

  useEffect(() => {
    let active = true;
    api<{ user: User }>("/auth/me")
      .then(({ user }) => {
        if (active) setUser(user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const data = await api<{ user: User }>("/auth/signup", { method: "POST", body: input });
    setUser(data.user);
  }, []);

  const logIn = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: User }>("/auth/login", { method: "POST", body: { email, password } });
    setUser(data.user);
  }, []);

  const logOut = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST", body: {} });
    } catch {
      // Clear the session on this screen even if the server call failed.
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signUp, logIn, logOut }),
    [user, loading, signUp, logIn, logOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
