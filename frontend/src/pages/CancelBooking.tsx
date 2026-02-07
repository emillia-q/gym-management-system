import { useEffect, useMemo, useState } from "react";
import { api } from "../api/http";
import { getAuthUser } from "../lib/auth";

type ApiBooking = {
  booking_id?: number;
  group_class_id?: number;
  class_name?: string;
  room?: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  start_time?: string; // HH:MM:SS
  end_time?: string; // HH:MM:SS
};

type UiBooking = {
  bookingId: number;
  classId: number;
  className: string;
  room: string;
  startDate: string | null;
  startTime: string | null;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const DATE_TIME_FMT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function mapBooking(b: ApiBooking): UiBooking {
  const classId = Number(b.group_class_id ?? b.booking_id ?? 0);
  return {
    bookingId: Number(b.booking_id ?? classId),
    classId,
    className: b.class_name ?? "-",
    room: b.room ?? "-",
    startDate: b.start_date ?? null,
    startTime: b.start_time ?? null,
  };
}

function formatDateTime(date?: string | null, time?: string | null) {
  if (!date) return "-";

  if (time) {
    const hhmm = time.slice(0, 5);
    const d = new Date(`${date}T${hhmm}`);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("en-GB", DATE_TIME_FMT);
  }

  if (DATE_ONLY_RE.test(date)) {
    const [y, m, dd] = date.split("-").map(Number);
    const d = new Date(y, m - 1, dd);
    return d.toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  const d = new Date(date);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString("en-GB", DATE_TIME_FMT);
  return date;
}

function isFuture(startDate?: string | null, startTime?: string | null) {
  if (!startDate) return true;
  if (startTime) {
    const hhmm = startTime.slice(0, 5);
    const d = new Date(`${startDate}T${hhmm}`);
    if (!Number.isNaN(d.getTime())) return d.getTime() > Date.now();
  }
  if (DATE_ONLY_RE.test(startDate)) {
    const [y, m, dd] = startDate.split("-").map(Number);
    const d = new Date(y, m - 1, dd, 23, 59, 59);
    return d.getTime() > Date.now();
  }
  return true;
}

export default function CancelBooking() {
  const user = getAuthUser();
  const userId = useMemo(() => user?.userId, [user]);

  const [data, setData] = useState<UiBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    setMsg(null);

    try {
      const rows = await api.get<ApiBooking[]>(`/schedule/my-bookings/${userId}`);
      const mapped = Array.isArray(rows) ? rows.map(mapBooking) : [];
      setData(mapped);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  async function cancel(classId: number) {
    if (!userId) return;
    setBusyId(classId);
    setMsg(null);
    try {
      await api.del(`/schedule/bookings/${userId}/${classId}`);
      setMsg({ type: "success", text: "Booking cancelled." });
      await load();
    } catch (e: any) {
      setMsg({ type: "error", text: String(e?.message ?? e) });
    } finally {
      setBusyId(null);
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
        <h1>Cancel a booking</h1>
        <p>Please log in first.</p>
      </div>
    );
  }

  const canCancel = user?.role === "CLIENT" && !!userId;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1>Cancel a booking</h1>
      <p style={{ opacity: 0.85, marginTop: 6 }}>Click “Cancel” next to your booking.</p>

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

        <div style={{ opacity: 0.75 }}>{loading ? "Loading..." : data ? `${data.length} bookings` : ""}</div>
      </div>

      {msg && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: msg.type === "success" ? "rgba(0,255,120,0.10)" : "rgba(255,0,0,0.10)",
            color: msg.type === "success" ? "inherit" : "tomato",
          }}
        >
          {msg.text}
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

      {!error && !data && <p style={{ marginTop: 14, opacity: 0.8 }}>Loading...</p>}
      {data && data.length === 0 && !loading && <p style={{ marginTop: 14, opacity: 0.8 }}>No bookings found.</p>}

      {data && data.length > 0 && (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {data.map((b) => {
            const future = isFuture(b.startDate, b.startTime);
            const disabled = !canCancel || !future || busyId === b.classId;

            return (
              <div
                key={`${b.classId}`}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 900 }}>{b.className}</div>
                  <div style={{ opacity: 0.85, fontSize: 13 }}>
                    {formatDateTime(b.startDate, b.startTime)} · Room: {b.room}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => cancel(b.classId)}
                  disabled={disabled}
                  title={!future ? "Past bookings cannot be cancelled" : ""}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,0,0,0.10)",
                    color: "inherit",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.6 : 1,
                    minWidth: 120,
                  }}
                >
                  {busyId === b.classId ? "Cancelling..." : future ? "Cancel" : "Past"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
