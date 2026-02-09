import { useState } from "react";
import { useNavigate } from "react-router-dom";

type Role =
  | "CLIENT"
  | "RECEPTIONIST"
  | "MANAGER"
  | "INSTRUCTOR"
  | "PERSONAL_TRAINER";

type Gender = "F" | "M" | "O";

/** ----------------- REGEXY + VALIDATORY ----------------- **/
const RE = {
  // Imię/nazwisko: litery (również PL), spacje, myślnik, apostrof; min 2 znaki
  name: /^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż\s'-]{1,48}$/,

  // Email: rozsądny regex (nie "RFC-perfect", ale praktyczny)
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,

  // Hasło: min 8, 1 mała, 1 duża, 1 cyfra, 1 znak specjalny, brak spacji
  password:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])[^\s]{8,64}$/,

  // Kod pocztowy PL: 00-001
  postalPL: /^\d{2}-\d{3}$/,

  // Miasto/ulica: litery (PL), cyfry (dla typu "3 Maja"), spacje, kropka, myślnik
  cityOrStreet: /^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9\s.\-']{1,58}$/,

  // Telefon: E.164 (+48123456789) lub PL ze spacjami (np. +48 123 456 789 / 123456789)
  // - pozwala na opcjonalne + i separatory spacja/myślnik
  phone: /^(?:\+?\d{1,3})?[\s-]?(?:\d[\s-]?){7,14}\d$/,
};

function isValidISODateYYYYMMDD(s: string) {
  // Wstępnie format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return false;

  // Sprawdź czy po parsowaniu nie "przestawiło" daty (np. 2024-02-31)
  const [y, m, day] = s.split("-").map(Number);
  return (
    d.getUTCFullYear() === y &&
    d.getUTCMonth() + 1 === m &&
    d.getUTCDate() === day
  );
}

function calcAge(birthISO: string) {
  const [y, m, d] = birthISO.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  const mm = today.getMonth() + 1;
  const dd = today.getDate();
  if (mm < m || (mm === m && dd < d)) age--;
  return age;
}
/** -------------------------------------------------------- **/

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

  const [address, setAddress] = useState({
    city: "",
    postal_code: "",
    street_name: "",
    street_number: "",
    apartment_number: "",
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
    } catch {}
    return { text, data };
  }

  function fail(msg: string) {
    setError(msg);
    return false;
  }

  function validateAll(): boolean {
    const first = user.first_name.trim();
    const last = user.last_name.trim();
    const email = user.email.trim();
    const pass = user.password;
    const phone = user.phone_number.trim();

    const city = address.city.trim();
    const postal = address.postal_code.trim();
    const streetName = address.street_name.trim();
    const streetNoRaw = address.street_number.trim();
    const aptRaw = address.apartment_number.trim();

    // Required checks
    if (!first || !last || !email || !pass) {
      return fail("Please fill in first name, last name, email and password.");
    }

    // Regex checks
    if (!RE.name.test(first)) {
      return fail("First name is invalid (min 2 chars, letters/spaces/-/' only).");
    }
    if (!RE.name.test(last)) {
      return fail("Last name is invalid (min 2 chars, letters/spaces/-/' only).");
    }
    if (!RE.email.test(email)) {
      return fail("Email is invalid.");
    }
    if (!RE.password.test(pass)) {
      return fail(
        "Password must be 8-64 chars, include uppercase, lowercase, digit and special character, and contain no spaces."
      );
    }

    // birth_date
    if (!user.birth_date) return fail("Please provide birth date.");
    if (!isValidISODateYYYYMMDD(user.birth_date)) {
      return fail("Birth date is invalid (use a real date).");
    }
    // not in future + sensible age range
    const birth = new Date(user.birth_date);
    const today = new Date();
    if (birth.getTime() > today.getTime()) {
      return fail("Birth date cannot be in the future.");
    }
    const age = calcAge(user.birth_date);
    if (age < 13) return fail("You must be at least 13 years old.");
    if (age > 120) return fail("Birth date looks unrealistic (age > 120).");

    // Phone optional, but if provided -> regex
    if (phone && !RE.phone.test(phone)) {
      return fail("Phone number is invalid. Example: +48 123 456 789 or +48123456789.");
    }

    // Address required
    if (!city || !postal || !streetName || !streetNoRaw) {
      return fail(
        "Please fill in all required address fields (city, postal code, street name, street number)."
      );
    }
    if (!RE.cityOrStreet.test(city)) {
      return fail("City is invalid.");
    }
    if (!RE.postalPL.test(postal)) {
      return fail("Postal code is invalid. Example: 00-001.");
    }
    if (!RE.cityOrStreet.test(streetName)) {
      return fail("Street name is invalid.");
    }

    // numbers
    const streetNum = Number(streetNoRaw);
    if (!Number.isInteger(streetNum) || streetNum <= 0) {
      return fail("Street number must be a positive integer.");
    }

    const aptNum = aptRaw === "" ? null : Number(aptRaw);
    if (aptNum !== null && (!Number.isInteger(aptNum) || aptNum <= 0)) {
      return fail("Apartment number must be empty or a positive integer.");
    }

    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    setError(null);

    if (!validateAll()) return;

    const streetNum = Number(address.street_number.trim());
    const aptRaw = address.apartment_number.trim();
    const aptNum = aptRaw === "" ? null : Number(aptRaw);

    try {
      setLoading(true);

      const addressPayload: any = {
        city: address.city.trim(),
        postal_code: address.postal_code.trim(),
        street_name: address.street_name.trim(),
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

      const addressId =
        adrData?.id_adr ?? adrData?.address_id ?? adrData?.id ?? adrData?.data?.id_adr;

      if (!addressId) {
        throw new Error(
          `Address created but could not read address id. Response was: ${adrText || JSON.stringify(adrData)}`
        );
      }

      const userPayload: any = {
        ...user,
        first_name: user.first_name.trim(),
        last_name: user.last_name.trim(),
        email: user.email.trim(),
        phone_number: user.phone_number.trim(),
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
          (Array.isArray(userData?.detail)
            ? JSON.stringify(userData.detail, null, 2)
            : "") ||
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
