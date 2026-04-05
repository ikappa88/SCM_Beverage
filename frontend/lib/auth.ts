export type UserRole = "operator" | "administrator";

export interface AuthUser {
  user_id: number;
  full_name: string;
  role: UserRole;
  access_token: string;
  assigned_location_ids: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("access_token");
  const role = localStorage.getItem("role") as UserRole | null;
  const full_name = localStorage.getItem("full_name");
  const user_id = localStorage.getItem("user_id");
  if (!token || !role || !full_name || !user_id) return null;
  return {
    access_token: token,
    role,
    full_name,
    user_id: Number(user_id),
    assigned_location_ids: localStorage.getItem("assigned_location_ids") ?? "",
  };
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
  localStorage.removeItem("assigned_location_ids");
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
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    logout();
    window.location.href = "/login";
  }
  return res;
}

export { API_BASE };
