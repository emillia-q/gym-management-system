import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/http";
import { getAuthUser } from "../lib/auth";

type CreateGroupClassReq = {
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
  start_time: string;   // HH:MM
  end_time: string;     // HH:MM
  room: string;
  name: string;
  instructor_id: number;
  manager_id: number;
};

type CreateGroupClassRes = {
  message?: string;
  class_id?: number;
};

type GroupClassDto = {
  id_c?: number;
  name?: string;
  room?: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
  start_time?: string; // HH:MM:SS (czasem HH:MM)
  end_time?: string;   // HH:MM:SS (czasem HH:MM)
  max_capacity?: number;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDate(date?: string | null) {
  if (!date) return "-";
  if (DATE_ONLY_RE.test(date)) {
    const [y, m, dd] = date.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
  }
  const d = new Date(date);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-GB");
  return date;
}

function formatTimeOnly(time?: string | null) {
  if (!time) return "-";
  return time.slice(0, 5);
}

export default function ManagerClasses() {
  const navigate = useNavigate();
  const user = getAuthUser();
  const isManager = user?.role === "MANAGER" && !!user?.userId;

  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [startDate, setStartDate] = useState(todayYmd());
  const [endDate, setEndDate] = useState(todayYmd());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:00");
  const [instructorId, setInstructorId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Optional list (reuse /schedule/classes)
  const [classes, setClasses] = useState<GroupClassDto[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const panel: React.CSSProperties = {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  };

  const btn: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    cursor: "pointer",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: 10,
    marginTop: 6,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    colorScheme: "dark",
  };

  async function loadList() {
    setLoadingList(true);
    try {
      const rows = await api.get<GroupClassDto[]>("/schedule/classes");
      setClasses(Array.isArray(rows) ? rows : []);
    } catch {
      setClasses([]);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (!isManager) return;
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  const sortedClasses = useMemo(() => {
    const arr = Array.isArray(classes) ? [...classes] : [];
    arr.sort((a, b) => {
      const ad = a.start_date ?? "";
      const bd = b.start_date ?? "";
      if (ad !== bd) return ad.localeCompare(bd);
      const at = a.start_time ?? "";
      const bt = b.start_time ?? "";
      return at.localeCompare(bt);
    });
    return arr;
  }, [classes]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.userId) return;

    setMsg(null);

    const instr = Number(instructorId);
    if (!name.trim()) return setMsg({ type: "error", text: "Name is required." });
    if (!room.trim()) return setMsg({ type: "error", text: "Room is required." });
    if (!startDate || !endDate) return setMsg({ type: "error", text: "Start and end date are required." });
    if (!startTime || !endTime) return setMsg({ type: "error", text: "Start and end time are required." });
    if (!Number.isInteger(instr) || instr <= 0) return setMsg({ type: "error", text: "Instructor ID must be a positive integer." });

    const payload: CreateGroupClassReq = {
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      room: room.trim(),
      name: name.trim(),
      instructor_id: instr,
      manager_id: user.userId,
    };

    setSubmitting(true);
    try {
      const res = await api.post<CreateGroupClassRes>("/classes/group", payload);
      setMsg({
        type: "success",
        text: `Created class_id=${res?.class_id ?? "?"}. ${res?.message ?? ""}`.trim(),
      });

      // refresh list
      await loadList();

      // optional: quick clear name/room
      // setName("");
      // setRoom("");
    } catch (e: any) {
      setMsg({ type: "error", text: String(e?.message ?? e) });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isManager) {
    return (
      <div style={{ maxWidth: 860, padding: 24 }}>
        <h1>Manager</h1>
        <div style={{ marginTop: 10, color: "tomato" }}>Access denied: MANAGER only.</div>
        <button type="button" onClick={() => navigate("/login")} style={{ ...btn, marginTop: 14, width: 220 }}>
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1>Manager — create group class</h1>
      <p style={{ opacity: 0.85, marginTop: 6 }}>
        Create a new group class.
      </p>

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

      <div style={panel}>
        <h2 style={{ marginTop: 0 }}>Create</h2>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pilates" style={input} />
            </label>

            <label>
              Room
              <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room A" style={input} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <label>
              Start date
              <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" style={input} />
            </label>

            <label>
              End date
              <input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="date" style={input} />
            </label>

            <label>
              Start time
              <input value={startTime} onChange={(e) => setStartTime(e.target.value)} type="time" style={input} />
            </label>

            <label>
              End time
              <input value={endTime} onChange={(e) => setEndTime(e.target.value)} type="time" style={input} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Instructor ID
              <input
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                placeholder="e.g. 7"
                inputMode="numeric"
                style={input}
              />
              <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
                
              </div>
            </label>

            <label>
              Manager ID (auto)
              <input value={String(user.userId)} readOnly style={{ ...input, opacity: 0.8 }} />
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...btn,
              width: 240,
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Creating…" : "Create class"}
          </button>
        </form>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={loadList} style={btn}>
          Refresh list
        </button>
        <div style={{ opacity: 0.75 }}>
          {loadingList ? "Loading…" : classes ? `${sortedClasses.length} classes` : ""}
        </div>
      </div>

      {classes && (
        <div style={{ marginTop: 14, overflowX: "auto" }}>
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
                <th style={{ padding: 12 }}>ID</th>
              </tr>
            </thead>

            <tbody>
              {sortedClasses.length === 0 ? (
                <tr>
                  <td style={{ padding: 12, opacity: 0.8 }} colSpan={5}>
                    No classes found.
                  </td>
                </tr>
              ) : (
                sortedClasses.map((c) => (
                  <tr key={String(c.id_c)} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: 12, fontWeight: 800 }}>{c.name ?? "-"}</td>
                    <td style={{ padding: 12 }}>
                      {formatDate(c.start_date ?? null)} {formatTimeOnly(c.start_time ?? null)}
                    </td>
                    <td style={{ padding: 12 }}>
                      {formatDate(c.end_date ?? null)} {formatTimeOnly(c.end_time ?? null)}
                    </td>
                    <td style={{ padding: 12 }}>{c.room ?? "-"}</td>
                    <td style={{ padding: 12, opacity: 0.8 }}>{c.id_c ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
