// frontend/src/lib/auth.ts
import type { Role } from "../api/types";

export type AuthUser = {
  userId: number;
  role?: Role;
  firstName?: string;
  email?: string;
};

const KEY = "gms_auth_user";

function normalize(raw: any): AuthUser | null {
  if (!raw || typeof raw !== "object") return null;

  // migracja: stare -> nowe
  const userId = Number(raw.userId ?? raw.clientId ?? raw.user_id ?? 0);
  if (!Number.isFinite(userId) || userId <= 0) return null;

  const role: Role | undefined = typeof raw.role === "string" ? raw.role : undefined;

  const firstName: string | undefined =
    typeof raw.firstName === "string"
      ? raw.firstName
      : typeof raw.first_name === "string"
        ? raw.first_name
        : undefined;

  const email: string | undefined = typeof raw.email === "string" ? raw.email : undefined;

  return { userId, role, firstName, email };
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalize(parsed);
    // zapisujemy znormalizowaną wersję, żeby nie trzymać legacy shape
    if (normalized) localStorage.setItem(KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
}

// src/lib/auth.ts

function emitAuthChange() {
  window.dispatchEvent(new Event("authchange"));
}

export function setAuthUser(user: AuthUser) {
  localStorage.setItem(KEY, JSON.stringify(user));
  emitAuthChange();
}

export function clearAuthUser() {
  localStorage.removeItem(KEY);
  emitAuthChange();
}
