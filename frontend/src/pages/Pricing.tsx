import { useEffect, useMemo, useState } from "react";
import { api } from "../api/http";
import { getAuthUser } from "../lib/auth";

type PaymentMethod = "ONLINE" | "CASH";
type PurchaseChannel = "CLIENT" | "RECEPTION_ONLY";

type MembershipCatalogItem = {
  type: "ONE_TIME_PASS" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | string;
  variant: "GYM" | "GYM_SAUNA" | string;
  purchase_channel: PurchaseChannel | string;
  allowed_payment: PaymentMethod[];
};

type PurchaseRequestDto = {
  type: MembershipCatalogItem["type"];
  start_date: string; // YYYY-MM-DD
  with_sauna: boolean;
  payment_method: PaymentMethod;
};

type MembershipResponseDto = {
  membership_id: number;
  client_id: number;
  type: MembershipCatalogItem["type"];
  with_sauna: boolean;
  price: number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  payment_status: string; // "ACTIVATED" | "TO_PAY"
  payment_method: PaymentMethod;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatDate(date?: string | null) {
  if (!date) return "-";
  if (DATE_ONLY_RE.test(date)) {
    const [y, m, dd] = date.split("-").map(Number);
    const d = new Date(y, m - 1, dd);
    return d.toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
  }
  const d = new Date(date);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-GB");
  return date;
}

function prettyType(t: string) {
  switch (t) {
    case "ONE_TIME_PASS":
      return "One-time pass";
    case "MONTHLY":
      return "Monthly";
    case "QUARTERLY":
      return "Quarterly";
    case "ANNUAL":
      return "Annual";
    default:
      return t;
  }
}

function prettyVariant(v: string) {
  if (v === "GYM") return "Gym";
  if (v === "GYM_SAUNA") return "Gym + Sauna";
  return v;
}

function prettyPayment(p: PaymentMethod) {
  return p === "ONLINE" ? "Online" : "Cash";
}

function isWithSauna(variant: string) {
  return variant === "GYM_SAUNA" || variant.includes("SAUNA");
}

export default function Pricing() {
  const user = getAuthUser();
  const isClient = user?.role === "CLIENT" && !!user?.userId;

  const [catalog, setCatalog] = useState<MembershipCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return catalog.find((c) => `${c.type}__${c.variant}` === selectedKey) ?? null;
  }, [catalog, selectedKey]);

  const allowedPayments = useMemo(() => selected?.allowed_payment ?? [], [selected]);

  const [startDate, setStartDate] = useState<string>(todayYmd());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ONLINE");

  const [purchasing, setPurchasing] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [success, setSuccess] = useState<MembershipResponseDto | null>(null);

  async function loadCatalog() {
    setLoading(true);
    setError(null);
    setActionMsg(null);

    try {
      const data = await api.get<MembershipCatalogItem[]>("/memberships/catalog");
      if (!Array.isArray(data)) throw new Error("API did not return an array.");
      setCatalog(data);

      // auto-select something sensible
      if (!selectedKey && data.length > 0) {
        const firstClient = data.find((x) => (x.purchase_channel ?? "CLIENT") === "CLIENT") ?? data[0];
        setSelectedKey(`${firstClient.type}__${firstClient.variant}`);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  }

  // if plan changes and current payment is not allowed -> pick first allowed
  useEffect(() => {
    if (!selected) return;
    const allowed = selected.allowed_payment ?? [];
    if (allowed.length === 0) return;
    if (!allowed.includes(paymentMethod)) setPaymentMethod(allowed[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  async function purchase() {
    setActionMsg(null);
    setSuccess(null);

    if (!user) {
      setActionMsg({ type: "error", text: "Please log in first." });
      return;
    }
    if (!isClient) {
      setActionMsg({ type: "error", text: "Sign in as CLIENT to purchase a membership." });
      return;
    }
    if (!selected) {
      setActionMsg({ type: "error", text: "Select a plan first." });
      return;
    }

    const channel = (selected.purchase_channel ?? "CLIENT") as PurchaseChannel;
    if (channel !== "CLIENT") {
      setActionMsg({ type: "error", text: "This plan can be purchased only at reception." });
      return;
    }

    if (!startDate || !DATE_ONLY_RE.test(startDate)) {
      setActionMsg({ type: "error", text: "Select a valid start date." });
      return;
    }

    if (allowedPayments.length > 0 && !allowedPayments.includes(paymentMethod)) {
      setActionMsg({ type: "error", text: "Selected payment method is not allowed for this plan." });
      return;
    }

    setPurchasing(true);
    try {
      const payload: PurchaseRequestDto = {
        type: selected.type,
        start_date: startDate,
        with_sauna: isWithSauna(selected.variant),
        payment_method: paymentMethod,
      };

      const res = await api.post<MembershipResponseDto>(
        `/clients/${user.userId}/memberships/purchase`,
        payload
      );

      setSuccess(res);
      setActionMsg({ type: "success", text: "Purchase successful!" });
    } catch (e: any) {
      setActionMsg({ type: "error", text: String(e?.message ?? e) });
    } finally {
      setPurchasing(false);
    }
  }

  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Pricing</h1>
      <p style={{ opacity: 0.85, marginTop: 6 }}>Choose a plan and purchase a membership.</p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={loadCatalog}
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

        <div style={{ opacity: 0.75 }}>{loading ? "Loading..." : `${catalog.length} plans`}</div>

        {!user && <div style={{ opacity: 0.85 }}>Log in to purchase.</div>}
        {user && !isClient && (
          <div style={{ opacity: 0.85 }}>
            Signed in as <b>{user.role ?? "?"}</b> — sign in as <b>CLIENT</b> to purchase.
          </div>
        )}
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

      {success && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(0,255,120,0.20)",
            background: "rgba(0,255,120,0.08)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>Success</div>

          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            <div>
              membership_id: <b>{success.membership_id}</b>
            </div>
            <div>
              end_date: <b>{formatDate(success.end_date)}</b>
            </div>
            <div>
              payment_status: <b>{success.payment_status}</b>
            </div>

            {/* (dodatkowo, bo backend zwraca) */}
            <div style={{ opacity: 0.9, marginTop: 6 }}>
              Price: <b>{success.price}</b> · Start: <b>{formatDate(success.start_date)}</b> · Payment:{" "}
              <b>{prettyPayment(success.payment_method)}</b>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSuccess(null)}
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Buy another
          </button>
        </div>
      )}

      {/* Catalog list */}
      <div style={{ marginTop: 18 }}>
        <h2 style={{ marginBottom: 10 }}>Plans</h2>

        {loading ? (
          <p style={{ opacity: 0.8 }}>Loading catalog...</p>
        ) : catalog.length === 0 ? (
          <p style={{ opacity: 0.8 }}>No plans available.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {catalog.map((c) => {
              const key = `${c.type}__${c.variant}`;
              const selected = key === selectedKey;
              const channel = (c.purchase_channel ?? "CLIENT") as PurchaseChannel;
              const receptionOnly = channel !== "CLIENT";

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 14,
                    border: selected ? "1px solid rgba(255,255,255,0.28)" : "1px solid rgba(255,255,255,0.10)",
                    background: selected ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                    color: "inherit",
                    cursor: "pointer",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>
                      {prettyType(String(c.type))} · {prettyVariant(String(c.variant))}
                    </div>

                    {receptionOnly && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          padding: "3px 10px",
                          borderRadius: 999,
                          border: "1px solid rgba(255,200,0,0.25)",
                          background: "rgba(255,200,0,0.10)",
                        }}
                      >
                        Reception only
                      </span>
                    )}
                  </div>

                  <div style={{ opacity: 0.85, fontSize: 13 }}>
                    Allowed payment: <b>{(c.allowed_payment ?? []).map(prettyPayment).join(", ") || "-"}</b>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Purchase section */}
      <div style={{ marginTop: 18 }}>
        <h2 style={{ marginBottom: 10 }}>Purchase</h2>

        {!selected ? (
          <p style={{ opacity: 0.8 }}>Select a plan.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 12,
              padding: 14,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ fontWeight: 900 }}>
              Selected: {prettyType(String(selected.type))} · {prettyVariant(String(selected.variant))}
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ opacity: 0.85 }}>Start date</span>
              <input
                type="date"
                value={startDate}
                min={todayYmd()}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                  width: "fit-content",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ opacity: 0.85 }}>Payment method</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                  width: "fit-content",
                }}
              >
                {(allowedPayments.length ? allowedPayments : (["ONLINE", "CASH"] as PaymentMethod[])).map((p) => (
                  <option key={p} value={p}>
                    {prettyPayment(p)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={purchase}
              disabled={
                purchasing ||
                !isClient ||
                (selected.purchase_channel ?? "CLIENT") !== "CLIENT" ||
                (allowedPayments.length > 0 && !allowedPayments.includes(paymentMethod))
              }
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "inherit",
                cursor: purchasing ? "not-allowed" : "pointer",
                opacity:
                  purchasing ||
                  !isClient ||
                  (selected.purchase_channel ?? "CLIENT") !== "CLIENT" ||
                  (allowedPayments.length > 0 && !allowedPayments.includes(paymentMethod))
                    ? 0.7
                    : 1,
                width: "fit-content",
                minWidth: 220,
              }}
            >
              {purchasing ? "Purchasing..." : "Purchase membership"}
            </button>

            {(selected.purchase_channel ?? "CLIENT") !== "CLIENT" && (
              <div style={{ opacity: 0.85 }}>This plan is available only at reception.</div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, opacity: 0.75, fontSize: 13 }}>
        API: <code>/api/memberships/catalog</code> · purchase:{" "}
        <code>/api/clients/&lt;userId&gt;/memberships/purchase</code>
      </div>
    </div>
  );
}
