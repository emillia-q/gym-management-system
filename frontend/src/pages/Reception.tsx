import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/http";
import { getAuthUser } from "../lib/auth";

type PaymentMethod = "ONLINE" | "CASH";

type MembershipCatalogItem = {
  type: string; // enum from backend (e.g. MONTHLY)
  variant: "GYM" | "GYM_SAUNA";
  purchase_channel: "CLIENT" | "RECEPTION_ONLY";
  allowed_payment: PaymentMethod[];
};

type MembershipResponse = {
  membership_id: number;
  client_id: number;
  type: string;
  with_sauna: boolean;
  price: number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  payment_status: string;
  payment_method: PaymentMethod;
};

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
};

type BookingDto = {
  booking_id?: number;
  group_class_id?: number;
};

function getId(c: GroupClassDto) {
  return Number(c.id_c ?? c.id ?? 0);
}

function getName(c: GroupClassDto) {
  return c.name ?? c.class_name ?? "-";
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const DATE_FMT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};

function formatDate(date?: string | null) {
  if (!date) return "-";
  if (DATE_ONLY_RE.test(date)) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", DATE_FMT);
  }
  const d = new Date(date);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-GB", DATE_FMT);
  return date;
}

function formatTimeOnly(time?: string | null) {
  if (!time) return "-";
  return time.slice(0, 5); // HH:MM:SS -> HH:MM
}

function todayYmd() {
  const d = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function Reception() {
  const navigate = useNavigate();
  const user = getAuthUser();

  const isReceptionist = user?.role === "RECEPTIONIST" && !!user?.userId;

  const [tab, setTab] = useState<"sell" | "reserve">("sell");

  // Shared data
  const [catalog, setCatalog] = useState<MembershipCatalogItem[]>([]);
  const [classes, setClasses] = useState<GroupClassDto[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // ----- SELL MEMBERSHIP -----
  const [sellMode, setSellMode] = useState<"existing" | "new">("existing");
  const [sellClientId, setSellClientId] = useState("");
  const [sellNew, setSellNew] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    gender: "F" as "F" | "M" | "O",
    birth_date: "",
    address_id: "1",
  });

  const [sellCatalogKey, setSellCatalogKey] = useState<string>("");
  const selectedCatalogItem = useMemo(() => {
    return catalog.find((x) => `${x.type}|${x.variant}` === sellCatalogKey) ?? null;
  }, [catalog, sellCatalogKey]);

  const [sellStartDate, setSellStartDate] = useState(todayYmd());
  const [sellPaymentMethod, setSellPaymentMethod] = useState<PaymentMethod>("CASH");
  const [sellPriceOverride, setSellPriceOverride] = useState<string>("");
  const [sellSubmitting, setSellSubmitting] = useState(false);
  const [sellResult, setSellResult] = useState<MembershipResponse | null>(null);
  const [sellError, setSellError] = useState<string | null>(null);

  // ----- RESERVE CLASS -----
  const [reserveClientId, setReserveClientId] = useState("");
  const [reserveMembershipId, setReserveMembershipId] = useState("");
  const [reserveQ, setReserveQ] = useState("");
  const [reserveBusyId, setReserveBusyId] = useState<number | null>(null);
  const [reserveMsg, setReserveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [reservedSet, setReservedSet] = useState<Set<number>>(new Set());

  // --------- styles ----------
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
  };

  // ✅ fixes native controls on Windows (dark mode)
  const select: React.CSSProperties = {
    ...input,
    colorScheme: "dark",
  };

  const dateInput: React.CSSProperties = {
    ...input,
    colorScheme: "dark",
  };

  // ✅ fallback: when dropdown list is white, force readable text
  const optionStyle: React.CSSProperties = {
    color: "#111",
    backgroundColor: "#fff",
  };

  // ✅ reserve enablement
  const reserveClientIdNum = Number(reserveClientId);
  const reserveClientOk = Number.isInteger(reserveClientIdNum) && reserveClientIdNum > 0;

  useEffect(() => {
    if (!isReceptionist) return;

    setGlobalError(null);

    // catalog
    setLoadingCatalog(true);
    api
      .get<MembershipCatalogItem[]>("/memberships/catalog")
      .then((items) => {
        const arr = Array.isArray(items) ? items : [];
        setCatalog(arr);

        const first = arr[0];
        if (first) {
          setSellCatalogKey(`${first.type}|${first.variant}`);
          setSellPaymentMethod(first.allowed_payment?.[0] ?? "CASH");
        }
      })
      .catch((e: any) => setGlobalError(String(e?.message ?? e)))
      .finally(() => setLoadingCatalog(false));

    // classes
    setLoadingClasses(true);
    api
      .get<GroupClassDto[]>("/schedule/classes")
      .then((items) => setClasses(Array.isArray(items) ? items : []))
      .catch((e: any) => setGlobalError(String(e?.message ?? e)))
      .finally(() => setLoadingClasses(false));
  }, [isReceptionist]);

  // keep payment method compatible with selected plan
  useEffect(() => {
    if (!selectedCatalogItem) return;
    if (!selectedCatalogItem.allowed_payment?.includes(sellPaymentMethod)) {
      setSellPaymentMethod(selectedCatalogItem.allowed_payment?.[0] ?? "CASH");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellCatalogKey]);

  async function submitSell(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.userId) return;

    setSellError(null);
    setSellResult(null);

    if (!selectedCatalogItem) {
      setSellError("Please choose a membership plan.");
      return;
    }
    if (!sellStartDate) {
      setSellError("Please choose a start date.");
      return;
    }

    const withSauna = selectedCatalogItem.variant === "GYM_SAUNA";
    const payload: any = {
      receptionist_id: user.userId,
      type: selectedCatalogItem.type,
      start_date: sellStartDate,
      with_sauna: withSauna,
      payment_method: sellPaymentMethod,
    };

    const override = sellPriceOverride.trim();
    if (override !== "") {
      const n = Number(override);
      if (!Number.isFinite(n) || n < 0) {
        setSellError("Price override must be a non-negative number.");
        return;
      }
      payload.price_override = Math.round(n);
    }

    if (sellMode === "existing") {
      const idNum = Number(sellClientId);
      if (!Number.isInteger(idNum) || idNum <= 0) {
        setSellError("Please provide a valid client_id (number > 0).");
        return;
      }
      payload.client_id = idNum;
    } else {
      if (!sellNew.email || !sellNew.password || !sellNew.first_name || !sellNew.last_name) {
        setSellError("Please fill: email, password, first name, last name.");
        return;
      }
      if (!sellNew.phone_number || !sellNew.birth_date) {
        setSellError("Please fill: phone number and birth date.");
        return;
      }
      const adrId = Number(sellNew.address_id);
      if (!Number.isInteger(adrId) || adrId <= 0) {
        setSellError("Address ID must be a number > 0 (required by DB).");
        return;
      }

      payload.new_client_email = sellNew.email.trim();
      payload.new_client_password = sellNew.password;
      payload.new_client_first_name = sellNew.first_name.trim();
      payload.new_client_last_name = sellNew.last_name.trim();
      payload.new_client_phone_number = sellNew.phone_number.trim();
      payload.new_client_gender = sellNew.gender;
      payload.new_client_birth_date = sellNew.birth_date;
      payload.new_client_address_id = adrId;
    }

    setSellSubmitting(true);
    try {
      const res = await api.post<MembershipResponse>("/reception/memberships/sell", payload);
      setSellResult(res);
      setSellClientId(String(res.client_id));
      setReserveClientId(String(res.client_id));
    } catch (e: any) {
      setSellError(String(e?.message ?? e));
    } finally {
      setSellSubmitting(false);
    }
  }

  async function loadClientBookings(clientId: number) {
    const bookings = await api.get<BookingDto[]>(`/schedule/my-bookings/${clientId}`);
    const set = new Set<number>();
    for (const b of Array.isArray(bookings) ? bookings : []) {
      const id = Number(b.group_class_id ?? b.booking_id ?? 0);
      if (id) set.add(id);
    }
    setReservedSet(set);
  }

  useEffect(() => {
    setReserveMsg(null);
    const id = Number(reserveClientId);
    if (!isReceptionist || !Number.isInteger(id) || id <= 0) {
      setReservedSet(new Set());
      return;
    }
    loadClientBookings(id).catch(() => setReservedSet(new Set()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserveClientId, isReceptionist]);

  const reserveFiltered = useMemo(() => {
    const s = reserveQ.trim().toLowerCase();
    const arr = Array.isArray(classes) ? [...classes] : [];
    const filtered = !s
      ? arr
      : arr.filter((c) => {
          const name = getName(c).toLowerCase();
          const room = (c.room ?? "").toLowerCase();
          return name.includes(s) || room.includes(s);
        });

    filtered.sort((a, b) => {
      const ad = a.start_date ?? "";
      const bd = b.start_date ?? "";
      if (ad !== bd) return ad.localeCompare(bd);
      const at = a.start_time ?? "";
      const bt = b.start_time ?? "";
      return at.localeCompare(bt);
    });

    return filtered;
  }, [classes, reserveQ]);

  async function reserveClass(groupClassId: number) {
    if (!user?.userId) return;

    const clientId = Number(reserveClientId);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      setReserveMsg({ type: "error", text: "Provide a valid client_id first." });
      return;
    }

    setReserveMsg(null);
    setReserveBusyId(groupClassId);

    try {
      const membershipRaw = reserveMembershipId.trim();
      const membershipId = membershipRaw === "" ? null : Number(membershipRaw);
      if (membershipRaw !== "" && (!Number.isInteger(membershipId) || (membershipId as number) <= 0)) {
        setReserveMsg({ type: "error", text: "membership_id must be empty or a positive integer." });
        return;
      }

      const body: any = {
        receptionist_id: user.userId,
        client_id: clientId,
      };
      if (membershipId) body.membership_id = membershipId;

      const res = await api.post<{ ok: boolean; status: string }>(
        `/reception/group-classes/${groupClassId}/reserve`,
        body
      );

      setReserveMsg({ type: "success", text: `Reserved. Status: ${res?.status ?? "OK"}` });
      await loadClientBookings(clientId);
    } catch (e: any) {
      setReserveMsg({ type: "error", text: String(e?.message ?? e) });
    } finally {
      setReserveBusyId(null);
    }
  }

  if (!isReceptionist) {
    return (
      <div style={{ maxWidth: 860, padding: 24 }}>
        <h1>Reception</h1>
        <div style={{ marginTop: 10, color: "tomato" }}>Access denied: RECEPTIONIST only.</div>
        <button type="button" onClick={() => navigate("/login")} style={{ ...btn, marginTop: 14, width: 220 }}>
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1>Reception panel</h1>
      <p style={{ opacity: 0.85, marginTop: 6 }}>Sell memberships and reserve group classes on behalf of clients.</p>

      {globalError && <div style={{ marginTop: 12, color: "tomato" }}>Error: {globalError}</div>}

      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setTab("sell")} style={tab === "sell" ? btn : btnGhost}>
          Sell membership
        </button>
        <button type="button" onClick={() => setTab("reserve")} style={tab === "reserve" ? btn : btnGhost}>
          Reserve group class
        </button>

        <div style={{ marginLeft: "auto", opacity: 0.75, display: "flex", gap: 10, alignItems: "center" }}>
          <span>Catalog: {loadingCatalog ? "loading…" : `${catalog.length} items`}</span>
          <span>Classes: {loadingClasses ? "loading…" : `${classes.length}`}</span>
        </div>
      </div>

      {tab === "sell" ? (
        <div style={panel}>
          <h2 style={{ marginTop: 0 }}>Sell membership</h2>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" onClick={() => setSellMode("existing")} style={sellMode === "existing" ? btn : btnGhost}>
              Existing client
            </button>
            <button type="button" onClick={() => setSellMode("new")} style={sellMode === "new" ? btn : btnGhost}>
              New client (quick registration)
            </button>
          </div>

          {sellError && <div style={{ marginTop: 10, color: "tomato" }}>Error: {sellError}</div>}

          <form onSubmit={submitSell} style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {sellMode === "existing" ? (
              <label>
                Client ID
                <input
                  value={sellClientId}
                  onChange={(e) => setSellClientId(e.target.value)}
                  placeholder="e.g. 12"
                  inputMode="numeric"
                  style={input}
                />
              </label>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label>
                    First name
                    <input value={sellNew.first_name} onChange={(e) => setSellNew((p) => ({ ...p, first_name: e.target.value }))} style={input} />
                  </label>
                  <label>
                    Last name
                    <input value={sellNew.last_name} onChange={(e) => setSellNew((p) => ({ ...p, last_name: e.target.value }))} style={input} />
                  </label>
                </div>

                <label>
                  Email
                  <input value={sellNew.email} onChange={(e) => setSellNew((p) => ({ ...p, email: e.target.value }))} type="email" style={input} />
                </label>

                <label>
                  Password (for client login)
                  <input value={sellNew.password} onChange={(e) => setSellNew((p) => ({ ...p, password: e.target.value }))} type="password" style={input} />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <label>
                    Phone
                    <input value={sellNew.phone_number} onChange={(e) => setSellNew((p) => ({ ...p, phone_number: e.target.value }))} style={input} />
                  </label>

                  <label>
                    Gender
                    <select value={sellNew.gender} onChange={(e) => setSellNew((p) => ({ ...p, gender: e.target.value as any }))} style={select}>
                      <option value="F" style={optionStyle}>F</option>
                      <option value="M" style={optionStyle}>M</option>
                      <option value="O" style={optionStyle}>O</option>
                    </select>
                  </label>

                  <label>
                    Birth date
                    <input value={sellNew.birth_date} onChange={(e) => setSellNew((p) => ({ ...p, birth_date: e.target.value }))} type="date" style={dateInput} />
                  </label>
                </div>

                <label>
                  Address ID (required)
                  <input value={sellNew.address_id} onChange={(e) => setSellNew((p) => ({ ...p, address_id: e.target.value }))} inputMode="numeric" style={input} />
                  <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
                    Your DB requires address_id. If you don't have addresses UI yet, use an existing address ID (often 1).
                  </div>
                </label>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                Plan
                <select value={sellCatalogKey} onChange={(e) => setSellCatalogKey(e.target.value)} style={select}>
                  {catalog.map((it) => {
                    const key = `${it.type}|${it.variant}`;
                    const label = `${it.type} · ${it.variant === "GYM_SAUNA" ? "GYM + SAUNA" : "GYM"}`;
                    return (
                      <option key={key} value={key} style={optionStyle}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label>
                Start date
                <input value={sellStartDate} onChange={(e) => setSellStartDate(e.target.value)} type="date" style={dateInput} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                Payment method
                <select value={sellPaymentMethod} onChange={(e) => setSellPaymentMethod(e.target.value as PaymentMethod)} style={select}>
                  {(selectedCatalogItem?.allowed_payment?.length ? selectedCatalogItem.allowed_payment : (["CASH", "ONLINE"] as PaymentMethod[])).map(
                    (pm) => (
                      <option key={pm} value={pm} style={optionStyle}>
                        {pm}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Price override (optional)
                <input
                  value={sellPriceOverride}
                  onChange={(e) => setSellPriceOverride(e.target.value)}
                  placeholder="leave empty for default"
                  inputMode="numeric"
                  style={input}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={sellSubmitting}
              style={{
                ...btn,
                width: 220,
                opacity: sellSubmitting ? 0.7 : 1,
                cursor: sellSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {sellSubmitting ? "Selling…" : "Sell membership"}
            </button>
          </form>

          {sellResult && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(0,255,120,0.22)",
                background: "rgba(0,255,120,0.08)",
              }}
            >
              <div style={{ fontWeight: 900 }}>Success</div>
              <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 13, opacity: 0.95 }}>
                <div>
                  membership_id: <b>{sellResult.membership_id}</b>
                </div>
                <div>
                  client_id: <b>{sellResult.client_id}</b>
                </div>
                <div>
                  type: <b>{sellResult.type}</b> · {sellResult.with_sauna ? "GYM+SAUNA" : "GYM"}
                </div>
                <div>
                  valid: <b>{formatDate(sellResult.start_date)}</b> → <b>{formatDate(sellResult.end_date)}</b>
                </div>
                <div>
                  payment: <b>{sellResult.payment_status}</b> ({sellResult.payment_method})
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={panel}>
          <h2 style={{ marginTop: 0 }}>Reserve group class</h2>

          {reserveMsg && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: reserveMsg.type === "success" ? "rgba(0,255,120,0.10)" : "rgba(255,0,0,0.10)",
                color: reserveMsg.type === "success" ? "inherit" : "tomato",
              }}
            >
              {reserveMsg.text}
            </div>
          )}

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Client ID
              <input value={reserveClientId} onChange={(e) => setReserveClientId(e.target.value)} placeholder="e.g. 12" inputMode="numeric" style={input} />
              <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>Already reserved: {reservedSet.size}</div>
            </label>

            <label>
              membership_id (optional)
              <input value={reserveMembershipId} onChange={(e) => setReserveMembershipId(e.target.value)} placeholder="leave empty if none" inputMode="numeric" style={input} />
            </label>
          </div>

          {!reserveClientOk && (
            <div style={{ marginTop: 10, opacity: 0.9 }}>
              Enter <b>Client ID</b> to enable reserving classes.
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={reserveQ}
              onChange={(e) => setReserveQ(e.target.value)}
              placeholder="Search by class name or room…"
              style={{ ...input, marginTop: 0, maxWidth: 420 }}
            />
            <div style={{ opacity: 0.75 }}>{loadingClasses ? "Loading…" : `${reserveFiltered.length} classes`}</div>
          </div>

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
                  <th style={{ padding: 12 }}>Date</th>
                  <th style={{ padding: 12 }}>Time</th>
                  <th style={{ padding: 12 }}>Room</th>
                  <th style={{ padding: 12 }}>ID</th>
                  <th style={{ padding: 12 }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {loadingClasses ? (
                  <tr>
                    <td style={{ padding: 12, opacity: 0.8 }} colSpan={6}>
                      Loading schedule…
                    </td>
                  </tr>
                ) : reserveFiltered.length === 0 ? (
                  <tr>
                    <td style={{ padding: 12, opacity: 0.8 }} colSpan={6}>
                      No classes found.
                    </td>
                  </tr>
                ) : (
                  reserveFiltered.map((c) => {
                    const id = getId(c);
                    const reserved = reservedSet.has(id);
                    const busy = reserveBusyId === id;

                    return (
                      <tr key={id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                        <td style={{ padding: 12, fontWeight: 800 }}>{getName(c)}</td>
                        <td style={{ padding: 12 }}>{formatDate(c.start_date ?? null)}</td>
                        <td style={{ padding: 12 }}>
                          {formatTimeOnly(c.start_time ?? null)}–{formatTimeOnly(c.end_time ?? null)}
                        </td>
                        <td style={{ padding: 12 }}>{c.room ?? "-"}</td>
                        <td style={{ padding: 12, opacity: 0.8 }}>{id || "-"}</td>
                        <td style={{ padding: 12 }}>
                          {reserved ? (
                            <span style={{ opacity: 0.85, fontWeight: 700 }}>Reserved</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => reserveClass(id)}
                              disabled={busy || !id || !reserveClientOk}
                              style={{
                                ...btn,
                                padding: "8px 10px",
                                opacity: busy || !reserveClientOk ? 0.7 : 1,
                                cursor: busy || !reserveClientOk ? "not-allowed" : "pointer",
                              }}
                            >
                              {busy ? "Reserving…" : "Reserve"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, opacity: 0.75, fontSize: 13 }}>
        API: <code>/api/reception/memberships/sell</code> · <code>/api/reception/group-classes/{`{id}`}/reserve</code>
      </div>
    </div>
  );
}
