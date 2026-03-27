import { useState } from 'react';
import { Shield, Send, KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import { requestAdminOtp, verifyAdminOtp } from '@/lib/adminAuth';

interface Props {
  adminTelegramId: number;
  onAuthenticated: (token: string) => void;
}

export default function AdminLoginPage({ adminTelegramId, onAuthenticated }: Props) {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleRequestOtp() {
    setError('');
    setLoading(true);
    try {
      const res = await requestAdminOtp(adminTelegramId);
      if (res.success) {
        setSuccess('OTP sent to your Telegram chat!');
        setStep('verify');
      } else {
        setError(res.error || 'Failed to send OTP');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await verifyAdminOtp(adminTelegramId, otp);
      if (res.success && res.token) {
        sessionStorage.setItem('adminSessionToken', res.token);
        onAuthenticated(res.token);
      } else {
        setError(res.error || 'Invalid OTP. Please try again.');
        setOtp('');
      }
    } catch {
      setError('Network error. Please try again.');
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
            Secure OTP verification required
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{
          background: 'hsl(220 25% 10% / 0.8)',
          border: '1px solid hsl(220 30% 20% / 0.6)',
          backdropFilter: 'blur(20px)'
        }}>
          {step === 'request' ? (
            <>
              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(220 15% 55%)' }}>
                  Admin Telegram ID
                </label>
                <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{
                  background: 'hsl(220 25% 14%)',
                  border: '1px solid hsl(220 30% 22%)'
                }}>
                  <span className="text-white font-mono text-sm tracking-wider">{adminTelegramId}</span>
                  <div className="ml-auto px-2 py-0.5 rounded text-xs font-semibold" style={{
                    background: 'hsl(142 60% 20%)',
                    color: 'hsl(142 70% 65%)'
                  }}>
                    Verified Admin
                  </div>
                </div>
              </div>

              <p className="text-sm mb-5" style={{ color: 'hsl(220 15% 55%)' }}>
                An OTP will be sent to your Telegram private chat. Make sure you have started the bot first.
              </p>

              {error && (
                <div className="flex items-start gap-2 rounded-xl p-3 mb-4" style={{
                  background: 'hsl(0 60% 15%)',
                  border: '1px solid hsl(0 60% 30%)'
                }}>
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'hsl(0 80% 65%)' }} />
                  <p className="text-xs" style={{ color: 'hsl(0 80% 75%)' }}>{error}</p>
                </div>
              )}

              <button
                onClick={handleRequestOtp}
                disabled={loading}
                data-testid="button-request-otp"
                className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                style={{
                  background: loading ? 'hsl(220 25% 18%)' : 'linear-gradient(135deg, hsl(262 80% 50%), hsl(220 80% 55%))',
                  color: 'white',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP…</>
                ) : (
                  <><Send className="w-4 h-4" /> Send OTP to Telegram</>
                )}
              </button>
            </>
          ) : (
            <>
              {success && (
                <div className="flex items-start gap-2 rounded-xl p-3 mb-5" style={{
                  background: 'hsl(142 60% 10%)',
                  border: '1px solid hsl(142 60% 25%)'
                }}>
                  <p className="text-xs" style={{ color: 'hsl(142 70% 65%)' }}>✓ {success}</p>
                </div>
              )}

              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(220 15% 55%)' }}>
                  Enter 6-Digit OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="_ _ _ _ _ _"
                  data-testid="input-otp"
                  className="w-full rounded-xl px-4 py-4 text-center text-2xl font-mono font-bold tracking-[0.4em] outline-none"
                  style={{
                    background: 'hsl(220 25% 14%)',
                    border: `1px solid ${otp.length === 6 ? 'hsl(262 80% 50%)' : 'hsl(220 30% 22%)'}`,
                    color: 'white',
                    transition: 'border-color 0.2s'
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                  autoFocus
                />
                <p className="text-xs mt-2 text-center" style={{ color: 'hsl(220 15% 45%)' }}>
                  Check your Telegram private chat
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl p-3 mb-4" style={{
                  background: 'hsl(0 60% 15%)',
                  border: '1px solid hsl(0 60% 30%)'
                }}>
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'hsl(0 80% 65%)' }} />
                  <p className="text-xs" style={{ color: 'hsl(0 80% 75%)' }}>{error}</p>
                </div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                data-testid="button-verify-otp"
                className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all mb-3"
                style={{
                  background: (loading || otp.length !== 6)
                    ? 'hsl(220 25% 18%)'
                    : 'linear-gradient(135deg, hsl(142 70% 35%), hsl(142 60% 45%))',
                  color: 'white',
                  opacity: (loading || otp.length !== 6) ? 0.7 : 1
                }}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                ) : (
                  <><KeyRound className="w-4 h-4" /> Verify & Enter</>
                )}
              </button>

              <button
                onClick={() => { setStep('request'); setOtp(''); setError(''); setSuccess(''); }}
                className="w-full py-2 text-sm transition-opacity hover:opacity-70"
                style={{ color: 'hsl(220 15% 50%)' }}
              >
                Resend OTP
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'hsl(220 15% 35%)' }}>
          Admin access is restricted to authorized personnel only
        </p>
      </div>
    </div>
  );
}
