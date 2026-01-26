import { useEffect, useMemo, useState } from "react";

type GroupClass = {
  id_c?: number;          // in case API returns id_c
  id?: number;            // fallback
  max_capacity?: number;

  // If inheritance returns these from Classes table:
  name?: string;
  start_time?: string;    // could be ISO string
  room?: string;

  // sometimes APIs return different names:
  class_name?: string;
};

function getId(c: GroupClass) {
  return Number(c.id_c ?? c.id ?? 0);
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  // If it's ISO datetime
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString();
  }
  // If it's already readable
  return value;
}

export default function Schedule() {
  const [items, setItems] = useState<GroupClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // simple UI helpers
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) => {
      const name = (c.name ?? c.class_name ?? "").toLowerCase();
      const room = (c.room ?? "").toLowerCase();
      return name.includes(s) || room.includes(s);
    });
  }, [items, q]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule/classes");
      const text = await res.text();

      let data: any = [];
      try {
        data = JSON.parse(text);
      } catch {
        // ignore
      }

      if (!res.ok) {
        const msg =
          (typeof data?.detail === "string" && data.detail) ||
          text ||
          `Failed to load timetable (HTTP ${res.status})`;
        throw new Error(msg);
      }

      if (!Array.isArray(data)) {
        throw new Error("API did not return an array. Show me the response JSON.");
      }

      setItems(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1>Timetable</h1>
      <p style={{ opacity: 0.85, marginTop: 6 }}>
        Available group classes (public view).
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by class name or room..."
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "inherit",
            minWidth: 260,
          }}
        />

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

        <div style={{ opacity: 0.75 }}>
          {loading ? "Loading..." : `${filtered.length} classes`}
        </div>
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

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 900,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.06)" }}>
              <th style={{ padding: 12 }}>Class</th>
              <th style={{ padding: 12 }}>Start time</th>
              <th style={{ padding: 12 }}>Room</th>
              <th style={{ padding: 12 }}>Max capacity</th>
              <th style={{ padding: 12 }}>ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={{ padding: 12, opacity: 0.8 }} colSpan={5}>
                  Loading timetable...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td style={{ padding: 12, opacity: 0.8 }} colSpan={5}>
                  No classes found.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const id = getId(c);
                const name = c.name ?? c.class_name ?? "-";
                return (
                  <tr key={id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: 12, fontWeight: 700 }}>{name}</td>
                    <td style={{ padding: 12 }}>{formatDateTime(c.start_time)}</td>
                    <td style={{ padding: 12 }}>{c.room ?? "-"}</td>
                    <td style={{ padding: 12 }}>{c.max_capacity ?? "-"}</td>
                    <td style={{ padding: 12, opacity: 0.8 }}>{id || "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, opacity: 0.75, fontSize: 13 }}>
        API: <code>/api/schedule/classes</code>
      </div>
    </div>
  );
}
