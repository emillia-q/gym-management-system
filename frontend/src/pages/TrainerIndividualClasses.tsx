import { useState } from "react";
import { api } from "../api/http";
import { getAuthUser } from "../lib/auth";
import { useNavigate } from "react-router-dom";

type CreateReq = {
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  room: string;
  client_id: number;
  per_trainer_id: number;
  additional_info?: string | null;
};

export default function TrainerIndividualClasses() {
  const user = getAuthUser();
  const navigate = useNavigate();

  const isTrainer = user?.role === "PERSONAL_TRAINER" && !!user?.userId;

  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    room: "",
    client_id: "",
    additional_info: "",
  });

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isTrainer) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Individual classes</h1>
        <p style={{ color: "tomato" }}>Access denied — PERSONAL_TRAINER only.</p>
        <button
          onClick={() => navigate("/login")}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "inherit",
            cursor: "pointer",
            marginTop: 12,
          }}
        >
          Go to login
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const clientId = Number(form.client_id);
    if (!clientId || clientId <= 0) {
      setMsg({ type: "error", text: "Client ID must be a positive number." });
      return;
    }

    if (!form.start_date || !form.end_date || !form.start_time || !form.end_time || !form.room.trim()) {
      setMsg({ type: "error", text: "Fill all required fields." });
      return;
    }

    const payload: CreateReq = {
      start_date: form.start_date,
      end_date: form.end_date,
      start_time: form.start_time,
      end_time: form.end_time,
      room: form.room.trim(),
      client_id: clientId,
      per_trainer_id: user!.userId,
      additional_info: form.additional_info?.trim() || null,
    };

    setBusy(true);
    try {
      const res = await api.post<any>("/classes/individual-classes", payload);
      setMsg({ type: "success", text: `Created ✅ class_id: ${res?.class_id ?? "?"}` });
      setForm((p) => ({ ...p, additional_info: "" }));
    } catch (err: any) {
      setMsg({ type: "error", text: String(err?.message ?? err) });
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 10,
    marginTop: 6,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
  };

  const btnStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>Individual classes</h1>
      <p style={{ opacity: 0.85 }}>Create an individual training session for a client.</p>

      {msg && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: msg.type === "success" ? "rgba(0,255,120,0.10)" : "rgba(255,0,0,0.10)",
            color: msg.type === "success" ? "inherit" : "tomato",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={submit} style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <label>
          Start date
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            style={inputStyle}
          />
        </label>

        <label>
          End date (must be same day)
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
            style={inputStyle}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Start time
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <label>
            End time
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
              style={inputStyle}
            />
          </label>
        </div>

        <label>
          Room
          <input
            value={form.room}
            onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))}
            placeholder="e.g. Room A"
            style={inputStyle}
          />
        </label>

        <label>
          Client ID
          <input
            value={form.client_id}
            onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
            inputMode="numeric"
            placeholder="e.g. 12"
            style={inputStyle}
          />
        </label>

        <label>
          Additional info (optional)
          <textarea
            value={form.additional_info}
            onChange={(e) => setForm((p) => ({ ...p, additional_info: e.target.value }))}
            rows={4}
            style={inputStyle}
          />
        </label>

        <button type="submit" disabled={busy} style={{ ...btnStyle, width: 220, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Creating…" : "Create class"}
        </button>
      </form>
    </div>
  );
}
