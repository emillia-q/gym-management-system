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
  start_time?: string; // HH:MM:SS (czasem HH:MM)
  end_time?: string; // HH:MM:SS (czasem HH:MM)
};

type UiBooking = {
  id: number;
  classId: number | null;
  className: string;
  room: string;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
};

function mapBooking(b: ApiBooking): UiBooking {
  const id = Number(b.booking_id ?? 0);
  return {
    id,
    classId: b.group_class_id ?? null,
    className: b.class_name ?? "-",
    room: b.room ?? "-",
    startDate: b.start_date ?? null,
    startTime: b.start_time ?? null,
    endDate: b.end_date ?? null,
    endTime: b.end_time ?? null,
  };
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const DATE_TIME_FMT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function formatDateTime(date?: string | null, time?: string | null) {
  if (!date) return "-";

  // date + time => local datetime string (bez przesunięć UTC)
  if (time) {
    // akceptuj "HH:MM" albo "HH:MM:SS", ale wyświetlaj bez sekund
    const hhmm = time.slice(0, 5); // "18:00:00" -> "18:00"
    const d = new Date(`${date}T${hhmm}`);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("pl-PL", DATE_TIME_FMT);
  }

  // date-only => nie używamy new Date("YYYY-MM-DD") (bo UTC shift)
  if (DATE_ONLY_RE.test(date)) {
    const [y, m, dd] = date.split("-").map(Number);
    const d = new Date(y, m - 1, dd);
    return d.toLocaleDateString("pl-PL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  // fallback
  const d = new Date(date);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString("pl-PL", DATE_TIME_FMT);
  return date;
}

export default function MyBookings() {
  const user = getAuthUser();
  const clientId = useMemo(() => user?.userId, [user]);

  const [data, setData] = useState<UiBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;

    setError(null);
    setData(null);

    api
      .get<ApiBooking[]>(`/schedule/my-bookings/${clientId}`)
      .then((raw) => raw.map(mapBooking))
      .then(setData)
      .catch((e) => setError(String(e?.message ?? e)));
  }, [clientId]);

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <h1>My Bookings</h1>
        <p>Please log in first.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>My Bookings</h1>

      {error && <p style={{ color: "tomato" }}>Error: {error}</p>}
      {!error && !data && <p>Loading...</p>}

      {data && data.length === 0 && <p>No bookings found.</p>}

      {data && data.length > 0 && (
        <ul style={{ display: "grid", gap: 10, paddingLeft: 18 }}>
          {data.map((b) => (
            <li key={`${b.id}-${b.classId ?? "x"}`}>
              <b>{b.className}</b> — {formatDateTime(b.startDate, b.startTime)} — Room: {b.room}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
