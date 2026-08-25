"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  acceptAuthSession,
  apiRequest,
  AuthResponse,
  AuthSessionMetadata,
  AuthUser,
  configureAuthCallbacks,
  logoutSession,
  refreshSession,
} from "../lib/api";
import { getSafeInternalRedirect } from "../lib/navigation";

interface LoginData {
  email?: string;
  phone?: string;
  password: string;
}

interface RegisterData extends LoginData {
  role: "CUSTOMER" | "PARTNER";
  fullName: string;
  companyName?: string;
  taxCode?: string;
  representative?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (loginData: LoginData, redirectTo?: string) => Promise<void>;
  register: (registerData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
}

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSessionMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const lastHeartbeatAt = useRef(0);
  const router = useRouter();

  const applySession = useCallback((auth: AuthResponse) => {
    setUser(auth.user);
    setSession(auth.session);
  }, []);

  const endClientSession = useCallback(() => {
    setUser(null);
    setSession(null);
  }, []);

  const redirectAfterSessionEnd = useCallback(() => {
    endClientSession();
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/register") {
        router.replace("/login");
      }
    }
  }, [endClientSession, router]);

  useEffect(() => {
    let active = true;
    const removeCallbacks = configureAuthCallbacks({
      onSessionUpdated: (auth) => {
        if (active) applySession(auth);
      },
      onSessionEnded: () => {
        if (active) redirectAfterSessionEnd();
      },
    });

    void refreshSession()
      .then((auth) => {
        if (active) applySession(auth);
      })
      .catch(() => {
        if (active) endClientSession();
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      removeCallbacks();
    };
  }, [applySession, endClientSession, redirectAfterSessionEnd]);

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      endClientSession();
      router.replace("/login");
    }
  }, [endClientSession, router]);

  useEffect(() => {
    if (!user || !session) {
      return;
    }

    const absoluteDeadline = Date.parse(session.absoluteExpiresAt);
    let idleDeadline = Date.parse(session.idleExpiresAt);
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const expire = () => {
      if (!disposed) void logout();
    };
    const armIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(expire, Math.max(0, idleDeadline - Date.now()));
    };
    const syncActivity = async () => {
      try {
        const updated = await apiRequest<AuthSessionMetadata>(
          "/auth/activity",
          {
            method: "POST",
          },
        );
        if (!disposed) {
          idleDeadline = Date.parse(updated.idleExpiresAt);
          setSession(updated);
          armIdleTimer();
        }
      } catch {
        if (!disposed) expire();
      }
    };
    const recordActivity = () => {
      const now = Date.now();
      if (now >= idleDeadline || now >= absoluteDeadline) {
        expire();
        return;
      }

      idleDeadline = Math.min(now + IDLE_TIMEOUT_MS, absoluteDeadline);
      armIdleTimer();
      if (now - lastHeartbeatAt.current >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatAt.current = now;
        void syncActivity();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        recordActivity();
      }
    };

    armIdleTimer();
    const absoluteTimer = setTimeout(
      expire,
      Math.max(0, absoluteDeadline - Date.now()),
    );
    window.addEventListener("pointerdown", recordActivity, { passive: true });
    window.addEventListener("keydown", recordActivity);
    window.addEventListener("scroll", recordActivity, { passive: true });
    window.addEventListener("touchstart", recordActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      if (idleTimer) clearTimeout(idleTimer);
      clearTimeout(absoluteTimer);
      window.removeEventListener("pointerdown", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("scroll", recordActivity);
      window.removeEventListener("touchstart", recordActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [logout, session, user]);

  const login = async (loginData: LoginData, redirectTo?: string) => {
    setLoading(true);
    try {
      const auth = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginData),
      });
      acceptAuthSession(auth);
      applySession(auth);

      const customerRedirect =
        auth.user.role === "CUSTOMER"
          ? getSafeInternalRedirect(redirectTo)
          : undefined;

      if (customerRedirect) {
        router.push(customerRedirect);
      } else if (auth.user.role === "ADMIN") {
        router.push("/admin");
      } else if (auth.user.role === "PARTNER") {
        router.push("/partner");
      } else if (auth.user.role === "PARTNER_STAFF") {
        router.push("/partner/redeem");
      } else {
        router.push("/");
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (registerData: RegisterData) => {
    setLoading(true);
    try {
      await apiRequest<void>("/auth/register", {
        method: "POST",
        body: JSON.stringify(registerData),
      });
      if (registerData.role === "CUSTOMER") {
        await login({
          email: registerData.email,
          phone: registerData.phone,
          password: registerData.password,
        });
      } else {
        router.push("/login?registered=partner");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth phải được đặt trong AuthProvider");
  }
  return context;
};
