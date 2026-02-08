import { useState } from "react";
import { useNavigate } from "react-router-dom";

type Role =
  | "CLIENT"
  | "RECEPTIONIST"
  | "MANAGER"
  | "INSTRUCTOR"
  | "PERSONAL_TRAINER";

type Gender = "F" | "M" | "O";

export default function SignUp() {
  const navigate = useNavigate();

  const [user, setUser] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    birth_date: "", // YYYY-MM-DD
    phone_number: "",
    gender: "F" as Gender, // DB expects 1 char
    role: "CLIENT" as Role,
  });

  // ✅ apartment_number optional
  const [address, setAddress] = useState({
    city: "",
    postal_code: "",
    street_name: "",
    street_number: "",
    apartment_number: "", // optional input
  });

  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateUser<K extends keyof typeof user>(
    key: K,
    value: (typeof user)[K]
  ) {
    setUser((prev) => ({ ...prev, [key]: value }));
  }

  function updateAddress<K extends keyof typeof address>(
    key: K,
    value: (typeof address)[K]
  ) {
    setAddress((prev) => ({ ...prev, [key]: value }));
  }

  async function readJsonOrText(res: Response) {
    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      // not json
    }
    return { text, data };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    setError(null);

    // Basic validation
    if (!user.first_name || !user.last_name || !user.email || !user.password) {
      setError("Please fill in first name, last name, email and password.");
      return;
    }
    if (!user.birth_date) {
      setError("Please provide birth date.");
      return;
    }
    if (
      !address.city ||
      !address.postal_code ||
      !address.street_name ||
      !address.street_number
    ) {
      setError(
        "Please fill in all required address fields (city, postal code, street name, street number)."
      );
      return;
    }

    const streetNum = Number(address.street_number);
    if (!Number.isInteger(streetNum) || streetNum <= 0) {
      setError("Street number must be a positive number.");
      return;
    }

    // apartment optional validation
    const aptRaw = address.apartment_number.trim();
    const aptNum = aptRaw === "" ? null : Number(aptRaw);
    if (aptNum !== null && (!Number.isInteger(aptNum) || aptNum <= 0)) {
      setError("Apartment number must be empty or a positive number.");
      return;
    }

    try {
      setLoading(true);

      // 1) Create address (now supports apartment_number optional)
      const addressPayload: any = {
        city: address.city,
        postal_code: address.postal_code,
        street_name: address.street_name,
        street_number: streetNum,
      };
      if (aptNum !== null) addressPayload.apartment_number = aptNum;

      const resAdr = await fetch("/api/test/create-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addressPayload),
      });

      const { text: adrText, data: adrData } = await readJsonOrText(resAdr);
      if (!resAdr.ok) {
        const msg =
          (typeof adrData?.detail === "string" && adrData.detail) ||
          adrText ||
          `Address create failed (HTTP ${resAdr.status})`;
        throw new Error(msg);
      }

      // Backend returns: {"message": "...", "id": <id_adr>}
      const addressId =
        adrData?.id_adr ?? adrData?.address_id ?? adrData?.id ?? adrData?.data?.id_adr;

      if (!addressId) {
        throw new Error(
          `Address created but could not read address id. Response was: ${adrText || JSON.stringify(adrData)}`
        );
      }

      // 2) Create user with address_id
      const userPayload: any = {
        ...user,
        address_id: Number(addressId),
      };

      const resUser = await fetch("/api/test/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userPayload),
      });

      const { text: userText, data: userData } = await readJsonOrText(resUser);
      if (!resUser.ok) {
        const msg =
          (typeof userData?.detail === "string" && userData.detail) ||
          (Array.isArray(userData?.detail) ? JSON.stringify(userData.detail, null, 2) : "") ||
          userText ||
          `User create failed (HTTP ${resUser.status})`;
        throw new Error(msg);
      }

      setOkMsg("Account created successfully! You can now log in.");
      setTimeout(() => navigate("/login"), 700);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, padding: 24 }}>
      <h1>Register</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14, marginTop: 16 }}>
        <h2 style={{ margin: "12px 0 0" }}>Account</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            First name
            <input
              value={user.first_name}
              onChange={(e) => updateUser("first_name", e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label>
            Last name
            <input
              value={user.last_name}
              onChange={(e) => updateUser("last_name", e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>
        </div>

        <label>
          Email
          <input
            value={user.email}
            onChange={(e) => updateUser("email", e.target.value)}
            type="email"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Password
          <input
            value={user.password}
            onChange={(e) => updateUser("password", e.target.value)}
            type="password"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Birth date
            <input
              value={user.birth_date}
              onChange={(e) => updateUser("birth_date", e.target.value)}
              type="date"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label>
            Phone number
            <input
              value={user.phone_number}
              onChange={(e) => updateUser("phone_number", e.target.value)}
              placeholder="e.g. +48 123 456 789"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Gender
            <select
              value={user.gender}
              onChange={(e) => updateUser("gender", e.target.value as Gender)}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            >
              <option value="F">FEMALE</option>
              <option value="M">MALE</option>
              <option value="O">OTHER</option>
            </select>
          </label>

          <label>
            Role
            <select
              value={user.role}
              onChange={(e) => updateUser("role", e.target.value as Role)}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            >
              <option value="CLIENT">CLIENT</option>
              <option value="RECEPTIONIST">RECEPTIONIST</option>
              <option value="MANAGER">MANAGER</option>
              <option value="INSTRUCTOR">INSTRUCTOR</option>
              <option value="PERSONAL_TRAINER">PERSONAL TRAINER</option>
            </select>
          </label>
        </div>

        <h2 style={{ margin: "18px 0 0" }}>Address</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            City
            <input
              value={address.city}
              onChange={(e) => updateAddress("city", e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label>
            Postal code
            <input
              value={address.postal_code}
              onChange={(e) => updateAddress("postal_code", e.target.value)}
              placeholder="e.g. 00-001"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>
        </div>

        <label>
          Street name
          <input
            value={address.street_name}
            onChange={(e) => updateAddress("street_name", e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Street number
            <input
              value={address.street_number}
              onChange={(e) => updateAddress("street_number", e.target.value)}
              placeholder="e.g. 10"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label>
            Apartment number (optional)
            <input
              value={address.apartment_number}
              onChange={(e) => updateAddress("apartment_number", e.target.value)}
              placeholder="e.g. 2"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>
        </div>

        {error && (
          <pre
            style={{
              background: "rgba(255,0,0,0.08)",
              padding: 12,
              borderRadius: 10,
              overflowX: "auto",
              color: "tomato",
            }}
          >
            {error}
          </pre>
        )}

        {okMsg && (
          <div
            style={{
              background: "rgba(0,255,0,0.08)",
              padding: 12,
              borderRadius: 10,
            }}
          >
            {okMsg}
          </div>
        )}

        <button type="submit" disabled={loading} style={{ padding: "10px 12px" }}>
          {loading ? "Creating..." : "Create account"}
        </button>

        <div style={{ marginTop: 8, opacity: 0.85 }}>
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            style={{ padding: "8px 10px" }}
          >
            Go to login
          </button>
        </div>
      </form>
    </div>
  );
}
