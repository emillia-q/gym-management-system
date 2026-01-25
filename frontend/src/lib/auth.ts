export type AuthUser = {
  clientId: number;
  email?: string;
};

const KEY = "gms_auth_user";

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearAuthUser() {
  localStorage.removeItem(KEY);
}
