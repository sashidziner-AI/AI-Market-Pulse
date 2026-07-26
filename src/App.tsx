/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BusinessInput } from './components/BusinessInput';
import { Dashboard, getDefaultReportName } from './components/Dashboard';
import { SavedReportsLibrary } from './components/SavedReportsLibrary';
import { LandingPage } from './components/LandingPage';
import { BusinessAnalysis, TargetAccount, DetailedAnalysis } from './types';
import { Toaster, toast } from 'sonner';
import { Rocket, Globe, FileText, House } from 'lucide-react';
import { ThemeToggle, applyTheme } from './components/ThemeToggle';

export default function App() {
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
  const [savedReports, setSavedReports] = useState<any[]>(() => {
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

  // Auto-switch theme: dark for landing/analyze screens, light for dashboard.
  useEffect(() => {
    const isDashboard = !!analysis && !showLanding && activeLandingTab !== 'saved-library';
    applyTheme(isDashboard ? 'light' : 'dark');
  }, [analysis, showLanding, activeLandingTab]);
  const dismissLanding = () => {
    setShowLanding(false);
  };

  useEffect(() => {
    try {
      if (analysis) {
        localStorage.setItem('gtm_analysis', JSON.stringify(analysis));
      } else {
        localStorage.removeItem('gtm_analysis');
      }
    } catch (e) {
      console.log(e);
    }
  }, [analysis]);

  useEffect(() => {
    try {
      if (analyzedUrl) {
        localStorage.setItem('gtm_analyzed_url', analyzedUrl);
      } else {
        localStorage.removeItem('gtm_analyzed_url');
      }
    } catch (e) {
      console.log(e);
    }
  }, [analyzedUrl]);

  useEffect(() => {
    try {
      localStorage.setItem('gtm_accounts', JSON.stringify(accounts));
    } catch (e) {
      console.log(e);
    }
  }, [accounts]);

  useEffect(() => {
    try {
      localStorage.setItem('gtm_saved_reports', JSON.stringify(savedReports));
    } catch (e) {
      console.log(e);
    }
  }, [savedReports]);

  useEffect(() => {
    try {
      if (activeReportId) {
        localStorage.setItem('gtm_active_report_id', activeReportId);
      } else {
        localStorage.removeItem('gtm_active_report_id');
      }
    } catch (e) {
      console.log(e);
    }
  }, [activeReportId]);

  // Debounced auto-save of the loaded saved-report draft when accounts change
  // (e.g. after CRM sync marks accounts as synced). Debouncing collapses a
  // burst of onUpdateAccount calls into a single report save.
  useEffect(() => {
    if (!activeReportId || !analysis || accounts.length === 0) return;
    const t = setTimeout(() => {
      handleSaveReport("", analysis, accounts);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, activeReportId]);

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
    setAccounts([]);
    setActiveReportId(null);
    setAnalyzedUrl(url);
    setIsDiscovering(true);
    try {
      const response = await fetch('/api/analyze-business', {
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
      const response = await fetch('/api/discover-accounts', {
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
        void fetch('/api/enrichment/sweep', {
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
        void fetch('/api/scheduler/enroll', {
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

      const response = await fetch('/api/analyze-account?stream=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: account.domain,
          businessContext: analysis,
        }),
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
      toast.error('Deep analysis failed: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen text-zinc-900 dark:text-zinc-100 bg-stone-50 dark:bg-[#1F1F20] font-sans selection:bg-orange-100 selection:text-orange-900 dark:selection:bg-orange-900/30 dark:selection:text-orange-100 flex flex-col justify-start">
      <Toaster position="top-center" expand={true} richColors />

      {/* Marketing landing — shown first for new visitors. Fully self-hosted
          header (its own nav + theme toggle), so the shared analyze-screen
          header below is intentionally suppressed while it's visible. */}
      {showLanding && !analysis && activeLandingTab !== 'saved-library' ? (
        <LandingPage
          onEnter={dismissLanding}
          onOpenLibrary={() => {
            dismissLanding();
            setActiveLandingTab('saved-library');
          }}
          hasSavedReports={savedReports.length > 0}
        />
      ) : (
        <>

      {/* Dynamic Navigation Header for Workspace Landing Screen */}
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
                  <span className="text-white">AI</span> Market Pulse
                </span>
                <span className="mt-0.5 text-[8.5px] font-mono uppercase tracking-[0.14em] text-orange-600 dark:text-orange-400">
                  by Vee Technologies
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLanding(true)}
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
              <ThemeToggle />
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
            setAnalysis(null);
            setActiveReportId(null);
            setAnalyzedUrl(null);
            toast.info("Returned to seller website input screen");
          }}
        />
      )}
        </>
      )}
    </div>
  );
}

