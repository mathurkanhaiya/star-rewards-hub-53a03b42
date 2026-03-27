const BASE = '/api/admin-auth';

export async function adminLogin(
  telegramId: number,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramId, password }),
  });
  return res.json();
}

export async function verifyAdminSession(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/verify-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json() as { valid: boolean };
    return data.valid;
  } catch {
    return false;
  }
}

export function getStoredSession(): string | null {
  return sessionStorage.getItem('adminSessionToken');
}

export function clearSession(): void {
  sessionStorage.removeItem('adminSessionToken');
}
