import { useEffect, useMemo, useState } from "react";
import { api } from "../api/http";
import { getAuthUser } from "../lib/auth";

type PaymentMethod = "ONLINE" | "CASH" | string;

type ApiMembership = {
  membership_id?: number;
  client_id?: number;
  type?: string;
  with_sauna?: boolean;
  price?: number;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  payment_status?: string;
  payment_method?: PaymentMethod;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(date?: string | null) {
  if (!date) return "-";
  if (DATE_ONLY_RE.test(date)) {
    const [y, m, dd] = date.split("-").map(Number);
    const d = new Date(y, m - 1, dd);
    return d.toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
  }
  const d = new Date(date);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-GB");
  return date;
}

function prettyType(t?: string) {
  if (!t) return "-";
  switch (t) {
    case "ONE_TIME_PASS":
      return "One-time pass";
    case "MONTHLY":
      return "Monthly";
    case "QUARTERLY":
      return "Quarterly";
    case "ANNUAL":
      return "Annual";
    default:
      return t;
  }
}

export default function MyMemberships() {
  const user = getAuthUser();
  const userId = useMemo(() => user?.userId, [user]);

  const [data, setData] = useState<ApiMembership[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await api.get<ApiMembership[]>(`/clients/${userId}/memberships`);
      setData(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <h1>My memberships</h1>
        <p>Please log in first.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>My memberships</h1>
      <p style={{ opacity: 0.85, marginTop: 6 }}>Your purchased memberships (history).</p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={load}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>

        <div style={{ opacity: 0.75 }}>{loading ? "Loading..." : data ? `${data.length} memberships` : ""}</div>
      </div>

      {error && (
        <pre
          style={{
            marginTop: 14,
            background: "rgba(255,0,0,0.08)",
            padding: 12,
            borderRadius: 12,
            overflowX: "auto",
            color: "tomato",
          }}
        >
          {error}
        </pre>
      )}

      {!error && !data && <p style={{ marginTop: 14, opacity: 0.8 }}>Loading...</p>}
      {data && data.length === 0 && !loading && <p style={{ marginTop: 14, opacity: 0.8 }}>No memberships found.</p>}

      {data && data.length > 0 && (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {data.map((m) => (
            <div
              key={String(m.membership_id ?? Math.random())}
              style={{
                padding: 14,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  {prettyType(m.type)} {m.with_sauna ? "· Gym + Sauna" : "· Gym"}
                </div>
                <div style={{ opacity: 0.8, fontSize: 13 }}>ID: {m.membership_id ?? "-"}</div>
              </div>

              <div style={{ opacity: 0.9 }}>
                {formatDate(m.start_date)} → {formatDate(m.end_date)}
              </div>

              <div style={{ opacity: 0.85, fontSize: 13 }}>
                Payment: <b>{String(m.payment_method ?? "-")}</b> · status: <b>{m.payment_status ?? "-"}</b>
              </div>

              {typeof m.price === "number" && (
                <div style={{ opacity: 0.85, fontSize: 13 }}>
                  Price: <b>{m.price}</b>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
