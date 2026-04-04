import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppUser, UserBalance, TelegramUser, Notification } from '@/types/telegram';
import { initUser, getUserBalance, getSettings, getUnreadNotifCount, getNotifications, markNotificationRead } from '@/lib/api';
import { showInterstitialAd } from '@/hooks/useAdsgram';

interface AppContextType {
  telegramUser: TelegramUser | null;
  user: AppUser | null;
  balance: UserBalance | null;
  settings: Record<string, string>;
  isLoading: boolean;
  isAdmin: boolean;
  notifications: Notification[];
  unreadCount: number;
  refreshBalance: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  telegramUser: null,
  user: null,
  balance: null,
  settings: {},
  isLoading: true,
  isAdmin: false,
  notifications: [],
  unreadCount: 0,
  refreshBalance: async () => {},
  refreshUser: async () => {},
  refreshNotifications: async () => {},
  markRead: async () => {},
});

export const useApp = () => useContext(AppContext);

const ADMIN_ID = 7382144791;

function detectTelegramEnv(): TelegramUser | null {
  try {
    const twa = window.Telegram?.WebApp;
    if (twa && twa.initData && twa.initData.length > 0) {
      return twa.initDataUnsafe?.user || null;
    }
  } catch {}
  return null;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const isAdmin = telegramUser?.id === ADMIN_ID;

  useEffect(() => {
    initApp();
  }, []);

  // Poll for balance & notification updates every 30s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const [bal, unread] = await Promise.all([
          getUserBalance(user.id),
          getUnreadNotifCount(user.id),
        ]);
        if (bal) setBalance(bal);
        setUnreadCount(unread);
      } catch (e) {
        console.error('Poll error:', e);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  async function initApp() {
    setIsLoading(true);
    try {
      const tgUser = detectTelegramEnv();

      if (!tgUser) {
        setIsLoading(false);
        return;
      }

      try {
        const twa = window.Telegram.WebApp;
        twa.ready();
        twa.expand();
      } catch {}

      setTelegramUser(tgUser);

      let referralCode: string | undefined;
      try {
        referralCode = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
      } catch {}

      // initUser now returns user + balance + settings + notifications in one call
      const result = await initUser(
        { id: tgUser.id, first_name: tgUser.first_name, last_name: tgUser.last_name, username: tgUser.username, photo_url: tgUser.photo_url },
        referralCode
      );

      const appUser = result.user;
      setUser(appUser);

      if (appUser) {
        // Use data from the auth response directly — no separate calls needed
        if (result.balance) setBalance(result.balance);
        if (result.settings) setSettings(result.settings);
        if (result.notifications) setNotifications(result.notifications as Notification[]);
        if (result.unreadCount !== undefined) setUnreadCount(result.unreadCount);
      } else {
        // Fallback: try to load settings from public endpoint
        try {
          const s = await getSettings();
          setSettings(s);
        } catch {}
      }

      showInterstitialAd().catch(() => {});
    } catch (err) {
      console.error('App init error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const refreshBalance = useCallback(async () => {
    if (user) {
      try {
        const bal = await getUserBalance(user.id);
        if (bal) setBalance(bal);
      } catch (e) {
        console.error('refreshBalance error:', e);
      }
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    await initApp();
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (user) {
      try {
        const [notifs, unread] = await Promise.all([
          getNotifications(user.id),
          getUnreadNotifCount(user.id),
        ]);
        setNotifications(notifs as Notification[]);
        setUnreadCount(unread);
      } catch (e) {
        console.error('refreshNotifications error:', e);
      }
    }
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  return (
    <AppContext.Provider value={{
      telegramUser, user, balance, settings, isLoading, isAdmin,
      notifications, unreadCount, refreshBalance, refreshUser, refreshNotifications, markRead,
    }}>
      {children}
    </AppContext.Provider>
  );
}
