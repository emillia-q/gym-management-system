import { useEffect, useState } from "react";
import { getAuthUser } from "../lib/auth";

type Booking = {
  booking_id: number;
  class_name: string;
  start_time: string;
  room: string;
};

export default function MyBookings() {
  const user = getAuthUser();
  const [data, setData] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    fetch(`/api/schedule/my-bookings/${user.clientId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [user]);

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
            <li key={b.booking_id}>
              <b>{b.class_name}</b> — {new Date(b.start_time).toLocaleString()} — Room: {b.room}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
