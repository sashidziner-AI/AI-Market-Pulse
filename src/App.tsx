/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BusinessInput } from './components/BusinessInput';
import { Dashboard, getDefaultReportName } from './components/Dashboard';
import { SavedReportsLibrary } from './components/SavedReportsLibrary';
import { LandingPage } from './components/LandingPage';
import { BusinessAnalysis, TargetAccount, DetailedAnalysis, SavedReport } from './types';
import { Toaster, toast } from 'sonner';
import { Rocket, Globe, FileText, House, LogOut, User } from 'lucide-react';
import { ThemeToggle, applyTheme } from './components/ThemeToggle'; // applyTheme still used by Jarvis theme actions
import { SignalChangesBell } from './components/SignalChangesBell';
import { SlackSettings } from './components/SlackSettings';
import { captureSnapshot, shouldCaptureSnapshot, loadChangesWithinDigestWindow } from './utils/snapshots';
import { notifyNewChanges, getWebhookUrl } from './utils/slack';
import { JarvisOrb, JarvisAction } from './components/JarvisOrb';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { AuthUser, ensureDemoUser, getCurrentUser, logoutUser } from './utils/auth';
import { apiUrl } from './utils/apiBase';

// Seed the demo account before React renders so the login screen's autofill
// chip works on a first-visit browser profile.
ensureDemoUser();

type AuthView = 'login' | 'register' | 'forgot' | 'reset';

// Small user menu shown in headers. Renders as a circular initial-avatar
// button; expands into a card with the user's name/email and a Sign out row.
function UserMenu({
  user,
  open,
  onToggle,
  onLogout,
  floating = false,
}: {
  user: AuthUser;
  open: boolean;
  onToggle: () => void;
  onLogout: () => void;
  floating?: boolean;
}) {
  const initial = user.name.trim().charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase();
  return (
    <div className={`relative ${floating ? '' : ''}`} data-user-menu>
      <button
        onClick={onToggle}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-semibold shadow-md ring-2 ring-white/20 hover:ring-white/40 transition-all cursor-pointer select-none"
        style={{ background: `linear-gradient(135deg, ${user.avatarColor}, color-mix(in oklab, ${user.avatarColor} 60%, black))` }}
        aria-label="Account menu"
      >
        {initial}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#161618] border border-stone-200/70 dark:border-white/[0.08] shadow-2xl overflow-hidden z-50"
          data-user-menu
        >
          <div className="px-4 py-4 border-b border-stone-200/70 dark:border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[15px] font-semibold shrink-0"
                style={{ background: `linear-gradient(135deg, ${user.avatarColor}, color-mix(in oklab, ${user.avatarColor} 60%, black))` }}
              >
                {initial}
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{user.name}</div>
                <div className="text-[11.5px] text-zinc-500 dark:text-zinc-400 truncate">{user.email}</div>
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-zinc-700 dark:text-zinc-200 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Parse #/reset-password?token=xxx from the URL hash so a reset link can
// deep-link straight into the reset screen even before a user is logged in.
function parseAuthHash(): { view: AuthView; token?: string } | null {
  const hash = window.location.hash || '';
  if (hash.startsWith('#/reset-password')) {
    const q = hash.split('?')[1] ?? '';
    const params = new URLSearchParams(q);
    const token = params.get('token') ?? undefined;
    return { view: 'reset', token };
  }
  if (hash.startsWith('#/register')) return { view: 'register' };
  if (hash.startsWith('#/forgot-password')) return { view: 'forgot' };
  if (hash.startsWith('#/login')) return { view: 'login' };
  return null;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getCurrentUser());
  const initialHash = parseAuthHash();
  // Auth screens are shown on demand — not by default. They only take over
  // the app when the user tries to enter the workspace without a session, or
  // when the URL is a deep-link to a specific auth screen (e.g. a password
  // reset link a user opens in a fresh tab).
  const [showAuth, setShowAuth] = useState<boolean>(initialHash !== null);
  const [authView, setAuthView] = useState<AuthView>(initialHash?.view ?? 'login');
  const [resetToken, setResetToken] = useState<string | null>(initialHash?.token ?? null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Keep the URL hash in sync with the auth view when the auth screens are
  // visible, and clear it once the user leaves auth so the app URL looks clean.
  useEffect(() => {
    if (!showAuth) {
      if (window.location.hash.startsWith('#/')) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      return;
    }
    const target =
      authView === 'reset' && resetToken
        ? `#/reset-password?token=${resetToken}`
        : `#/${authView === 'forgot' ? 'forgot-password' : authView}`;
    if (window.location.hash !== target) {
      history.replaceState(null, '', target);
    }
  }, [showAuth, authView, resetToken]);

  // Respond to the browser back/forward buttons — hash changes into an auth
  // route open the auth panel; hash cleared exits it.
  useEffect(() => {
    const onHash = () => {
      const next = parseAuthHash();
      if (next) {
        setShowAuth(true);
        setAuthView(next.view);
        if (next.view === 'reset') setResetToken(next.token ?? null);
      } else if (currentUser) {
        // Only auto-dismiss the auth panel when there's a session to fall
        // back to — otherwise the app would show workspace to a logged-out
        // user via URL manipulation.
        setShowAuth(false);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [currentUser]);

  // When Landing's "Get Started" (or "Saved Reports") fires, check for a
  // session. Logged in → dismiss landing straight into workspace. Logged out
  // → prompt for auth first; the caller passes what to do once they're in.
  const pendingActionRef = useRef<null | (() => void)>(null);
  const requireAuth = (nextAction: () => void) => {
    if (currentUser) {
      nextAction();
      return;
    }
    pendingActionRef.current = nextAction;
    setAuthView('login');
    setShowAuth(true);
  };
  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setShowAuth(false);
    // Resume whatever the user was trying to do before we intercepted them.
    const resume = pendingActionRef.current;
    pendingActionRef.current = null;
    if (resume) resume();
  };

  const [analysis, setAnalysis] = useState<BusinessAnalysis | null>(() => {
    try {
      const saved = localStorage.getItem('gtm_analysis');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [accounts, setAccounts] = useState<TargetAccount[]>(() => {
    try {
      const saved = localStorage.getItem('gtm_accounts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [savedReports, setSavedReports] = useState<SavedReport[]>(() => {
    try {
      const saved = localStorage.getItem('gtm_saved_reports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeReportId, setActiveReportId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('gtm_active_report_id') || null;
    } catch {
      return null;
    }
  });
  // Persisted so the Industry Discovery panel can derive the seller's
  // country (from the URL TLD) and their own domain (to filter self-matches
  // out of Google Maps results). Rehydrates on reload just like `analysis`.
  const [analyzedUrl, setAnalyzedUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('gtm_analyzed_url') || null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [activeLandingTab, setActiveLandingTab] = useState<'analyze' | 'saved-library'>('analyze');
  // Always show the landing page on every fresh page load.
  const [showLanding, setShowLanding] = useState<boolean>(true);

  // Map of in-flight deep-analysis AbortControllers keyed by account id. Used
  // to cancel a running /api/analyze-account stream if the user closes the
  // detail view, re-clicks the same account, or navigates back to the input
  // screen — otherwise the reader keeps consuming bytes (and burning tokens)
  // long after the UI has stopped listening.
  const deepAnalysisAbortersRef = useRef<Map<string, AbortController>>(new Map());
  const abortDeepAnalysis = (id?: string) => {
    const map = deepAnalysisAbortersRef.current;
    if (id) {
      const ctrl = map.get(id);
      if (ctrl) { try { ctrl.abort(); } catch {} map.delete(id); }
      return;
    }
    for (const ctrl of map.values()) { try { ctrl.abort(); } catch {} }
    map.clear();
  };

  // Wrap localStorage writes so a QuotaExceeded / private-mode failure surfaces
  // to the user instead of silently dropping their data. Only shows the toast
  // once per session so we don't spam every autosave tick.
  const quotaWarnedRef = useRef(false);
  const safeSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn(`[persist] localStorage.setItem failed for ${key}:`, err);
      if (!quotaWarnedRef.current) {
        quotaWarnedRef.current = true;
        toast.error('Browser storage is full — new saves may be lost. Delete old saved reports to make space.', {
          duration: 10000,
        });
      }
    }
  };

  // Per-screen theme:
  //   Landing (marketing)         → dark
  //   Analyze Website (input URL) → dark
  //   Saved Reports library       → dark
  //   Dashboard (analysis result) → light
  // Rule: dark whenever there's no analysis loaded; light once a dashboard
  // is showing.
  useEffect(() => {
    // Auth screens are always dark for consistent brand feel.
    const isDark = !currentUser || !analysis;
    applyTheme(isDark ? 'dark' : 'light');
  }, [activeLandingTab, showLanding, analysis, currentUser]);

  // Close the profile menu on outside click / Escape so it doesn't stay open
  // hovering over content the user meant to interact with.
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-user-menu]')) return;
      setUserMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setUserMenuOpen(false);
    setShowAuth(false);
    setAuthView('login');
    // Reset landing state so signing out drops the user back on the marketing
    // landing page — not on whichever workspace tab they last had open.
    setShowLanding(true);
    setActiveLandingTab('analyze');
    // Clear in-flight deep dives so a new session doesn't inherit stale readers.
    abortDeepAnalysis();
    toast.success('Signed out');
  };
  const dismissLanding = () => {
    setShowLanding(false);
  };

  useEffect(() => {
    if (analysis) {
      safeSetItem('gtm_analysis', JSON.stringify(analysis));
    } else {
      try { localStorage.removeItem('gtm_analysis'); } catch {}
    }
  }, [analysis]);

  useEffect(() => {
    if (analyzedUrl) {
      safeSetItem('gtm_analyzed_url', analyzedUrl);
    } else {
      try { localStorage.removeItem('gtm_analyzed_url'); } catch {}
    }
  }, [analyzedUrl]);

  useEffect(() => {
    safeSetItem('gtm_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    safeSetItem('gtm_saved_reports', JSON.stringify(savedReports));
  }, [savedReports]);

  useEffect(() => {
    if (activeReportId) {
      safeSetItem('gtm_active_report_id', activeReportId);
    } else {
      try { localStorage.removeItem('gtm_active_report_id'); } catch {}
    }
  }, [activeReportId]);

  // Debounced auto-save of the loaded saved-report draft when accounts change
  // (e.g. after CRM sync marks accounts as synced). Debouncing collapses a
  // burst of onUpdateAccount calls into a single report save.
  // `analysis` is intentionally in the deps: if the user swaps analyses while
  // a save is pending, we want the tick to save against the fresh analysis,
  // not the one that was current when the accounts array changed.
  useEffect(() => {
    if (!activeReportId || !analysis || accounts.length === 0) return;
    const t = setTimeout(() => {
      handleSaveReport("", analysis, accounts);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, activeReportId, analysis]);

  // Signal-change snapshot capture. Once the workspace has accounts and it's
  // been >24h since the last snapshot, take one. This drives the header bell
  // + Weekly Digest — the diff between snapshots is what surfaces changes.
  useEffect(() => {
    if (accounts.length === 0) return;
    if (!shouldCaptureSnapshot()) return;
    const t = setTimeout(() => {
      const snap = captureSnapshot(accounts);
      if (snap) {
        // Fire a storage event so any SignalChangesBell mounted elsewhere
        // recomputes without needing to remount.
        window.dispatchEvent(new StorageEvent('storage', { key: 'gtm_account_snapshots' }));
        // If Slack is connected, push high-impact changes now. Dedup + rate
        // limiting live in slack.ts — safe to call unconditionally.
        if (getWebhookUrl()) {
          const changes = loadChangesWithinDigestWindow(accounts);
          notifyNewChanges(changes).catch(() => { /* toast happens in the util */ });
        }
      }
    }, 1500); // small delay so bursts of setAccounts settle before we snapshot
    return () => clearTimeout(t);
  }, [accounts]);

  const handleSaveReport = (name: string, customAnalysis?: BusinessAnalysis, customAccounts?: TargetAccount[]) => {
    const finalAnalysis = customAnalysis || analysis;
    const finalAccounts = customAccounts || accounts;

    if (!finalAnalysis) {
      toast.error("Cannot save empty report");
      return "";
    }

    const reportId = activeReportId || `report-${Date.now()}`;
    // Preserve the existing report's name when auto-updating (e.g. blueprint
    // edits or account deletions call handleSaveReport with an empty name).
    // Only fall back to the industry-derived default when creating a brand-new
    // report and the caller didn't provide an explicit name.
    const existingName = savedReports.find(r => r.id === reportId)?.name;
    const reportName =
      name?.trim() ||
      existingName ||
      getDefaultReportName(finalAnalysis);

    const newReport = {
      id: reportId,
      name: reportName,
      timestamp: new Date().toISOString(),
      analysis: finalAnalysis,
      accounts: finalAccounts,
    };

    setSavedReports(prev => {
      const exists = prev.some(r => r.id === reportId);
      if (exists) {
        return prev.map(r => r.id === reportId ? newReport : r);
      } else {
        return [newReport, ...prev];
      }
    });

    setActiveReportId(reportId);
    setAnalysis(finalAnalysis);
    setAccounts(finalAccounts);
    
    toast.success(`Report "${reportName}" saved successfully!`);
    return reportId;
  };

  const handleDeleteReport = (id: string) => {
    setSavedReports(prev => prev.filter(r => r.id !== id));
    if (activeReportId === id) {
      abortDeepAnalysis();
      setActiveReportId(null);
      setAnalysis(null);
      setAccounts([]);
    }
    toast.success("Saved report deleted.");
  };

  const handleLoadReport = (id: string) => {
    const report = savedReports.find(r => r.id === id);
    if (report) {
      setActiveReportId(id);
      setAnalysis(report.analysis);
      setAccounts(report.accounts);
      toast.success(`Loaded report: ${report.name}`);
    } else {
      toast.error("Report not found");
    }
  };

  const handleUpdateReportMeta = (id: string, newName: string) => {
    setSavedReports(prev => prev.map(r => r.id === id ? { ...r, name: newName } : r));
    toast.success("Saved report renamed successfully!");
  };

  const analyzeBusiness = async (url: string, accountCount: number = 10) => {
    setIsLoading(true);
    // Clear stale state from any previous analysis BEFORE the fetch. Otherwise,
    // when setAnalysis fires with the new blueprint, Dashboard mounts with the
    // old accounts + old activeReportId briefly visible until discovery lands.
    // Also flip on isDiscovering so the Dashboard shows skeletons immediately,
    // covering the gap between "business analyzed" and "accounts populated".
    // A brand-new analysis discards every in-flight deep dive from the
    // previous session — otherwise their stream events would land against
    // stale account ids.
    abortDeepAnalysis();
    setAccounts([]);
    setActiveReportId(null);
    setAnalyzedUrl(url);
    setIsDiscovering(true);
    try {
      const response = await fetch(apiUrl('/api/analyze-business'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setAnalysis(data);
      if (data.isFallback) {
        toast.warning('OpenAI API quota exceeded or API Key is missing. Loaded high-fidelity simulated business blueprint.', {
          duration: 10000,
          description: 'To connect real live AI analyses, set OPENAI_API_KEY in your .env file.'
        });
      } else {
        toast.success('Business logic mapped successfully');
      }

      // Auto-start discovery after business analysis with the user's picked count
      discoverAccounts(data, accountCount);
    } catch (error: any) {
      // Discovery never runs on failure, so clear the pre-warm flag we set
      // above; otherwise the Dashboard would sit on skeletons forever.
      setIsDiscovering(false);
      toast.error('Failed to analyze business: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const discoverAccounts = async (businessData: BusinessAnalysis, accountCount: number = 10) => {
    setIsDiscovering(true);
    try {
      const response = await fetch(apiUrl('/api/discover-accounts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessContext: businessData,
          icp: businessData.icp,
          accountCount,
        }),
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const formattedAccounts = data.map((acc: any, idx: number) => ({
        ...acc,
        id: `acc-${idx}-${Date.now()}`,
        status: 'new'
      }));

      setAccounts(formattedAccounts);
      if (data.length > 0 && data[0].isFallback) {
        toast.warning('Switched to simulated market company discovery due to OpenAI API key quotas.', {
          duration: 8000
        });
      } else {
        toast.success(`${formattedAccounts.length} high-potential accounts discovered`);
      }

      // Fire-and-forget lead pipelines so the Leads tab fills without a
      // manual click. Both hit /api endpoints that are safe to fail silently.
      //   1. Immediate sweep — pull real Hunter matches for DM personas
      //      across the top ~3 accounts right now. Cap keeps quota safe.
      //   2. Persistent enrollment — same accounts get added to the
      //      persona-discovery cron queue, so nightly runs keep growing
      //      the leads DB even without further user interaction.
      const enrolledAccounts = formattedAccounts
        .filter((a: any) => a?.domain && a?.name)
        .map((a: any) => ({ domain: a.domain, name: a.name }));
      if (enrolledAccounts.length > 0) {
        void fetch(apiUrl('/api/enrichment/sweep'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accounts: enrolledAccounts.slice(0, 3), cap: 12 }),
        })
          .then((r) => r.json())
          .then((r) => {
            if (r?.leadsCreated > 0) {
              toast.success(`Auto-discovered ${r.leadsCreated} lead${r.leadsCreated === 1 ? '' : 's'} across ${enrolledAccounts.slice(0, 3).length} accounts. Open the Leads tab.`, { duration: 5000 });
            }
          })
          .catch(() => {});
        void fetch(apiUrl('/api/scheduler/enroll'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accounts: enrolledAccounts }),
        }).catch(() => {});
      }
    } catch (error: any) {
      toast.error('Discovery failed: ' + error.message);
    } finally {
      setIsDiscovering(false);
    }
  };

  const analyzeAccountDetail = async (id: string) => {
    const account = accounts.find(a => a.id === id);
    if (!account || account.analysis) return;

    // If a prior deep-dive for this same id is still running (e.g. rapid
    // re-click), cancel it before starting a fresh one so we never race two
    // readers into the same account.
    abortDeepAnalysis(id);
    const controller = new AbortController();
    deepAnalysisAbortersRef.current.set(id, controller);

    // Attach a transient progress object so AccountDetail can render a live
    // "AI is thinking..." banner while the 3 parallel sub-calls stream events.
    const startProgress = () => {
      setAccounts(prev => prev.map(a =>
        a.id === id
          ? { ...a, analysisProgress: { messages: ['Starting deep-dive analysis...'], searches: [] } }
          : a
      ));
    };
    const pushProgress = (patch: { message?: string; search?: string }) => {
      setAccounts(prev => prev.map(a => {
        if (a.id !== id) return a;
        const prevProgress = a.analysisProgress ?? { messages: [], searches: [] };
        return {
          ...a,
          analysisProgress: {
            messages: patch.message ? [...prevProgress.messages, patch.message] : prevProgress.messages,
            searches: patch.search ? [...prevProgress.searches, patch.search] : prevProgress.searches,
          },
        };
      }));
    };
    const clearProgress = () => {
      setAccounts(prev => prev.map(a =>
        a.id === id ? { ...a, analysisProgress: undefined } : a
      ));
    };

    try {
      startProgress();

      const response = await fetch(apiUrl('/api/analyze-account?stream=1'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: account.domain,
          businessContext: analysis,
        }),
        signal: controller.signal,
      });

      if (!response.body) {
        // Streaming not supported by the runtime — fall back to a single JSON body.
        const data = await response.json();
        clearProgress();
        if (data.error) throw new Error(data.error);
        setAccounts(prev => prev.map(a => a.id === id ? { ...a, analysis: data as DetailedAnalysis } : a));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalPayload: DetailedAnalysis | null = null;

      // Read NDJSON events line-by-line. Each line is a JSON object.
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'status' && event.message) {
              pushProgress({ message: event.message });
            } else if (event.type === 'search' && event.query) {
              pushProgress({ search: event.query });
            } else if (event.type === 'sub_done' && event.subCall) {
              pushProgress({ message: `Finished ${event.subCall} (${Math.round(event.durationMs / 1000)}s)` });
            } else if (event.type === 'result' && event.payload) {
              finalPayload = event.payload as DetailedAnalysis;
            } else if (event.type === 'error' && event.message) {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            // Malformed event line — skip; better than crashing the stream.
            console.warn('Stream parse failed:', line);
          }
        }
      }

      clearProgress();
      if (!finalPayload) {
        throw new Error('Stream ended without a result event');
      }
      if ((finalPayload as any).isFallback) {
        toast.warning('API limits reached. Loaded optimized competitor displacement profiles for this account.', {
          duration: 6000,
        });
      }
      setAccounts(prev => prev.map(a =>
        a.id === id ? { ...a, analysis: finalPayload as DetailedAnalysis } : a
      ));
    } catch (error: any) {
      clearProgress();
      // AbortError is intentional (user closed detail / navigated away) —
      // don't scare them with an error toast for their own action.
      if (error?.name !== 'AbortError') {
        toast.error('Deep analysis failed: ' + error.message);
      }
    } finally {
      // Only clear this aborter if it's still the current one — a fresh call
      // for the same id will have replaced it in the map already.
      if (deepAnalysisAbortersRef.current.get(id) === controller) {
        deepAnalysisAbortersRef.current.delete(id);
      }
    }
  };

  // Auth screens take over the whole app only when the user tries to enter
  // the workspace without a session — or when they land on a deep-link auth
  // route (e.g. a password reset URL). The default first screen is always
  // the marketing landing page.
  if (showAuth) {
    // Bail-out from the auth flow — drops the user back on the landing page
    // and cancels any pending action (e.g. auto-open-workspace after login).
    const goHome = () => {
      pendingActionRef.current = null;
      setShowAuth(false);
      setResetToken(null);
      setAuthView('login');
    };
    return (
      <div className="min-h-screen bg-[#0b0b0d] text-zinc-100 font-sans">
        <Toaster position="top-right" expand={true} richColors />
        {authView === 'login' && (
          <LoginPage
            onSuccess={handleAuthSuccess}
            onSwitchToRegister={() => setAuthView('register')}
            onSwitchToForgot={() => setAuthView('forgot')}
            onGoHome={goHome}
          />
        )}
        {authView === 'register' && (
          <RegisterPage
            onSuccess={handleAuthSuccess}
            onSwitchToLogin={() => setAuthView('login')}
            onGoHome={goHome}
          />
        )}
        {authView === 'forgot' && (
          <ForgotPasswordPage
            onSwitchToLogin={() => setAuthView('login')}
            onGotoReset={(token) => {
              setResetToken(token);
              setAuthView('reset');
            }}
            onGoHome={goHome}
          />
        )}
        {authView === 'reset' && (
          <ResetPasswordPage
            token={resetToken ?? ''}
            onSwitchToLogin={() => {
              setResetToken(null);
              setAuthView('login');
            }}
            onGoHome={goHome}
          />
        )}
      </div>
    );
  }

  // Logged-out users only ever see the landing page. Any workspace state
  // rehydrated from a previous session's localStorage is intentionally
  // ignored here so a signed-out visitor can't peek at prior analysis data
  // just by opening a fresh tab.
  if (!currentUser) {
    return (
      <div className="min-h-screen text-zinc-100 bg-[#1F1F20] font-sans">
        <Toaster position="top-right" expand={true} richColors />
        <LandingPage
          onEnter={() => requireAuth(dismissLanding)}
          onOpenLibrary={() =>
            requireAuth(() => {
              dismissLanding();
              setActiveLandingTab('saved-library');
            })
          }
          hasSavedReports={savedReports.length > 0}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-zinc-900 dark:text-zinc-100 bg-stone-50 dark:bg-[#1F1F20] font-sans selection:bg-orange-100 selection:text-orange-900 dark:selection:bg-orange-900/30 dark:selection:text-orange-100 flex flex-col justify-start">
      <Toaster position="top-right" expand={true} richColors />

      {/* Marketing landing — shown first for new visitors. Fully self-hosted
          header (its own nav + theme toggle), so the shared analyze-screen
          header below is intentionally suppressed while it's visible. */}
      {showLanding && !analysis && activeLandingTab !== 'saved-library' ? (
        <LandingPage
          onEnter={() => requireAuth(dismissLanding)}
          onOpenLibrary={() =>
            requireAuth(() => {
              dismissLanding();
              setActiveLandingTab('saved-library');
            })
          }
          hasSavedReports={savedReports.length > 0}
        />
      ) : (
        <>

      {/* Dynamic Navigation Header for Workspace Landing Screen. */}
      {!analysis && (
        <header className="w-full bg-stone-50/90 dark:bg-[#1F1F20]/90 backdrop-blur-md border-b border-stone-200/60 dark:border-white/[0.06] sticky top-0 z-40 transition-all">
          <div className="max-w-6xl mx-auto px-6 h-24 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/vee-technologies-logo.png"
                alt="Vee Technologies"
                className="w-12 h-12 object-contain select-none"
              />
              <div
                className="flex flex-col leading-none hover:opacity-80 cursor-pointer select-none"
                onClick={() => setActiveLandingTab('analyze')}
              >
                <span
                  className="font-normal text-[18px] tracking-tight text-zinc-900 dark:text-zinc-100"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  <span className="text-orange-600 dark:text-white">AI</span> Market Pulse
                </span>
                <span className="mt-0.5 text-[8.5px] font-mono uppercase tracking-[0.14em] text-orange-600 dark:text-orange-400">
                  by Vee Technologies
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // Home must escape ANY workspace tab (analyze / saved-library)
                  // and drop the user back on the marketing landing page.
                  setActiveLandingTab('analyze');
                  setShowLanding(true);
                }}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-stone-100 dark:hover:bg-white/[0.05] cursor-pointer transition-all"
              >
                <House className="w-3.5 h-3.5" />
                Home
              </button>
              <div className="flex items-center gap-1 bg-stone-100 dark:bg-white/[0.05] p-1 rounded-xl border border-stone-200/60 dark:border-white/[0.07]">
                <button
                  onClick={() => setActiveLandingTab('analyze')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeLandingTab === 'analyze'
                      ? 'bg-white dark:bg-white/[0.08] text-orange-600 dark:text-orange-400 shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Analyze Website</span>
                </button>

                <button
                  onClick={() => setActiveLandingTab('saved-library')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer relative ${
                    activeLandingTab === 'saved-library'
                      ? 'bg-white dark:bg-white/[0.08] text-orange-600 dark:text-orange-400 shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Saved Reports</span>
                  {savedReports.length > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white leading-none scale-90 border border-stone-50 dark:border-[#1F1F20] font-mono">
                      {savedReports.length}
                    </span>
                  )}
                </button>
              </div>
              {accounts.length > 0 && (
                <SignalChangesBell
                  accounts={accounts}
                  onOpenAccount={(id) => window.dispatchEvent(new CustomEvent('gtm:open-account', { detail: { id } }))}
                />
              )}
              <SlackSettings />
              <ThemeToggle />
              <UserMenu
                user={currentUser}
                open={userMenuOpen}
                onToggle={() => setUserMenuOpen((v) => !v)}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </header>
      )}

      {/* Page Content Router.
          Priority: an explicit "Show Reports" navigation (activeLandingTab
          === 'saved-library') always wins so the library is reachable even
          from an in-progress dashboard. Falls back to Dashboard when analysis
          is loaded, else the analyze screen. */}
      {activeLandingTab === 'saved-library' ? (
        <SavedReportsLibrary
          savedReports={savedReports}
          onLoadReport={(id) => {
            handleLoadReport(id);
            setActiveLandingTab('analyze');
          }}
          onDeleteReport={handleDeleteReport}
          onUpdateReportMeta={handleUpdateReportMeta}
          onNavigateToAnalyze={() => setActiveLandingTab('analyze')}
        />
      ) : !analysis ? (
        <BusinessInput
          onAnalyze={analyzeBusiness}
          isLoading={isLoading}
        />
      ) : (
        <Dashboard
          analysis={analysis}
          analyzedUrl={analyzedUrl}
          accounts={accounts}
          isDiscovering={isDiscovering}
          activeReportId={activeReportId}
          savedReports={savedReports}
          onAnalyzeAccount={analyzeAccountDetail}
          onRefreshDiscovery={() => discoverAccounts(analysis)}
          onUpdateReportMeta={handleUpdateReportMeta}
          onUpdateAccount={(acc) => {
            // Functional setState so rapid consecutive updates (e.g. bulk CRM
            // sync marking 5 accounts as synced in the same tick) each read the
            // freshest prev state. The stale-closure form (accounts.map(...)) would
            // let later calls stomp earlier ones and only the last would persist.
            setAccounts(prev => prev.map(a => a.id === acc.id ? acc : a));
          }}
          onAddAccount={(acc) => {
            // Prepend so newly-added prospects appear at the top of the list.
            // Guard against duplicate ids (e.g. rapid double-click) to keep the
            // account map unique.
            setAccounts(prev => (prev.some(a => a.id === acc.id) ? prev : [acc, ...prev]));
          }}
          onSaveReport={handleSaveReport}
          onUpdateReport={(updatedAnalysis, updatedAccounts) => {
            setAnalysis(updatedAnalysis);
            setAccounts(updatedAccounts);
            handleSaveReport("", updatedAnalysis, updatedAccounts);
          }}
          onShowSavedReports={() => setActiveLandingTab('saved-library')}
          onBack={() => {
            abortDeepAnalysis();
            setAnalysis(null);
            setActiveReportId(null);
            setAnalyzedUrl(null);
            toast.info("Returned to seller website input screen");
          }}
          headerRightSlot={(
            <UserMenu
              user={currentUser}
              open={userMenuOpen}
              onToggle={() => setUserMenuOpen((v) => !v)}
              onLogout={handleLogout}
            />
          )}
        />
      )}
        </>
      )}

      {/* Floating user menu — only rendered when the shared header is not
          visible (i.e. on the landing page or the dashboard, which both
          host their own headers). Keeps sign-out one click away from every
          screen. Positioned inside the JarvisOrb column so it never overlaps
          the orb itself. */}
      {/* Only render the floating menu on the marketing landing page.
          When Dashboard is up, App passes the same UserMenu into Dashboard's
          own header via headerRightSlot so it sits with the theme toggle
          instead of floating over the new bell/slack icons. */}
      {showLanding && !analysis && (
        <div className="fixed top-4 right-4 z-[60]">
          <UserMenu
            user={currentUser}
            open={userMenuOpen}
            onToggle={() => setUserMenuOpen((v) => !v)}
            onLogout={handleLogout}
            floating
          />
        </div>
      )}

      <JarvisOrb
        getContext={() => {
          const parts: string[] = [];
          if (analyzedUrl) parts.push(`Analyzed website: ${analyzedUrl}`);
          if (analysis) {
            const a: any = analysis;
            const industry = a?.icp?.industry || a?.industry;
            const overview = a?.overview || a?.summary;
            if (industry) parts.push(`Business industry / ICP: ${industry}`);
            if (overview) parts.push(`Business overview: ${String(overview).slice(0, 400)}`);
            if (a?.icp) {
              const icpBits: string[] = [];
              if (a.icp.companySize) icpBits.push(`company size ${a.icp.companySize}`);
              if (a.icp.geography) icpBits.push(`geography ${a.icp.geography}`);
              if (Array.isArray(a.icp.painPoints) && a.icp.painPoints.length) {
                icpBits.push(`pain points: ${a.icp.painPoints.slice(0, 4).join(', ')}`);
              }
              if (icpBits.length) parts.push(`ICP details: ${icpBits.join('; ')}`);
            }
          }
          if (accounts.length > 0) {
            parts.push(`Discovered accounts (${accounts.length}): ` +
              accounts.slice(0, 8).map((a: any) => `${a.name || a.domain}${typeof a.fitScore === 'number' ? ` (fit ${a.fitScore})` : ''}`).join(', '));
          }
          if (savedReports.length > 0) {
            parts.push(`Saved reports (${savedReports.length}): ` +
              savedReports.slice(0, 6).map((r: any) => `"${r.name}"`).join(', '));
          }
          parts.push(`Current screen: ${activeLandingTab === 'saved-library' ? 'Saved Reports' : analysis ? 'Dashboard' : showLanding ? 'Landing page' : 'Analyze Website'}`);
          return parts.join('\n');
        }}
        onAction={(a: JarvisAction) => {
          const { action, args } = a;
          switch (action) {
            case 'navigate.home':
              setShowLanding(true);
              return;
            case 'navigate.analyze':
              setShowLanding(false);
              setActiveLandingTab('analyze');
              if (analysis) {
                // If a dashboard is loaded, clear it so the input screen shows.
                abortDeepAnalysis();
                setAnalysis(null);
                setActiveReportId(null);
                setAnalyzedUrl(null);
              }
              return;
            case 'navigate.dashboard':
              setShowLanding(false);
              setActiveLandingTab('analyze');
              if (!analysis) {
                toast.info('No analysis loaded. Analyze a website first.');
              }
              return;
            case 'navigate.savedReports':
              setShowLanding(false);
              setActiveLandingTab('saved-library');
              return;
            case 'navigate.back':
              if (analysis) {
                abortDeepAnalysis();
                setAnalysis(null);
                setActiveReportId(null);
                setAnalyzedUrl(null);
              } else {
                setShowLanding(true);
              }
              return;
            case 'theme.toggle': {
              const cur = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
              applyTheme(cur === 'dark' ? 'light' : 'dark');
              return;
            }
            case 'theme.set': {
              const mode = (args?.mode as string) === 'light' ? 'light' : 'dark';
              applyTheme(mode);
              return;
            }
            case 'analyzeUrl': {
              const url = String(args?.url ?? '').trim();
              if (!url) { toast.error('Jarvis needed a URL to analyze.'); return; }
              setShowLanding(false);
              setActiveLandingTab('analyze');
              analyzeBusiness(url);
              return;
            }
            case 'loadReport': {
              const q = String(args?.query ?? '').trim().toLowerCase();
              if (!q) return;
              const match = savedReports.find(r => (r.name || '').toLowerCase().includes(q));
              if (match) {
                setShowLanding(false);
                setActiveLandingTab('analyze');
                handleLoadReport(match.id);
              } else {
                toast.error(`No saved report matching "${q}".`);
              }
              return;
            }
            case 'landing.playIntroVideo':
            case 'landing.pauseIntroVideo':
            case 'landing.fullscreenIntroVideo':
            case 'landing.scrollToWatch':
            case 'landing.scrollToFeatures':
            case 'landing.scrollToCta':
              // Component-scoped — dispatch a window event; LandingPage listens.
              if (!showLanding) setShowLanding(true);
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('jarvis:landing', { detail: { action, args } }));
              }, showLanding ? 0 : 300);
              return;
            case 'dashboard.tab':
            case 'dashboard.refresh':
            case 'dashboard.saveReport':
            case 'dashboard.openAccount':
            case 'dashboard.closeDetail':
              if (!analysis) {
                toast.info('Open an analysis first — no dashboard is loaded.');
                return;
              }
              window.dispatchEvent(new CustomEvent('jarvis:dashboard', { detail: { action, args } }));
              return;
            case 'input.setUrl':
            case 'input.setCount':
            case 'input.submit':
              // Route to Business Input screen. If we're not on it, go there first.
              if (analysis) {
                abortDeepAnalysis();
                setAnalysis(null);
                setActiveReportId(null);
                setAnalyzedUrl(null);
              }
              setShowLanding(false);
              setActiveLandingTab('analyze');
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('jarvis:input', { detail: { action, args } }));
              }, 60);
              return;
            case 'savedReports.load':
            case 'savedReports.delete':
              // Ensure we're on the saved-reports screen so the listener is mounted.
              setShowLanding(false);
              setActiveLandingTab('saved-library');
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('jarvis:savedReports', { detail: { action, args } }));
              }, 60);
              return;
            case 'scroll.up':
              window.scrollBy({ top: -Math.round(window.innerHeight * 0.85), behavior: 'smooth' });
              return;
            case 'scroll.down':
              window.scrollBy({ top: Math.round(window.innerHeight * 0.85), behavior: 'smooth' });
              return;
            case 'scroll.top':
              window.scrollTo({ top: 0, behavior: 'smooth' });
              return;
            case 'scroll.bottom':
              window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
              return;
            case 'readCurrentScreen':
              // No action — Jarvis's reply already contains the read-out.
              return;
            default:
              // Unknown action — no-op
              return;
          }
        }}
      />
    </div>
  );
}

