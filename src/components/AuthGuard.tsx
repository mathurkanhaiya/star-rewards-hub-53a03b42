import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { telegramUser, isLoading } = useApp();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg && !isLoading) {
      setError("Please open this app inside Telegram");
    }
  }, [isLoading]);

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Verifying session...</div>;
  }

  if (error || !telegramUser) {
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
          <p>{error || "Please open this app inside Telegram."}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
