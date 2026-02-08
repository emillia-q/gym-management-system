import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/http";
import { getAuthUser } from "../lib/auth";

type StaffRole = "RECEPTIONIST" | "INSTRUCTOR" | "PERSONAL_TRAINER";

type StaffItem = {
  user_id: number;
  role: StaffRole | string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  contract_type?: string | null;
  hire_date?: string | null;
  salary?: number | null;
  address_id?: number | null;
};

type CreateStaffPayload = {
  manager_id: number;
  role: StaffRole;

  first_name: string;
  last_name: string;
  birth_date: string; // YYYY-MM-DD
  email: string;
  phone_number: string;
  gender: "F" | "M" | "O";
  password: string;

  contract_type: string;
  salary?: number | null;

  address: {
    city: string;
    postal_code: string;
    street_name: string;
    street_number: number;
    apartment_number?: number | null;
  };
};

function todayYmd() {
  const d = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function ManagerStaff() {
  const navigate = useNavigate();
  const user = getAuthUser();
  const isManager = user?.role === "MANAGER" && !!user?.userId;

  const [tab, setTab] = useState<"create" | "list">("create");

  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffItem[]>([]);

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    role: "PERSONAL_TRAINER" as StaffRole,
    first_name: "",
    last_name: "",
    birth_date: todayYmd(),
    email: "",
    phone_number: "",
    gender: "F" as "F" | "M" | "O",
    password: "",

    contract_type: "FULL_TIME",
    salary: "",

    city: "",
    postal_code: "",
    street_name: "",
    street_number: "",
    apartment_number: "",
  });

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

  const btnGhost: React.CSSProperties = {
    ...btn,
    background: "rgba(255,255,255,0.03)",
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
  const optionStyle: React.CSSProperties = {
    color: "#111",
    backgroundColor: "#fff",
  };
  async function loadStaff() {
    if (!user?.userId) return;
    setLoadingList(true);
    setListError(null);
    try {
      const rows = await api.get<StaffItem[]>("/manager/staff", {
        query: { manager_id: user.userId },
      });
      setStaff(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setListError(String(e?.message ?? e));
      setStaff([]);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (isManager) loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  const roleLabel = useMemo(() => {
    switch (form.role) {
      case "RECEPTIONIST":
        return "Receptionist";
      case "INSTRUCTOR":
        return "Instructor (group classes)";
      case "PERSONAL_TRAINER":
        return "Personal trainer";
      default:
        return form.role;
    }
  }, [form.role]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.userId) return;

    setMsg(null);

    // minimal validation
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setMsg({ type: "error", text: "First name + last name are required." });
      return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      setMsg({ type: "error", text: "Valid email is required." });
      return;
    }
    if (!form.password) {
      setMsg({ type: "error", text: "Password is required (for employee login)." });
      return;
    }
    if (!form.phone_number.trim()) {
      setMsg({ type: "error", text: "Phone number is required." });
      return;
    }
    if (!form.city.trim() || !form.postal_code.trim() || !form.street_name.trim() || !form.street_number.trim()) {
      setMsg({ type: "error", text: "Address is required (city, postal code, street, street number)." });
      return;
    }

    const streetNo = Number(form.street_number);
    if (!Number.isInteger(streetNo) || streetNo <= 0) {
      setMsg({ type: "error", text: "Street number must be a positive integer." });
      return;
    }

    const aptRaw = form.apartment_number.trim();
    const apt = aptRaw === "" ? null : Number(aptRaw);
    if (aptRaw !== "" && (!Number.isInteger(apt) || (apt as number) <= 0)) {
      setMsg({ type: "error", text: "Apartment number must be empty or a positive integer." });
      return;
    }

    const salaryRaw = form.salary.trim();
    const salary = salaryRaw === "" ? null : Number(salaryRaw);

    if (salaryRaw !== "" && (!Number.isFinite(salary as number) || (salary as number) < 0)) {
      setMsg({ type: "error", text: "Salary must be empty or a non-negative number." });
      return;
    }

    const payload: CreateStaffPayload = {
      manager_id: user.userId,
      role: form.role,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      birth_date: form.birth_date,
      email: form.email.trim(),
      phone_number: form.phone_number.trim(),
      gender: form.gender,
      password: form.password,
      contract_type: form.contract_type.trim() || "FULL_TIME",
      salary: salary ?? undefined,
      address: {
        city: form.city.trim(),
        postal_code: form.postal_code.trim(),
        street_name: form.street_name.trim(),
        street_number: streetNo,
        apartment_number: apt, // null albo number
      },
    };

    setSaving(true);
    try {
      await api.post<StaffItem>("/manager/staff", payload);
      setMsg({ type: "success", text: `Created: ${roleLabel} (${payload.email})` });
      setTab("list");
      await loadStaff();
    } catch (e: any) {
      setMsg({ type: "error", text: String(e?.message ?? e) });
    } finally {
      setSaving(false);
    }
  }

  if (!isManager) {
    return (
      <div style={{ maxWidth: 900, padding: 24 }}>
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
      <h1>Manager — Staff</h1>
      <p style={{ opacity: 0.85, marginTop: 6 }}>
        Add employees (receptionist / instructor / personal trainer) and see staff list.
      </p>

      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setTab("create")} style={tab === "create" ? btn : btnGhost}>
          Add employee
        </button>
        <button type="button" onClick={() => setTab("list")} style={tab === "list" ? btn : btnGhost}>
          Staff list
        </button>

        <div style={{ marginLeft: "auto", opacity: 0.75, display: "flex", gap: 10, alignItems: "center" }}>
          <button type="button" onClick={loadStaff} style={{ ...btnGhost, padding: "8px 10px" }}>
            Refresh list
          </button>
          <span>{loadingList ? "Loading…" : `${staff.length} employees`}</span>
        </div>
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

      {tab === "create" ? (
        <div style={panel}>
          <h2 style={{ marginTop: 0 }}>Add employee</h2>

          <form onSubmit={onCreate} style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                Role
                <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as StaffRole }))} style={input}>
                  <option style={optionStyle} value="RECEPTIONIST">RECEPTIONIST</option>
                  <option style={optionStyle} value="INSTRUCTOR">INSTRUCTOR</option>
                  <option style={optionStyle} value="PERSONAL_TRAINER">PERSONAL_TRAINER</option>
                </select>
              </label>

              <label>
                Contract type
                <select value={form.contract_type} onChange={(e) => setForm((p) => ({ ...p, contract_type: e.target.value }))} style={input}>
                  <option style={optionStyle} value="FULL_TIME">FULL_TIME</option>
                  <option style={optionStyle} value="PART_TIME">PART_TIME</option>
                  <option style={optionStyle} value="B2B">B2B</option>
                  <option style={optionStyle} value="OTHER">OTHER</option>
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                First name
                <input value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} style={input} />
              </label>
              <label>
                Last name
                <input value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} style={input} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                Email
                <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} type="email" style={input} />
              </label>
              <label>
                Phone
                <input value={form.phone_number} onChange={(e) => setForm((p) => ({ ...p, phone_number: e.target.value }))} style={input} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <label>
                Birth date
                <input value={form.birth_date} onChange={(e) => setForm((p) => ({ ...p, birth_date: e.target.value }))} type="date" style={input} />
              </label>
              <label>
                Gender
                <select value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value as any }))} style={input}>
                  <option style={optionStyle} value="F">F</option>
                  <option style={optionStyle} value="M">M</option>
                  <option style={optionStyle} value="O">O</option>
                </select>
              </label>
              <label>
                Salary (optional)
                <input value={form.salary} onChange={(e) => setForm((p) => ({ ...p, salary: e.target.value }))} inputMode="numeric" style={input} />
              </label>
            </div>

            <label>
              Password (for employee login)
              <input value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} type="password" style={input} />
            </label>

            <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 800 }}>Address</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                City
                <input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} style={input} />
              </label>
              <label>
                Postal code
                <input value={form.postal_code} onChange={(e) => setForm((p) => ({ ...p, postal_code: e.target.value }))} style={input} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.4fr 0.4fr", gap: 12 }}>
              <label>
                Street name
                <input value={form.street_name} onChange={(e) => setForm((p) => ({ ...p, street_name: e.target.value }))} style={input} />
              </label>
              <label>
                Street no.
                <input value={form.street_number} onChange={(e) => setForm((p) => ({ ...p, street_number: e.target.value }))} inputMode="numeric" style={input} />
              </label>
              <label>
                Apt. (opt.)
                <input value={form.apartment_number} onChange={(e) => setForm((p) => ({ ...p, apartment_number: e.target.value }))} inputMode="numeric" style={input} />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                ...btn,
                width: 220,
                opacity: saving ? 0.7 : 1,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Creating…" : "Create employee"}
            </button>
          </form>
        </div>
      ) : (
        <div style={panel}>
          <h2 style={{ marginTop: 0 }}>Staff list</h2>

          {listError && (
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
              {listError}
            </pre>
          )}

          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.06)" }}>
                  <th style={{ padding: 12 }}>ID</th>
                  <th style={{ padding: 12 }}>Role</th>
                  <th style={{ padding: 12 }}>Name</th>
                  <th style={{ padding: 12 }}>Email</th>
                  <th style={{ padding: 12 }}>Phone</th>
                  <th style={{ padding: 12 }}>Contract</th>
                  <th style={{ padding: 12 }}>Salary</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr>
                    <td style={{ padding: 12, opacity: 0.8 }} colSpan={7}>
                      Loading…
                    </td>
                  </tr>
                ) : staff.length === 0 ? (
                  <tr>
                    <td style={{ padding: 12, opacity: 0.8 }} colSpan={7}>
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  staff.map((s) => (
                    <tr key={s.user_id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: 12, opacity: 0.9 }}>{s.user_id}</td>
                      <td style={{ padding: 12, fontWeight: 800 }}>{String(s.role)}</td>
                      <td style={{ padding: 12 }}>
                        {s.first_name} {s.last_name}
                      </td>
                      <td style={{ padding: 12 }}>{s.email}</td>
                      <td style={{ padding: 12 }}>{s.phone_number}</td>
                      <td style={{ padding: 12 }}>{s.contract_type ?? "-"}</td>
                      <td style={{ padding: 12 }}>{typeof s.salary === "number" ? s.salary : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
