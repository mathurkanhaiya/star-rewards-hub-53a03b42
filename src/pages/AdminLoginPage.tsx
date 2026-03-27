import { useState } from 'react';
import { Shield, Lock, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { adminLogin } from '@/lib/adminAuth';

interface Props {
  adminTelegramId: number;
  onAuthenticated: (token: string) => void;
}

export default function AdminLoginPage({ adminTelegramId, onAuthenticated }: Props) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!adminTelegramId || adminTelegramId === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{
        background: 'linear-gradient(135deg, hsl(220 25% 6%), hsl(220 25% 10%))'
      }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{
            background: 'hsl(0 60% 20%)', border: '1px solid hsl(0 60% 35%)'
          }}>
            <AlertCircle className="w-8 h-8" style={{ color: 'hsl(0 80% 65%)' }} />
          </div>
          <p className="text-white font-semibold mb-2">Telegram user not detected</p>
          <p className="text-sm" style={{ color: 'hsl(220 15% 50%)' }}>
            Please open the app inside Telegram
          </p>
        </div>
      </div>
    );
  }

  async function handleLogin() {
    if (!password) {
      setError('Please enter the admin password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await adminLogin(adminTelegramId, password);
      if (res.success && res.token) {
        sessionStorage.setItem('adminSessionToken', res.token);
        onAuthenticated(res.token);
      } else {
        setError(res.error || 'Login failed. Please try again.');
        setPassword('');
      }
    } catch (err: any) {
      console.error('Admin login error:', err);
      setError('Network error — please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{
      background: 'linear-gradient(135deg, hsl(220 25% 6%), hsl(220 25% 10%))'
    }}>
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{
            background: 'linear-gradient(135deg, hsl(262 80% 50%), hsl(220 80% 55%))',
            boxShadow: '0 8px 32px hsl(262 80% 50% / 0.4)'
          }}>
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Admin Access</h1>
          <p className="text-sm" style={{ color: 'hsl(220 15% 55%)' }}>
            Enter your admin password to continue
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{
          background: 'hsl(220 25% 10% / 0.8)',
          border: '1px solid hsl(220 30% 20% / 0.6)',
          backdropFilter: 'blur(20px)'
        }}>

          {/* Admin ID display */}
          <div className="mb-5">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'hsl(220 15% 55%)' }}>
              Admin Account
            </label>
            <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{
              background: 'hsl(220 25% 14%)',
              border: '1px solid hsl(220 30% 22%)'
            }}>
              <span className="text-white font-mono text-sm">{adminTelegramId}</span>
              <div className="ml-auto px-2 py-0.5 rounded text-xs font-semibold" style={{
                background: 'hsl(142 60% 20%)',
                color: 'hsl(142 70% 65%)'
              }}>
                Verified Admin
              </div>
            </div>
          </div>

          {/* Password input */}
          <div className="mb-5">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'hsl(220 15% 55%)' }}>
              Password
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-4 h-4" style={{ color: 'hsl(220 15% 45%)' }} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Enter admin password"
                autoFocus
                data-testid="input-admin-password"
                className="w-full rounded-xl pl-11 pr-12 py-3 text-sm outline-none"
                style={{
                  background: 'hsl(220 25% 14%)',
                  border: `1px solid ${error ? 'hsl(0 60% 40%)' : 'hsl(220 30% 22%)'}`,
                  color: 'white',
                  transition: 'border-color 0.2s'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity"
                tabIndex={-1}
              >
                {showPassword
                  ? <EyeOff className="w-4 h-4" style={{ color: 'hsl(220 15% 55%)' }} />
                  : <Eye className="w-4 h-4" style={{ color: 'hsl(220 15% 55%)' }} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl p-3 mb-4" style={{
              background: 'hsl(0 60% 15%)',
              border: '1px solid hsl(0 60% 30%)'
            }}>
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'hsl(0 80% 65%)' }} />
              <p className="text-xs leading-relaxed" style={{ color: 'hsl(0 80% 75%)' }}>{error}</p>
            </div>
          )}

          {/* Login button */}
          <button
            onClick={handleLogin}
            disabled={loading || !password}
            data-testid="button-admin-login"
            className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
            style={{
              background: (loading || !password)
                ? 'hsl(220 25% 18%)'
                : 'linear-gradient(135deg, hsl(262 80% 50%), hsl(220 80% 55%))',
              color: 'white',
              opacity: (loading || !password) ? 0.7 : 1
            }}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Logging in…</>
              : <><Shield className="w-4 h-4" /> Login to Admin Panel</>}
          </button>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'hsl(220 15% 30%)' }}>
          Admin ID {adminTelegramId} · 24h session
        </p>
      </div>
    </div>
  );
}
