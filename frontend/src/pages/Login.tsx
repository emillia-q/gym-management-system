import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthUser, setAuthUser } from "../lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const existing = useMemo(() => getAuthUser(), []);
  const [clientId, setClientId] = useState(existing?.clientId?.toString() ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const id = Number(clientId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("Please enter a valid Client ID (positive number).");
      return;
    }

    setAuthUser({ clientId: id, email: email.trim() || undefined });
    navigate("/");
  }

  return (
    <div style={{ maxWidth: 420, padding: 24 }}>
      <h1>Login</h1>
      <p style={{ opacity: 0.85 }}>
        Temporary login for development: enter your Client ID.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          Client ID
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="e.g. 1"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Email (optional)
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        {error && <div style={{ color: "tomato" }}>{error}</div>}

        <button type="submit" style={{ padding: "10px 12px" }}>
          Sign in
        </button>
      </form>

      {/* Register link */}
      <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ opacity: 0.85 }}>Don&apos;t have an account?</span>
        <button
            type="button"
            onClick={() => navigate("/signup")}
            style={{ padding: "10px 12px" }}
        >
            Register
        </button>
    </div>
    </div>
  );
}
