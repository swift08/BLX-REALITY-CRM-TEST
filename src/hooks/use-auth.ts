import { useEffect, useState, useCallback } from "react";

export type AppRole = "super_admin" | "admin" | "sales_executive" | "manager";

export interface AuthState {
  session: any | null;
  user: any | null;
  role: AppRole | null;
  userId: string | null;
  loading: boolean;
}

async function callApi(action: string, payload: any = {}): Promise<any> {
  let token = "";
  let refreshToken = "";
  if (typeof window !== "undefined") {
    const sessionStr = localStorage.getItem("blx-realty-session");
    if (sessionStr) {
      try {
        const parsed = JSON.parse(sessionStr);
        token = parsed.access_token || "";
        refreshToken = parsed.refresh_token || "";
      } catch (_) {
        // Ignore JSON parse errors for invalid sessions
      }
    }
  }

  let res = await fetch("/api/crm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, payload }),
  });

  // Handle Token Expiration
  if (res.status === 401 && action !== "refreshSession") {
    if (refreshToken && typeof window !== "undefined") {
      try {
        const refreshRes = await fetch("/api/crm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "refreshSession",
            payload: { refreshToken },
          }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.session) {
            localStorage.setItem("blx-realty-session", JSON.stringify(refreshData.session));
            const newToken = refreshData.session.access_token;

            // Retry the original request
            res = await fetch("/api/crm", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${newToken}`,
              },
              body: JSON.stringify({ action, payload }),
            });
          }
        }
      } catch (err) {
        console.error("Token refresh failed:", err);
      }
    }

    // If still 401, redirect to login
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("blx-realty-session");
      localStorage.removeItem("blx-realty-active-role");
      window.location.href = "/auth";
      throw new Error("Authentication expired. Please sign in again.");
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "API request failed");
  }
  return res.json();
}

export function useAuth(): AuthState & {
  signOut: () => Promise<void>;
  changeRole: (role: AppRole) => Promise<void>;
} {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    role: null,
    userId: null,
    loading: true,
  });

  const syncAuth = useCallback((session: any | null) => {
    if (session) {
      const user = session.user;
      const savedRole =
        (localStorage.getItem("blx-realty-active-role") as AppRole) ||
        user?.user_metadata?.role ||
        "super_admin";

      setState({
        session,
        user,
        role: savedRole,
        userId: user?.id || null,
        loading: false,
      });
    } else {
      setState({ session: null, user: null, role: null, userId: null, loading: false });
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("blx-realty-session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        syncAuth(parsed);
      } catch (e) {
        setState({ session: null, user: null, role: null, userId: null, loading: false });
      }
    } else {
      setState({ session: null, user: null, role: null, userId: null, loading: false });
    }
  }, [syncAuth]);

  const signOut = useCallback(async () => {
    // Capture token before clearing storage
    const sessionStr = localStorage.getItem("blx-realty-session");
    let token = "";
    if (sessionStr) {
      try {
        const parsed = JSON.parse(sessionStr);
        token = parsed.access_token || "";
      } catch (_) {
        // Ignore JSON parse errors for invalid sessions
      }
    }
    localStorage.removeItem("blx-realty-session");
    localStorage.removeItem("blx-realty-active-role");
    try {
      // Send token so server can audit the logout
      await fetch("/api/crm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "signOut", payload: {} }),
      });
    } catch (e) {
      console.error("Sign out error:", e);
    }
    setState({ session: null, user: null, role: null, userId: null, loading: false });
  }, []);

  const changeRole = useCallback(
    async (role: AppRole) => {
      localStorage.setItem("blx-realty-active-role", role);

      const sessionStr = localStorage.getItem("blx-realty-session");
      if (sessionStr) {
        try {
          const parsed = JSON.parse(sessionStr);
          if (parsed.user?.id) {
            await callApi("updateUserRole", { userId: parsed.user.id, role });
          }
          if (parsed.user?.user_metadata) {
            parsed.user.user_metadata.role = role;
          }
          localStorage.setItem("blx-realty-session", JSON.stringify(parsed));
          syncAuth(parsed);
        } catch (e) {
          console.error("Change role error:", e);
        }
      }
      window.location.href = "/";
    },
    [syncAuth],
  );

  return { ...state, signOut, changeRole };
}
