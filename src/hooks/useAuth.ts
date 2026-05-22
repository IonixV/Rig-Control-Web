import { useState, useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";

export type AuthState =
  | "unknown"
  | "authenticated"
  | "unauthenticated"
  | "must-change-password";

export interface AuthUser {
  callsign: string;
  role: "admin" | "regular";
}

interface UseAuthReturn {
  authState: AuthState;
  currentUser: AuthUser | null;
  mustChangePassword: boolean;
  loginError: string;
  retryAfter: number;
  login: (callsign: string, password: string) => void;
  logout: () => void;
  onPasswordChanged: () => void;
}

export function useAuth(socket: Socket | null): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>("unknown");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    if (!socket) return;

    const onAuthRequired = () => {
      setAuthState("unauthenticated");
      setCurrentUser(null);
    };

    const onTokenRefreshed = ({
      token,
      callsign,
      role,
      mustChangePassword,
    }: {
      token: string;
      callsign?: string;
      role?: "admin" | "regular";
      mustChangePassword?: boolean;
    }) => {
      localStorage.setItem("auth-token", token);
      if (callsign && role) {
        setCurrentUser({ callsign, role });
      }
      if (mustChangePassword) {
        setMustChangePassword(true);
        setAuthState("must-change-password");
      } else {
        setAuthState("authenticated");
      }
    };

    const onAuthResult = (data: {
      ok: boolean;
      token?: string;
      callsign?: string;
      role?: "admin" | "regular";
      mustChangePassword?: boolean;
      preferencesClearedAt?: string | null;
      error?: string;
      retryAfter?: number;
    }) => {
      if (data.ok && data.token && data.callsign && data.role) {
        localStorage.setItem("auth-token", data.token);
        if (data.preferencesClearedAt) {
          checkAndClearPreferences(data.callsign, data.preferencesClearedAt);
        }
        setCurrentUser({ callsign: data.callsign, role: data.role });
        setLoginError("");
        setRetryAfter(0);
        if (data.mustChangePassword) {
          setMustChangePassword(true);
          setAuthState("must-change-password");
        } else {
          setMustChangePassword(false);
          setAuthState("authenticated");
        }
      } else {
        setLoginError(data.error ?? "Login failed");
        setRetryAfter(data.retryAfter ?? 0);
      }
    };

    const onKicked = ({ reason }: { reason: string }) => {
      console.log(`[AUTH] Kicked: ${reason}`);
      localStorage.removeItem("auth-token");
      setAuthState("unauthenticated");
      setCurrentUser(null);
      setMustChangePassword(false);
    };

    const onPreferencesCleared = () => {
      if (currentUser) {
        clearUserPreferences(currentUser.callsign);
        window.location.reload();
      }
    };

    socket.on("auth:required", onAuthRequired);
    socket.on("auth:token-refreshed", onTokenRefreshed);
    socket.on("auth:result", onAuthResult);
    socket.on("auth:kicked", onKicked);
    socket.on("auth:preferences-cleared", onPreferencesCleared);

    return () => {
      socket.off("auth:required", onAuthRequired);
      socket.off("auth:token-refreshed", onTokenRefreshed);
      socket.off("auth:result", onAuthResult);
      socket.off("auth:kicked", onKicked);
      socket.off("auth:preferences-cleared", onPreferencesCleared);
    };
  }, [socket, currentUser]);

  // On socket reconnect, reset to unknown so the UI waits for auth:token-refreshed or auth:required
  useEffect(() => {
    if (!socket) return;
    let firstConnect = true;

    const onConnect = () => {
      if (firstConnect) { firstConnect = false; return; }
      setAuthState("unknown");
      setCurrentUser(null);
    };

    socket.on("connect", onConnect);
    return () => { socket.off("connect", onConnect); };
  }, [socket]);

  const login = useCallback(
    (callsign: string, password: string) => {
      if (!socket) return;
      setLoginError("");
      socket.emit("auth:login", { callsign, password });
    },
    [socket]
  );

  const logout = useCallback(() => {
    if (!socket) return;
    socket.emit("auth:logout");
    localStorage.removeItem("auth-token");
    setAuthState("unauthenticated");
    setCurrentUser(null);
    setMustChangePassword(false);
  }, [socket]);

  const onPasswordChanged = useCallback(() => {
    setMustChangePassword(false);
    setAuthState("authenticated");
  }, []);

  return {
    authState,
    currentUser,
    mustChangePassword,
    loginError,
    retryAfter,
    login,
    logout,
    onPasswordChanged,
  };
}

// ─── localStorage preference helpers ─────────────────────────────────────────

const NAMESPACED_KEYS = [
  "grid-layout-v1",
  "is-compact-smeter-collapsed",
  "is-compact-controls-collapsed",
  "is-compact-rfpower-collapsed",
  "console-collapsed",
  "pota-spots-collapsed",
  "sota-spots-collapsed",
  "wwff-spots-collapsed",
  "spots-combo-tab",
];

const PREFS_CLEARED_KEY = "prefs-cleared-at";

export function clearUserPreferences(callsign: string): void {
  const prefix = callsign.toUpperCase();
  NAMESPACED_KEYS.forEach((key) => {
    localStorage.removeItem(`${prefix}:${key}`);
  });
  localStorage.removeItem(`${prefix}:${PREFS_CLEARED_KEY}`);
}

export function checkAndClearPreferences(
  callsign: string,
  preferencesClearedAt: string
): void {
  const prefix = callsign.toUpperCase();
  const lastCleared = localStorage.getItem(`${prefix}:${PREFS_CLEARED_KEY}`);
  if (!lastCleared || new Date(preferencesClearedAt) > new Date(lastCleared)) {
    clearUserPreferences(callsign);
    localStorage.setItem(`${prefix}:${PREFS_CLEARED_KEY}`, new Date().toISOString());
  }
}

export function nsKey(callsign: string, key: string): string {
  return `${callsign.toUpperCase()}:${key}`;
}
