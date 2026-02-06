import { useEffect, useMemo, useState } from "react";
import { api } from "../api/http";
import { getAuthUser } from "../lib/auth";

type GroupClassDto = {
  id_c?: number;
  id?: number;

  name?: string;
  class_name?: string;

  start_date?: string;
  end_date?: string;

  // inconsistent field sometimes:
  start_time?: string;

  room?: string;
  max_capacity?: number;
};

type BookRequestDto = {
  client_id: number;
  group_class_id: number;
};

type BookResponseDto = {
  status: string;
  message: string;
  booking_id: number;
};

function getId(c: GroupClassDto) {
  return Number(c.id_c ?? c.id ?? 0);
}

function getName(c: GroupClassDto) {
  return c.name ?? c.class_name ?? "-";
}

function getStart(c: GroupClassDto) {
  // prefer start_date (contract), fallback to start_time
  return c.start_date ?? c.start_time ?? null;
}

function getEnd(c: GroupClassDto) {
  // contract expects end_date; may be missing
  return c.end_date ?? null;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  return value;
}

export default function Schedule() {
  const user = getAuthUser();
  const canBook = user?.role === "CLIENT" && !!user?.userId;

  const [items, setItems] = useState<GroupClassDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");

  // booking UI state
  const [bookingClassId, setBookingClassId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) => {
      const name = getName(c).toLowerCase();
      const room = (c.room ?? "").toLowerCase();
      return name.includes(s) || room.includes(s);
    });
  }, [items, q]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<GroupClassDto[]>("/schedule/classes");
      if (!Array.isArray(data)) throw new Error("API did not return an array.");
      setItems(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function bookClass(groupClassId: number) {
    if (!user?.userId) return;

    setActionMsg(null);
    setBookingClassId(groupClassId);

    try {
      const payload: BookRequestDto = {
        client_id: user.userId,
        group_class_id: groupClassId,
      };

      const res = await api.post<BookResponseDto>("/schedule/book", payload);

      setActionMsg({
        type: "success",
        text: res?.message || "Booked successfully!",
      });

      // refresh list (even if it doesn't show occupancy yet)
      await load();
    } catch (e: any) {
      // api/http.ts throws ApiError where message is FastAPI detail if present
      setActionMsg({
        type: "error",
        text: String(e?.message ?? e),
      });
    } finally {
      setBookingClassId(null);
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

      {actionMsg && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: actionMsg.type === "success" ? "rgba(0,255,120,0.10)" : "rgba(255,0,0,0.10)",
            color: actionMsg.type === "success" ? "inherit" : "tomato",
          }}
        >
          {actionMsg.text}
        </div>
      )}

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
            minWidth: 950,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.06)" }}>
              <th style={{ padding: 12 }}>Class</th>
              <th style={{ padding: 12 }}>Start</th>
              <th style={{ padding: 12 }}>End</th>
              <th style={{ padding: 12 }}>Room</th>
              <th style={{ padding: 12 }}>Max capacity</th>
              {canBook && <th style={{ padding: 12 }}>Action</th>}
              <th style={{ padding: 12 }}>ID</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td style={{ padding: 12, opacity: 0.8 }} colSpan={canBook ? 7 : 6}>
                  Loading timetable...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td style={{ padding: 12, opacity: 0.8 }} colSpan={canBook ? 7 : 6}>
                  No classes found.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const id = getId(c);
                const name = getName(c);
                const start = getStart(c);
                const end = getEnd(c);
                const maxCap = c.max_capacity ?? 20; // fallback if backend doesn't send it

                const busy = bookingClassId === id;

                return (
                  <tr key={id || `${name}-${start ?? "no-start"}`} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: 12, fontWeight: 700 }}>{name}</td>
                    <td style={{ padding: 12 }}>{formatDateTime(start)}</td>
                    <td style={{ padding: 12 }}>{formatDateTime(end)}</td>
                    <td style={{ padding: 12 }}>{c.room ?? "-"}</td>
                    <td style={{ padding: 12 }}>{maxCap ?? "-"}</td>

                    {canBook && (
                      <td style={{ padding: 12 }}>
                        <button
                          type="button"
                          onClick={() => bookClass(id)}
                          disabled={busy || !id}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(255,255,255,0.06)",
                            color: "inherit",
                            cursor: busy ? "not-allowed" : "pointer",
                            opacity: busy ? 0.7 : 1,
                          }}
                          title={!id ? "Missing class id" : "Book this class"}
                        >
                          {busy ? "Booking..." : "Book"}
                        </button>
                      </td>
                    )}

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
        {canBook ? (
          <span> · booking: <code>/api/schedule/book</code></span>
        ) : (
          <span> · sign in as CLIENT to book</span>
        )}
      </div>
    </div>
  );
}
