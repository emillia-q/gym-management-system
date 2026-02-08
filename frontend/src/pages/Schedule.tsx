import { useEffect, useMemo, useState } from "react";
import { api } from "../api/http";
import { getAuthUser } from "../lib/auth";

type GroupClassDto = {
  id_c?: number;
  id?: number;

  name?: string;
  class_name?: string;

  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  start_time?: string; // HH:MM:SS (czasem HH:MM)
  end_time?: string; // HH:MM:SS (czasem HH:MM)

  room?: string;
  max_capacity?: number;

  //  liczba zapisanych (backend musi zwrócić to pole)
  booked_count?: number;
};

type ApiMyBooking = {
  group_class_id?: number;
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

  if (time) {
    const hhmm = time.slice(0, 5); // "18:00:00" -> "18:00"
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

function formatTimeOnly(time?: string | null) {
  if (!time) return "-";
  return time.slice(0, 5); // HH:MM:SS -> HH:MM
}

/** -------- Weekly grid helpers -------- */
const SLOT_MIN = 15;
const SLOT_PX = 22;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYmdLocal(dateStr: string) {
  if (!DATE_ONLY_RE.test(dateStr)) return null;
  const [y, m, dd] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, dd);
}

function startOfWeekMonday(d: Date) {
  const day = d.getDay(); // 0=Sun,1=Mon...
  const diff = (day + 6) % 7; // Mon->0 ... Sun->6
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  out.setHours(0, 0, 0, 0);
  return out;
}

function toMinutes(time: string) {
  const hhmm = time.slice(0, 5);
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}

function floorToStep(min: number, step: number) {
  return Math.floor(min / step) * step;
}

function ceilToStep(min: number, step: number) {
  return Math.ceil(min / step) * step;
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const ROOM_COLORS = [
  "rgba(255, 153, 102, 0.28)",
  "rgba(255, 102, 178, 0.22)",
  "rgba(102, 204, 255, 0.22)",
  "rgba(140, 255, 140, 0.18)",
  "rgba(255, 220, 120, 0.20)",
  "rgba(200, 170, 255, 0.22)",
];

function roomColor(room?: string) {
  const key = (room ?? "").trim() || "room";
  const idx = hashStr(key) % ROOM_COLORS.length;
  return ROOM_COLORS[idx];
}

type PositionedEvent = {
  id: number;
  name: string;
  room: string;
  maxCap: number;
  bookedCount: number; // ✅ NEW
  dateKey: string;

  startMin: number;
  endMin: number;

  lane: number;
  lanes: number;
};

function layoutLanesForDay(events: Array<Omit<PositionedEvent, "lane" | "lanes">>): PositionedEvent[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  type Active = { endMin: number; lane: number };
  const active: Active[] = [];
  const out: PositionedEvent[] = [];
  let maxLanes = 1;

  for (const ev of sorted) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMin <= ev.startMin) active.splice(i, 1);
    }

    const used = new Set(active.map((a) => a.lane));
    let lane = 0;
    while (used.has(lane)) lane++;

    active.push({ endMin: ev.endMin, lane });
    maxLanes = Math.max(maxLanes, active.length);

    out.push({ ...ev, lane, lanes: 1 });
  }

  return out.map((e) => ({ ...e, lanes: maxLanes }));
}

function WeeklyGrid(props: {
  items: GroupClassDto[];
  canBook: boolean;
  bookingClassId: number | null;
  bookedIds: Set<number>;
  onBook: (id: number) => void;
}) {
  const { items, canBook, bookingClassId, bookedIds, onBook } = props;

  const initialWeek = useMemo(() => {
    const firstDate = items.find((x) => x.start_date && DATE_ONLY_RE.test(x.start_date))?.start_date;
    const d = firstDate ? parseYmdLocal(firstDate) : null;
    return startOfWeekMonday(d ?? new Date());
  }, [items]);

  const [weekStart, setWeekStart] = useState<Date>(initialWeek);
  const [selected, setSelected] = useState<PositionedEvent | null>(null);

  useEffect(() => {
    setWeekStart((prev) => prev ?? initialWeek);
  }, [initialWeek]);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekStartKey = ymdLocal(weekStart);
  const weekEndKey = ymdLocal(addDays(weekStart, 6));

  const weekItems = useMemo(() => {
    return items.filter((c) => {
      const d = c.start_date;
      if (!d) return false;
      return d >= weekStartKey && d <= weekEndKey;
    });
  }, [items, weekStartKey, weekEndKey]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, Array<Omit<PositionedEvent, "lane" | "lanes">>> = {};
    for (const c of weekItems) {
      const dateKey = c.start_date ?? "";
      const id = getId(c);
      const name = getName(c);
      const room = c.room ?? "-";
      const maxCap = c.max_capacity ?? 20;
      const bookedCount = c.booked_count ?? 0; // ✅ NEW

      if (!dateKey || !c.start_time || !c.end_time) continue;

      const startMin = toMinutes(c.start_time);
      const endMin = toMinutes(c.end_time);
      if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) continue;

      (map[dateKey] ??= []).push({
        id,
        name,
        room,
        maxCap,
        bookedCount,
        dateKey,
        startMin,
        endMin,
      });
    }
    return map;
  }, [weekItems]);

  const positionedByDay = useMemo(() => {
    const out: Record<string, PositionedEvent[]> = {};
    for (const key of Object.keys(eventsByDay)) {
      out[key] = layoutLanesForDay(eventsByDay[key]);
    }
    return out;
  }, [eventsByDay]);

  const timeRange = useMemo(() => {
    let minStart = 8 * 60;
    let maxEnd = 22 * 60;

    const all = Object.values(eventsByDay).flat();
    if (all.length) {
      minStart = Math.min(...all.map((e) => e.startMin));
      maxEnd = Math.max(...all.map((e) => e.endMin));

      minStart = floorToStep(minStart, SLOT_MIN);
      maxEnd = ceilToStep(maxEnd, SLOT_MIN);

      minStart = Math.max(0, minStart);
      maxEnd = Math.min(24 * 60, maxEnd);
      if (maxEnd - minStart < 6 * 60) {
        maxEnd = Math.min(24 * 60, minStart + 6 * 60);
      }
    }

    return { minStart, maxEnd };
  }, [eventsByDay]);

  const slots = useMemo(() => {
    const arr: number[] = [];
    for (let m = timeRange.minStart; m <= timeRange.maxEnd; m += SLOT_MIN) arr.push(m);
    return arr;
  }, [timeRange]);

  const heightPx = Math.max(1, (slots.length - 1) * SLOT_PX);

  const weekLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const a = fmt.format(weekStart);
    const b = fmt.format(addDays(weekStart, 6));
    return `${a} – ${b}`;
  }, [weekStart]);

  const fmtMin = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            ← Prev week
          </button>

          <button
            type="button"
            onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            This week
          </button>

          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Next week →
          </button>
        </div>

        <div style={{ fontWeight: 800, opacity: 0.9 }}>{weekLabel}</div>
      </div>

      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "84px repeat(7, 1fr)",
          gap: 8,
          marginTop: 12,
          alignItems: "end",
        }}
      >
        <div style={{ opacity: 0.7, fontSize: 12, paddingLeft: 6 }}>Time</div>

        {weekDates.map((d) => {
          const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(d);
          const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit" }).format(d);
          return (
            <div
              key={ymdLocal(d)}
              style={{
                padding: "10px 10px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontWeight: 900 }}>{dayName}</div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>{date}</div>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "84px repeat(7, 1fr)",
          gap: 8,
          marginTop: 8,
        }}
      >
        {/* Time column */}
        <div
          style={{
            height: heightPx,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.02)",
            overflow: "hidden",
          }}
        >
          {slots.slice(0, -1).map((m) => {
            const hh = Math.floor(m / 60);
            const mm = m % 60;
            const label = `${pad2(hh)}:${pad2(mm)}`;
            const isHour = mm === 0;

            return (
              <div
                key={m}
                style={{
                  height: SLOT_PX,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isHour ? 13 : 12,
                  fontWeight: isHour ? 900 : 600,
                  opacity: isHour ? 0.95 : 0.65,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {label}
              </div>
            );
          })}
        </div>

        {/* Day columns */}
        {weekDates.map((d) => {
          const key = ymdLocal(d);
          const events = positionedByDay[key] ?? [];

          return (
            <div
              key={key}
              style={{
                position: "relative",
                height: heightPx,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.02)",
                overflow: "hidden",
                backgroundImage:
                  `repeating-linear-gradient(` +
                  `to bottom, ` +
                  `rgba(255,255,255,0.06), rgba(255,255,255,0.06) 1px, ` +
                  `transparent 1px, transparent ${SLOT_PX}px` +
                  `)`,
              }}
            >
              {events.map((ev) => {
                const top = ((ev.startMin - timeRange.minStart) / SLOT_MIN) * SLOT_PX;
                const h = ((ev.endMin - ev.startMin) / SLOT_MIN) * SLOT_PX;

                const widthPct = 100 / Math.max(1, ev.lanes);
                const leftPct = ev.lane * widthPct;

                const busy = bookingClassId === ev.id;
                const isBooked = bookedIds.has(ev.id);

                return (
                  <div
                    key={`${ev.id}-${ev.startMin}-${ev.lane}`}
                    onClick={() => setSelected(ev)}
                    role="button"
                    tabIndex={0}
                    style={{
                      position: "absolute",
                      top,
                      left: `calc(${leftPct}% + 4px)`,
                      width: `calc(${widthPct}% - 8px)`,
                      height: Math.max(36, h),
                      borderRadius: 12,
                      border: isBooked ? "1px solid rgba(0,255,140,0.35)" : "1px solid rgba(255,255,255,0.16)",
                      background: roomColor(ev.room),
                      padding: 10,
                      boxSizing: "border-box",
                      backdropFilter: "blur(6px)",
                      overflow: "hidden",
                      zIndex: 2,
                      cursor: "pointer",
                      opacity: busy ? 0.75 : 1,
                    }}
                    title="Click to view / book"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 900, lineHeight: 1.15 }}>{ev.name}</div>
                      {isBooked && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            padding: "2px 8px",
                            borderRadius: 999,
                            border: "1px solid rgba(0,255,140,0.35)",
                            background: "rgba(0,255,140,0.12)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Booked
                        </span>
                      )}
                    </div>

                    <div style={{ opacity: 0.9, fontSize: 12, marginTop: 6 }}>
                      {fmtMin(ev.startMin)}–{fmtMin(ev.endMin)}
                    </div>

                    {/* ✅ CHANGED: booked/max */}
                    <div style={{ opacity: 0.85, fontSize: 12, marginTop: 4 }}>
                      Room: {ev.room} · {ev.bookedCount}/{ev.maxCap}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(20,20,20,0.92)",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{selected.name}</div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginTop: 10, opacity: 0.9 }}>Date: {formatDateTime(selected.dateKey, null)}</div>
            <div style={{ marginTop: 6, opacity: 0.9 }}>
              Time: {fmtMin(selected.startMin)}–{fmtMin(selected.endMin)}
            </div>

            {/* ✅ CHANGED: booked/max */}
            <div style={{ marginTop: 6, opacity: 0.85 }}>
              Room: {selected.room} · capacity {selected.bookedCount}/{selected.maxCap}
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
              {canBook ? (
                bookedIds.has(selected.id) ? (
                  <div style={{ fontWeight: 800, color: "rgba(0,255,140,0.9)" }}>You’re already booked.</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onBook(selected.id);
                      setSelected(null);
                    }}
                    disabled={bookingClassId === selected.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.06)",
                      color: "inherit",
                      cursor: bookingClassId === selected.id ? "not-allowed" : "pointer",
                      opacity: bookingClassId === selected.id ? 0.7 : 1,
                    }}
                  >
                    {bookingClassId === selected.id ? "Booking..." : "Book"}
                  </button>
                )
              ) : (
                <div style={{ opacity: 0.85 }}>Sign in as CLIENT to book.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** -------- Page -------- */
export default function Schedule() {
  const user = getAuthUser();
  const canBook = user?.role === "CLIENT" && !!user?.userId;

  const [items, setItems] = useState<GroupClassDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");

  const [view, setView] = useState<"weekly" | "table" | "agenda">("weekly");

  const [bookingClassId, setBookingClassId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [bookedIds, setBookedIds] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) => {
      const name = getName(c).toLowerCase();
      const room = (c.room ?? "").toLowerCase();
      return name.includes(s) || room.includes(s);
    });
  }, [items, q]);

  const agenda = useMemo(() => {
    const arr = [...filtered].sort((a, b) => {
      const ad = a.start_date ?? "";
      const bd = b.start_date ?? "";
      if (ad !== bd) return ad.localeCompare(bd);
      const at = a.start_time ?? "";
      const bt = b.start_time ?? "";
      return at.localeCompare(bt);
    });

    const groups: Record<string, GroupClassDto[]> = {};
    for (const c of arr) {
      const key = c.start_date ?? "unknown";
      (groups[key] ??= []).push(c);
    }
    return groups;
  }, [filtered]);

  async function loadMyBookings() {
    if (!user?.userId || user.role !== "CLIENT") {
      setBookedIds(new Set());
      return;
    }

    try {
      const rows = await api.get<ApiMyBooking[]>(`/schedule/my-bookings/${user.userId}`);
      const s = new Set<number>();
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const id = Number(r.group_class_id ?? 0);
          if (id) s.add(id);
        }
      }
      setBookedIds(s);
    } catch {
      setBookedIds(new Set());
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<GroupClassDto[]>("/schedule/classes");
      if (!Array.isArray(data)) throw new Error("API did not return an array.");
      setItems(data);
      await loadMyBookings();
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setItems([]);
      setBookedIds(new Set());
    } finally {
      setLoading(false);
    }
  }

  async function bookClass(groupClassId: number) {
    if (!user?.userId) return;
    if (bookedIds.has(groupClassId)) {
      setActionMsg({ type: "success", text: "You’re already booked for this class." });
      return;
    }

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

      await load();
    } catch (e: any) {
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

  const viewLabel = view === "weekly" ? "Weekly" : view === "table" ? "Table" : "Agenda";
  const cycleView = () => {
    const order: Array<typeof view> = ["weekly", "table", "agenda"];
    const idx = order.indexOf(view);
    setView(order[(idx + 1) % order.length]);
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <h1>Schedule</h1>
      <p style={{ opacity: 0.85, marginTop: 6 }}>Available group classes (public view).</p>

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

        <button
          type="button"
          onClick={cycleView}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          View: {viewLabel}
        </button>

        <div style={{ opacity: 0.75 }}>{loading ? "Loading..." : `${filtered.length} classes`}</div>
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

      {view === "weekly" ? (
        <WeeklyGrid items={filtered} canBook={canBook} bookingClassId={bookingClassId} bookedIds={bookedIds} onBook={bookClass} />
      ) : view === "agenda" ? (
        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          {Object.keys(agenda)
            .sort()
            .map((dateKey) => (
              <div
                key={dateKey}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 16 }}>{formatDateTime(dateKey, null)}</div>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {agenda[dateKey].map((c) => {
                    const id = getId(c);
                    const busy = bookingClassId === id;
                    const maxCap = c.max_capacity ?? 20;
                    const isBooked = bookedIds.has(id);
                    const bookedCount = c.booked_count ?? 0;

                    return (
                      <div
                        key={id || `${getName(c)}-${c.start_date ?? "x"}-${c.start_time ?? "x"}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                          padding: 12,
                          borderRadius: 12,
                          borderTop: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontWeight: 800 }}>
                            {getName(c)}{" "}
                            {isBooked && (
                              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.85 }}>
                                (Booked)
                              </span>
                            )}
                          </div>
                          <div style={{ opacity: 0.85, fontSize: 13 }}>
                            {formatTimeOnly(c.start_time)}–{formatTimeOnly(c.end_time)} · {c.room ?? "-"} · {bookedCount}/{maxCap}
                          </div>
                        </div>

                        {canBook && (
                          <button
                            type="button"
                            onClick={() => bookClass(id)}
                            disabled={busy || !id || isBooked}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,0.15)",
                              background: "rgba(255,255,255,0.06)",
                              color: "inherit",
                              cursor: busy || isBooked ? "not-allowed" : "pointer",
                              opacity: busy || isBooked ? 0.7 : 1,
                              minWidth: 110,
                            }}
                          >
                            {isBooked ? "Booked" : busy ? "Booking..." : "Book"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 980,
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
                <th style={{ padding: 12 }}>Booked/Cap</th>
                {canBook && <th style={{ padding: 12 }}>Action</th>}
                <th style={{ padding: 12 }}>ID</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td style={{ padding: 12, opacity: 0.8 }} colSpan={canBook ? 7 : 6}>
                    Loading schedule...
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
                  const maxCap = c.max_capacity ?? 20;
                  const bookedCount = c.booked_count ?? 0;
                  const busy = bookingClassId === id;
                  const isBooked = bookedIds.has(id);

                  return (
                    <tr
                      key={id || `${name}-${c.start_date ?? "no-start"}-${c.start_time ?? "no-time"}`}
                      style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <td style={{ padding: 12, fontWeight: 700 }}>
                        {name}{" "}
                        {isBooked && (
                          <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>
                            (Booked)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 12 }}>{formatDateTime(c.start_date ?? null, c.start_time ?? null)}</td>
                      <td style={{ padding: 12 }}>{formatDateTime(c.end_date ?? null, c.end_time ?? null)}</td>
                      <td style={{ padding: 12 }}>{c.room ?? "-"}</td>
                      <td style={{ padding: 12 }}>{bookedCount}/{maxCap}</td>

                      {canBook && (
                        <td style={{ padding: 12 }}>
                          <button
                            type="button"
                            onClick={() => bookClass(id)}
                            disabled={busy || !id || isBooked}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,0.15)",
                              background: "rgba(255,255,255,0.06)",
                              color: "inherit",
                              cursor: busy || isBooked ? "not-allowed" : "pointer",
                              opacity: busy || isBooked ? 0.7 : 1,
                            }}
                          >
                            {isBooked ? "Booked" : busy ? "Booking..." : "Book"}
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
      )}

      
    </div>
  );
}
