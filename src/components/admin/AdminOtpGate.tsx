import React, { useEffect, useState, useRef } from 'react';

const SERVER = '';

const CSS = `
@keyframes otpFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
@keyframes otpPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
@keyframes otpSpin { to{transform:rotate(360deg)} }
@keyframes otpGlow {
  0%,100%{box-shadow:0 0 24px rgba(239,68,68,0.25);}
  50%{box-shadow:0 0 48px rgba(239,68,68,0.5);}
}
@keyframes otpShake {
  0%,100%{transform:translateX(0)}
  20%{transform:translateX(-8px)}
  40%{transform:translateX(8px)}
  60%{transform:translateX(-6px)}
  80%{transform:translateX(6px)}
}

.otp-wrap {
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  padding:24px; font-family:'Rajdhani',sans-serif; color:#fff;
  background:#0a0c12;
  position:relative; overflow:hidden;
}
.otp-bg {
  position:fixed; inset:0;
  background:
    radial-gradient(ellipse 70% 50% at 50% 0%, rgba(239,68,68,0.07) 0%, transparent 60%),
    radial-gradient(ellipse 50% 50% at 80% 80%, rgba(239,68,68,0.04) 0%, transparent 60%);
  pointer-events:none;
}
.otp-grid {
  position:fixed; inset:0;
  background-image:
    linear-gradient(rgba(239,68,68,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(239,68,68,0.025) 1px, transparent 1px);
  background-size:32px 32px;
  pointer-events:none;
}
.otp-card {
  width:100%; max-width:360px;
  background:rgba(255,255,255,0.03);
  border:1px solid rgba(239,68,68,0.2);
  border-radius:28px; padding:36px 28px;
  position:relative; z-index:1;
  animation:otpFadeIn 0.4s ease;
  box-shadow:0 0 60px rgba(239,68,68,0.08);
}
.otp-shield {
  width:72px; height:72px; border-radius:22px;
  background:linear-gradient(135deg,#ef4444,#b91c1c);
  border:1px solid rgba(239,68,68,0.5);
  display:flex; align-items:center; justify-content:center;
  font-size:32px; margin:0 auto 20px;
  animation:otpGlow 3s ease-in-out infinite;
}
.otp-title {
  font-family:'Orbitron',monospace; font-size:18px; font-weight:900;
  letter-spacing:3px; color:#ef4444;
  text-shadow:0 0 20px rgba(239,68,68,0.4);
  text-align:center; margin-bottom:6px;
}
.otp-subtitle {
  font-size:12px; color:rgba(255,255,255,0.35);
  letter-spacing:2px; text-align:center; text-transform:uppercase;
  margin-bottom:28px;
}
.otp-step-info {
  font-size:13px; color:rgba(255,255,255,0.55); text-align:center;
  line-height:1.6; margin-bottom:24px;
}
.otp-step-info b { color:#ef4444; }

.otp-input-row {
  display:flex; gap:8px; justify-content:center; margin-bottom:20px;
}
.otp-digit {
  width:44px; height:54px; border-radius:14px;
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(239,68,68,0.2);
  color:#fff; font-family:'Orbitron',monospace;
  font-size:22px; font-weight:700; text-align:center;
  outline:none; caret-color:transparent;
  transition:border-color 0.2s, box-shadow 0.2s;
}
.otp-digit:focus {
  border-color:rgba(239,68,68,0.6);
  box-shadow:0 0 12px rgba(239,68,68,0.2);
}
.otp-digit.filled {
  background:rgba(239,68,68,0.07);
  border-color:rgba(239,68,68,0.4);
}
.otp-digit.shake { animation:otpShake 0.35s ease; }

.otp-btn {
  width:100%; padding:16px; border-radius:16px; border:none;
  background:linear-gradient(135deg,#ef4444,#b91c1c);
  color:#fff; font-family:'Orbitron',monospace;
  font-size:12px; font-weight:700; letter-spacing:2px;
  cursor:pointer; transition:transform 0.1s, opacity 0.2s;
  box-shadow:0 4px 24px rgba(239,68,68,0.3);
  margin-bottom:12px;
}
.otp-btn:active { transform:scale(0.97); }
.otp-btn:disabled { opacity:0.45; cursor:not-allowed; }
.otp-btn.secondary {
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(239,68,68,0.2);
  box-shadow:none; color:rgba(255,255,255,0.4);
  font-size:11px;
}
.otp-btn.secondary:hover:not(:disabled) { border-color:rgba(239,68,68,0.4); color:rgba(255,255,255,0.7); }

.otp-msg {
  text-align:center; font-family:'Orbitron',monospace; font-size:10px;
  letter-spacing:2px; padding:10px 14px; border-radius:12px;
  margin-bottom:14px; animation:otpFadeIn 0.2s ease;
}
.otp-msg.success { background:rgba(74,222,128,0.07); border:1px solid rgba(74,222,128,0.25); color:#4ade80; }
.otp-msg.error   { background:rgba(239,68,68,0.07); border:1px solid rgba(239,68,68,0.25); color:#f87171; }

.otp-loader {
  width:18px; height:18px; border:2px solid rgba(255,255,255,0.2);
  border-top-color:#fff; border-radius:50%;
  animation:otpSpin 0.7s linear infinite;
  display:inline-block; vertical-align:middle; margin-right:8px;
}
.otp-timer {
  text-align:center; font-family:'Orbitron',monospace;
  font-size:10px; letter-spacing:2px; color:rgba(255,255,255,0.2);
  margin-top:8px;
}
.otp-timer b { color:#ef4444; }
`;

const SESSION_KEY = 'admin_otp_token';

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

interface Props {
  telegramId: number;
  children: React.ReactNode;
}

type Step = 'idle' | 'sent' | 'verified';

export default function AdminOtpGate({ telegramId, children }: Props) {
  const [step, setStep] = useState<Step>('idle');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [shake, setShake] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (isTokenValid(stored)) setStep('verified');
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [countdown]);

  function showMsg(text: string, type: 'success' | 'error') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  async function requestOtp() {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER}/api/admin/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('sent');
        setDigits(['', '', '', '', '', '']);
        setCountdown(300);
        showMsg('OTP sent to your Telegram!', 'success');
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } else {
        showMsg(data.message || 'Failed to send OTP', 'error');
      }
    } catch {
      showMsg('Network error. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    const otp = digits.join('');
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch(`${SERVER}/api/admin/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, otp }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        sessionStorage.setItem(SESSION_KEY, data.token);
        showMsg('Verified! Loading panel...', 'success');
        setTimeout(() => setStep('verified'), 800);
      } else {
        setDigits(['', '', '', '', '', '']);
        setShake(true);
        setTimeout(() => setShake(false), 400);
        showMsg(data.message || 'Invalid OTP', 'error');
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      }
    } catch {
      showMsg('Network error. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleDigit(index: number, value: string) {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < 5) inputRefs.current[index + 1]?.focus();
    if (char && index === 5) {
      const full = next.join('');
      if (full.length === 6) setTimeout(verifyOtp, 80);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(''));
      inputRefs.current[5]?.focus();
      setTimeout(verifyOtp, 80);
    }
  }

  if (step === 'verified') return <>{children}</>;

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <>
      <style>{CSS}</style>
      <div className="otp-wrap">
        <div className="otp-bg" />
        <div className="otp-grid" />
        <div className="otp-card">
          <div className="otp-shield">🛡️</div>
          <div className="otp-title">ADMIN ACCESS</div>
          <div className="otp-subtitle">One-Time Verification</div>

          {msg && <div className={`otp-msg ${msg.type}`}>{msg.text}</div>}

          {step === 'idle' && (
            <>
              <div className="otp-step-info">
                A <b>6-digit OTP</b> will be sent to your<br />Telegram chat to verify your identity.
              </div>
              <button className="otp-btn" onClick={requestOtp} disabled={loading}>
                {loading ? <><span className="otp-loader" />Sending...</> : '📨  SEND OTP TO TELEGRAM'}
              </button>
            </>
          )}

          {step === 'sent' && (
            <>
              <div className="otp-step-info">
                Check your <b>Telegram</b> for the 6-digit code.<br />Enter it below:
              </div>

              <div className={`otp-input-row${shake ? ' shake' : ''}`} onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    className={`otp-digit${d ? ' filled' : ''}${shake ? ' shake' : ''}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleDigit(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                  />
                ))}
              </div>

              <button
                className="otp-btn"
                onClick={verifyOtp}
                disabled={loading || digits.join('').length !== 6}
              >
                {loading ? <><span className="otp-loader" />Verifying...</> : '🔓  VERIFY OTP'}
              </button>

              <button
                className="otp-btn secondary"
                onClick={requestOtp}
                disabled={loading || countdown > 240}
              >
                {countdown > 240 ? `Resend in ${mins}:${String(secs).padStart(2, '0')}` : '↩ Resend OTP'}
              </button>

              {countdown > 0 && (
                <div className="otp-timer">
                  Code expires in <b>{mins}:{String(secs).padStart(2, '0')}</b>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
