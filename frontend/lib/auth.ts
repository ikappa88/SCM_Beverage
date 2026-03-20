export type UserRole = "operator" | "administrator";

export interface AuthUser {
  user_id: number;
  full_name: string;
  role: UserRole;
  access_token: string;
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("access_token");
  const role = localStorage.getItem("role") as UserRole | null;
  const full_name = localStorage.getItem("full_name");
  const user_id = localStorage.getItem("user_id");
  if (!token || !role || !full_name || !user_id) return null;
  return { access_token: token, role, full_name, user_id: Number(user_id) };
}

export function isAuthenticated(): boolean {
  return getAuthUser() !== null;
}

export function isAdministrator(): boolean {
  return getAuthUser()?.role === "administrator";
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("role");
  localStorage.removeItem("full_name");
  localStorage.removeItem("user_id");
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const user = getAuthUser();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (user) {
    headers["Authorization"] = `Bearer ${user.access_token}`;
  }
  return fetch(`http://localhost:8000${path}`, { ...options, headers });
}
