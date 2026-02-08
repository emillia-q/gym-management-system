import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/http";
import type { LoginRequestDto, LoginResponseDto } from "../api/types";
import { clearAuthUser, getAuthUser, setAuthUser } from "../lib/auth";

type DeleteResponse = { status?: string; message?: string };

export default function Login() {
  const navigate = useNavigate();

  const [user, setUser] = useState(() => getAuthUser());

  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [dangerLoading, setDangerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoggedIn = !!user;

  const isClient = user?.role === "CLIENT";
  const isReceptionist = user?.role === "RECEPTIONIST";
  const isManager = user?.role === "MANAGER";

  // keep in sync with localStorage changes
  useEffect(() => {
    const sync = () => {
      const u = getAuthUser();
      setUser(u);
      setEmail((prev) => (prev ? prev : u?.email ?? ""));
    };

    window.addEventListener("authchange", sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("authchange", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // ---- Styles ----
  const primaryBtn: React.CSSProperties = {
    padding: "11px 12px",
    textAlign: "left",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    cursor: "pointer",
  };

  const secondaryBtn: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    cursor: "pointer",
  };

  const dangerBtn: React.CSSProperties = {
    ...primaryBtn,
    border: "1px solid rgba(255,80,80,0.45)",
    background: "rgba(255,80,80,0.06)",
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const emailTrim = email.trim();
    if (!emailTrim || !emailTrim.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const payload: LoginRequestDto = { email: emailTrim, password };
      const res = await api.post<LoginResponseDto>("/login", payload);

      const newUser = {
        userId: res.user_id,
        role: res.role,
        firstName: res.first_name,
        email: emailTrim,
      };

      setAuthUser(newUser);
      setUser(newUser);

      // ✅ role-based redirect after login
      if (res.role === "RECEPTIONIST") navigate("/reception");
      else if (res.role === "MANAGER") navigate("/manager/classes");
      else navigate("/login");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearAuthUser();
    setUser(null);
    setPassword("");
    setError(null);
    navigate("/login");
  }

  async function deleteAccount() {
    // ✅ delete only for CLIENT (endpoint /clients/{id})
    if (!user?.userId || !isClient) return;

    setError(null);

    const pwd = window.prompt("To delete your account, please confirm your password:");
    if (pwd === null) return; // cancelled
    if (!pwd.trim()) {
      setError("Password is required to delete the account.");
      return;
    }

    const ok = window.confirm("This will permanently delete your account and related data. Continue?");
    if (!ok) return;

    setDangerLoading(true);
    try {
      await api.del<DeleteResponse>(`/clients/${user.userId}`, { password: pwd.trim() });

      clearAuthUser();
      setUser(null);
      navigate("/");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setDangerLoading(false);
    }
  }

  const displayName = user?.firstName?.trim() || user?.email?.trim() || "User";

  return (
    <div style={{ maxWidth: 560, padding: 24 }}>
      <h1>Login</h1>

      {error && (
        <div style={{ marginTop: 10, color: "tomato" }}>
          Error: {error}
        </div>
      )}

      {isLoggedIn ? (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Signed in as: <b>{displayName}</b>{" "}
            <span style={{ opacity: 0.85 }}>({user?.role ?? "?"})</span>
          </p>

          <div
            style={{
              marginTop: 18,
              padding: 18,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              display: "grid",
              gap: 12,
            }}
          >
            {/* ✅ RECEPTIONIST */}
            {isReceptionist && (
              <>
                <h2 style={{ margin: 0, fontSize: 18 }}>Receptionist panel</h2>

                <div style={{ display: "grid", gap: 10 }}>
                  <button type="button" onClick={() => navigate("/reception")} style={primaryBtn}>
                    Reception panel
                  </button>

                  <button type="button" onClick={() => navigate("/schedule")} style={primaryBtn}>
                    Timetable (view)
                  </button>
                </div>

                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                  Reception can sell memberships and reserve classes for clients.
                </div>
              </>
            )}

            {/* ✅ MANAGER */}
            {isManager && (
              <>
                <h2 style={{ margin: 0, fontSize: 18 }}>Manager panel</h2>

                <div style={{ display: "grid", gap: 10 }}>
                  <button type="button" onClick={() => navigate("/manager/classes")} style={primaryBtn}>
                    Create group classes
                  </button>

                  <button type="button" onClick={() => navigate("/schedule")} style={primaryBtn}>
                    Timetable (view)
                  </button>
                </div>

                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                  Manager creates group classes. Booking classes is for clients (or reception on behalf of clients).
                </div>
              </>
            )}

            {/* ✅ CLIENT */}
            {isClient && (
              <>
                <h2 style={{ margin: 0, fontSize: 18 }}>Client panel</h2>

                <div style={{ display: "grid", gap: 10 }}>
                  <button type="button" onClick={() => navigate("/my-bookings")} style={primaryBtn}>
                    My bookings (upcoming + history)
                  </button>

                  <button type="button" onClick={() => navigate("/schedule")} style={primaryBtn}>
                    Timetable
                  </button>

                  <button type="button" onClick={() => navigate("/pricing")} style={primaryBtn}>
                    Buy membership
                  </button>

                  <button type="button" onClick={() => navigate("/my-memberships")} style={primaryBtn}>
                    My memberships
                  </button>

                  <button type="button" onClick={() => navigate("/cancel-booking")} style={primaryBtn}>
                    Cancel a booking
                  </button>

                  <button
                    type="button"
                    onClick={deleteAccount}
                    disabled={dangerLoading}
                    style={{
                      ...dangerBtn,
                      opacity: dangerLoading ? 0.7 : 1,
                      cursor: dangerLoading ? "not-allowed" : "pointer",
                    }}
                    title="Permanently delete your account"
                  >
                    {dangerLoading ? "Deleting account..." : "Delete account"}
                  </button>
                </div>

                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                  This panel gives quick access to timetable, bookings and membership actions.
                </div>
              </>
            )}

            {/* fallback for unknown roles */}
            {!isClient && !isReceptionist && !isManager && (
              <>
                <h2 style={{ margin: 0, fontSize: 18 }}>User panel</h2>
                <div style={{ opacity: 0.8 }}>Role not supported yet.</div>
              </>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button type="button" onClick={logout} style={secondaryBtn}>
                Log out
              </button>

              <button type="button" onClick={() => navigate("/")} style={{ ...secondaryBtn, opacity: 0.9 }}>
                Back to News
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p style={{ opacity: 0.85, marginTop: 6 }}>Sign in using your email and password.</p>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <label>
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                }}
              />
            </label>

            <label>
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                }}
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...secondaryBtn,
                textAlign: "center",
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ opacity: 0.85 }}>Don&apos;t have an account?</span>
            <button type="button" onClick={() => navigate("/signup")} style={secondaryBtn}>
              Create account
            </button>
          </div>
        </>
      )}
    </div>
  );
}
