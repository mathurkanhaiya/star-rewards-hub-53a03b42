import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  adminGetStats, adminGetUsers, adminGetWithdrawals,
  adminUpdateWithdrawal, adminUpdateSetting, adminBanUser,
  adminToggleTask, adminCreateTask, adminDeleteTask,
  adminAdjustBalance, adminGetContests, adminCreateContest,
  adminEndContest, adminSendBroadcast, getTasks, getSettings,
} from '@/lib/api';
import { Task, Contest } from '@/types/telegram';

import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminWithdrawalsTab from '@/components/admin/AdminWithdrawalsTab';
import AdminTasksTab from '@/components/admin/AdminTasksTab';
import AdminSettingsTab from '@/components/admin/AdminSettingsTab';
import AdminContestsTab from '@/components/admin/AdminContestsTab';
import AdminPromosTab from '@/components/admin/AdminPromosTab';

type AdminTab = 'dashboard' | 'users' | 'withdrawals' | 'tasks' | 'contests' | 'promos' | 'broadcast' | 'settings';

// =============== SECURITY CONFIG ===============
// Add your Telegram user IDs here (the ones allowed to access admin)
const ALLOWED_ADMIN_IDS: number[] = [
  2139807311,     // ← Replace with your real Telegram ID
  987654321,     // ← Add more admins if needed
  // Example: your own ID from telegramUser?.id
];

function isAuthorized(userId?: number): boolean {
  if (!userId) return false;
  return ALLOWED_ADMIN_IDS.includes(userId);
}
// ===============================================

function triggerHaptic(type: 'impact' | 'success' | 'error' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else if (type === 'error') tg?.HapticFeedback?.notificationOccurred('error');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const previous = React.useRef(value);

  useEffect(() => {
    let start = previous.current;
    const diff = value - start;
    const steps = 30;
    const increment = diff / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      start += increment;
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 20);
    previous.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

// Keep your TAB_ITEMS, STAT_CONFIG, and full CSS here (unchanged)
const TAB_ITEMS = [ /* ... your existing TAB_ITEMS ... */ ];
const STAT_CONFIG = [ /* ... your existing STAT_CONFIG ... */ ];

const CSS = ` /* paste your full CSS here */ `;

export default function AdminPanel() {
  return <AdminPanelContent />;
}

function AdminPanelContent() {
  const { telegramUser, refreshUser } = useApp();

  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [msgText, setMsgText] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ /* ... */ });
  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [settings, setSettingsState] = useState<Record<string, string>>({});
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});

  // Security check
  const isAdmin = isAuthorized(telegramUser?.id);

  useEffect(() => {
    if (!isAdmin) return;
    loadDashboard();
  }, [isAdmin]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [s, u, w, t, settingsData, c] = await Promise.all([
        adminGetStats(),
        adminGetUsers(),
        adminGetWithdrawals(),
        getTasks(),
        getSettings(),
        adminGetContests(),
      ]);
      setStats(s);
      setUsers(u);
      setWithdrawals(w);
      setTasks(t);
      setSettingsState(settingsData);
      setEditSettings(settingsData);
      setContests(c);
    } catch (err) {
      showMsg('Failed to load dashboard', 'error');
    }
    setLoading(false);
  }

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMsgText(text);
    setMsgType(type);
    triggerHaptic(type);
    setTimeout(() => setMsgText(''), 3000);
  }

  // Safe wrapper for dangerous actions
  const withConfirmation = (action: () => void, message: string = 'Are you sure? This action cannot be undone.') => {
    if (!confirm(message)) return;
    action();
  };

  const activeTaskCount = tasks.filter(t => t.is_active).length;
  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;

  if (!telegramUser) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#f87171' }}>Loading user data...</div>;
  }

  if (!isAdmin) {
    return (
      <>
        <style>{CSS}</style>
        <div className="ad-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div style={{ textAlign: 'center', maxWidth: 320 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>Access Denied</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              You are not authorized to access the Admin Panel.<br />
              Contact the owner if you believe this is a mistake.
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="ad-root">
        <div className="ad-ambient" />
        <div className="ad-grid" />

        <div className="ad-content">
          {/* Header */}
          <div className="ad-header">
            <div className="ad-shield">🛡️</div>
            <div className="ad-header-text">
              <div className="ad-title">ADMIN PANEL</div>
              <div className="ad-subtitle">Production Control Center</div>
            </div>
          </div>

          {/* Toast */}
          {msgText && <div className={`ad-toast ${msgType}`}>{msgText}</div>}

          {/* Tab strip - same as before */}
          <div className="ad-tabstrip">
            {TAB_ITEMS.map(t => (
              <button
                key={t.id}
                className={`ad-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => { triggerHaptic(); setTab(t.id); }}
              >
                {/* ... your tab content ... */}
              </button>
            ))}
          </div>

          {/* Dashboard, Users, Withdrawals, Tasks, Contests, Promos, Settings - same as before */}

          {/* Broadcast - with confirmation */}
          {tab === 'broadcast' && (
            <div>
              <div className="ad-section-label">Message Content</div>
              <textarea
                className="ad-textarea"
                value={broadcastText}
                onChange={e => setBroadcastText(e.target.value)}
                placeholder="Type your broadcast message here..."
                rows={5}
              />
              <div className="ad-char-count">{broadcastText.length} chars</div>

              {broadcastText.trim() && (
                <div className="ad-preview">
                  <div className="ad-preview-label">Preview</div>
                  <div className="ad-preview-text">{broadcastText}</div>
                </div>
              )}

              <button
                className="ad-broadcast-btn"
                onClick={() => withConfirmation(async () => {
                  if (!broadcastText.trim()) return;
                  setBroadcasting(true);
                  const result = await adminSendBroadcast(broadcastText, telegramUser.id);
                  result.success 
                    ? showMsg('Broadcast sent successfully 📢') 
                    : showMsg('Failed to send broadcast', 'error');
                  setBroadcastText('');
                  setBroadcasting(false);
                }, "Send this message to ALL users?\nThis action is irreversible and may affect many users.")}
                disabled={broadcasting || !broadcastText.trim()}
              >
                {broadcasting ? '··· Sending' : '📢 SEND BROADCAST TO ALL USERS'}
              </button>
            </div>
          )}

          {/* Other tabs remain mostly the same, but you can wrap sensitive actions with withConfirmation too */}

        </div>
      </div>
    </>
  );
}