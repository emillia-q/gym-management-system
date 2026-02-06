import { useEffect, useMemo, useState } from "react";
import { api } from "../api/http";
import { mapBooking, type ApiBooking, type UiBooking } from "../api/mappers/schedule";
import { getAuthUser } from "../lib/auth";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
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
        <p>Please log in first (enter your Client ID).</p>
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
            <li key={b.id}>
              <b>{b.className}</b> — {formatDate(b.startDate)} — Room: {b.room}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
