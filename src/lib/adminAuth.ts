const BASE = '/api/admin-auth';

export async function requestAdminOtp(telegramId: number): Promise<{ success: boolean; error?: string; message?: string }> {
  const res = await fetch(`${BASE}/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramId }),
  });
  return res.json();
}

export async function verifyAdminOtp(telegramId: number, otp: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const res = await fetch(`${BASE}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramId, otp }),
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
