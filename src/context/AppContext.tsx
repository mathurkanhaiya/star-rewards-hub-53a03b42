import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppUser, UserBalance, TelegramUser, Notification } from '@/types/telegram';
import { 
  initUser, 
  getUserBalance, 
  getSettings, 
  getUnreadNotifCount, 
  getNotifications, 
  markNotificationRead,
  validateInitDataOnBackend   // ← Make sure this is imported
} from '@/lib/api';
import { showInterstitialAd } from '@/hooks/useAdsgram';
import { supabase } from '@/integrations/supabase/client';

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

// Strong Device Fingerprint
function getDeviceFingerprint(): string {
  const data = [
    navigator.userAgent,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    navigator.language,
    navigator.hardwareConcurrency || "0",
  ].join("|");

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
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

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const balanceChannel = supabase
      .channel('balance-changes')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'balances', 
        filter: `user_id=eq.${user.id}` 
      }, (payload) => setBalance(payload.new as UserBalance))
      .subscribe();

    const notifChannel = supabase
      .channel('notification-changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${user.id}` 
      }, (payload) => {
        const newNotif = payload.new as Notification;
        setNotifications(prev => [newNotif, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    const settingsChannel = supabase
      .channel('settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, 
        () => getSettings().then(s => setSettings(s)))
      .subscribe();

    return () => {
      supabase.removeChannel(balanceChannel);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, [user?.id]);

  async function initApp() {
    setIsLoading(true);

    try {
      // Wait for Telegram WebApp to initialize
      await new Promise(resolve => setTimeout(resolve, 400));

      const tg = window.Telegram?.WebApp;
      if (!tg) {
        console.warn("Telegram WebApp not found");
        setIsLoading(false);
        return;
      }

      tg.expand?.();
      tg.ready?.();

      let rawInitData = tg.initData || '';

      // Fallback: extract from URL hash (important for some cases)
      if (!rawInitData) {
        const hash = window.location.hash;
        const match = hash.match(/tgWebAppData=([^&]+)/);
        if (match) {
          rawInitData = decodeURIComponent(match[1]);
        }
      }

      if (!rawInitData || rawInitData.trim() === '') {
        console.warn("No initData found");
        setIsLoading(false);
        return;
      }

      // === SECURITY CHECK ===
      const fingerprint = getDeviceFingerprint();
      const result = await validateInitDataOnBackend(rawInitData, fingerprint);

      if (!result.success) {
        console.error("Validation failed:", result.message);
        if (result.reason === "multiple_devices" || result.reason === "alt_detected") {
          // You can set a global blocked state here if needed
          console.warn("Multiple devices / alt account detected");
        }
        setIsLoading(false);
        return;
      }

      // Success → set telegramUser
      const validatedUser = result.user as TelegramUser;
      setTelegramUser(validatedUser);

      // Continue with normal app initialization
      let referralCode: string | undefined;
      try {
        referralCode = tg.initDataUnsafe?.start_param;
      } catch {}

      const appUser = await initUser(
        {
          id: validatedUser.id,
          first_name: validatedUser.first_name,
          last_name: validatedUser.last_name,
          username: validatedUser.username,
          photo_url: validatedUser.photo_url,
        },
        referralCode
      );

      setUser(appUser);

      if (appUser) {
        const [bal, s, notifs, unread] = await Promise.all([
          getUserBalance(appUser.id),
          getSettings(),
          getNotifications(appUser.id),
          getUnreadNotifCount(appUser.id),
        ]);
        setBalance(bal);
        setSettings(s);
        setNotifications(notifs as Notification[]);
        setUnreadCount(unread);
      } else {
        const s = await getSettings();
        setSettings(s);
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
      const bal = await getUserBalance(user.id);
      setBalance(bal);
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    await initApp();
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (user) {
      const [notifs, unread] = await Promise.all([
        getNotifications(user.id),
        getUnreadNotifCount(user.id),
      ]);
      setNotifications(notifs as Notification[]);
      setUnreadCount(unread);
    }
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  return (
    <AppContext.Provider value={{
      telegramUser,
      user,
      balance,
      settings,
      isLoading,
      isAdmin,
      notifications,
      unreadCount,
      refreshBalance,
      refreshUser,
      refreshNotifications,
      markRead,
    }}>
      {children}
    </AppContext.Provider>
  );
}