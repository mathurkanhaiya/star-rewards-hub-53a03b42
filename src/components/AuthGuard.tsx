// src/components/AuthGuard.tsx
import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';   // your existing context
import { validateInitDataOnBackend } from '@/lib/api'; // your API function

// Simple device fingerprint (improve this later)
function getDeviceFingerprint(): string {
  const parts = [
    navigator.userAgent,
    screen.width + 'x' + screen.height,
    navigator.language,
    navigator.hardwareConcurrency || '0',
    // You can add more stable signals
  ];
  return btoa(parts.join('|')).slice(0, 32); // simple base64 hash
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { telegramUser, setTelegramUser, setIsBlocked, /* other setters */ } = useApp();
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg) {
          setError("Please open this app inside Telegram");
          setIsChecking(false);
          return;
        }

        const rawInitData = tg.initData;           // ← This is the full signed string
        if (!rawInitData) {
          setError("Invalid Telegram session");
          setIsChecking(false);
          return;
        }

        tg.ready(); // Tell Telegram the app is ready

        // 1. Send raw initData to your backend for validation + fingerprint check
        const fingerprint = getDeviceFingerprint();
        const result = await validateInitDataOnBackend(rawInitData, fingerprint);

        if (!result.success) {
          if (result.reason === 'multiple_devices' || result.reason === 'alt_detected') {
            setIsBlocked(true);
            setError("Multiple devices / alt accounts detected. Access blocked.");
          } else {
            setError(result.message || "Session validation failed");
          }
        } else {
          // Success → store user + session token
          setTelegramUser(result.user);
          // Optionally store your backend session token in localStorage / context
        }
      } catch (err) {
        console.error(err);
        setError("Authentication failed. Please try reopening the app.");
      } finally {
        setIsChecking(false);
      }
    };

    initAuth();
  }, []);

  if (isChecking) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Verifying session...</div>;
  }

  if (error) {
    return (
      <div style={{ 
        padding: '40px 20px', 
        textAlign: 'center', 
        color: '#f87171',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <h2>Access Blocked / Invalid Session</h2>
          <p>{error}</p>
          <p style={{ fontSize: '14px', marginTop: '20px', opacity: 0.7 }}>
            Please open the app directly from Telegram.<br />
            Shared or old links are not allowed.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}