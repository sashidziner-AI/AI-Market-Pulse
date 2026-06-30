/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BusinessInput } from './components/BusinessInput';
import { Dashboard } from './components/Dashboard';
import { SavedReportsLibrary } from './components/SavedReportsLibrary';
import { BusinessAnalysis, TargetAccount, DetailedAnalysis } from './types';
import { Toaster, toast } from 'sonner';
import { Rocket, Globe, FileText } from 'lucide-react';
import { ThemeToggle } from './components/ThemeToggle';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [activeLandingTab, setActiveLandingTab] = useState<'analyze' | 'saved-library'>('analyze');

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

  const handleSaveReport = (name: string, customAnalysis?: BusinessAnalysis, customAccounts?: TargetAccount[]) => {
    const finalAnalysis = customAnalysis || analysis;
    const finalAccounts = customAccounts || accounts;

    if (!finalAnalysis) {
      toast.error("Cannot save empty report");
      return "";
    }

    const reportId = activeReportId || `report-${Date.now()}`;
    const reportName = name || `Outreach Plan: ${finalAnalysis.businessName}`;

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

  const analyzeBusiness = async (url: string) => {
    setIsLoading(true);
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
      
      // Auto-start discovery after business analysis
      discoverAccounts(data);
    } catch (error: any) {
      toast.error('Failed to analyze business: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const discoverAccounts = async (businessData: BusinessAnalysis) => {
    setIsDiscovering(true);
    try {
      const response = await fetch('/api/discover-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          businessContext: businessData, 
          icp: businessData.icp 
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
    } catch (error: any) {
      toast.error('Discovery failed: ' + error.message);
    } finally {
      setIsDiscovering(false);
    }
  };

  const analyzeAccountDetail = async (id: string) => {
    const account = accounts.find(a => a.id === id);
    if (!account || account.analysis) return;

    try {
      const response = await fetch('/api/analyze-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain: account.domain, 
          businessContext: analysis 
        }),
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      if (data.isFallback) {
        toast.warning('API limits reached. Loaded optimized competitor displacement profiles for this account.', {
          duration: 6000
        });
      }

      setAccounts(prev => prev.map(a => 
        a.id === id ? { ...a, analysis: data as DetailedAnalysis } : a
      ));
    } catch (error: any) {
      toast.error('Deep analysis failed: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 bg-linear-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-900 dark:selection:text-indigo-100 flex flex-col justify-start">
      <Toaster position="top-center" expand={true} richColors />
      
      {/* Dynamic Navigation Header for Workspace Landing Screen */}
      {!analysis && (
        <header className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80 sticky top-0 z-40 transition-all shadow-2xs">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                <Rocket className="w-4 h-4" />
              </div>
              <span
                className="font-extrabold text-sm md:text-base tracking-tight text-slate-900 dark:text-slate-100 hover:opacity-90 cursor-pointer select-none"
                onClick={() => setActiveLandingTab('analyze')}
              >
                AI Market Pulse
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
                <button
                  onClick={() => setActiveLandingTab('analyze')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeLandingTab === 'analyze'
                      ? 'bg-white dark:bg-slate-900 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-3xs'
                      : 'text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Analyze Website</span>
                </button>

                <button
                  onClick={() => setActiveLandingTab('saved-library')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer relative ${
                    activeLandingTab === 'saved-library'
                      ? 'bg-white dark:bg-slate-900 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-3xs'
                      : 'text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Saved Reports</span>
                  {savedReports.length > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white leading-none scale-90 border border-white dark:border-slate-900 font-mono">
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

      {/* Page Content Router */}
      {!analysis ? (
        activeLandingTab === 'analyze' ? (
          <BusinessInput 
            onAnalyze={analyzeBusiness} 
            isLoading={isLoading} 
          />
        ) : (
          <SavedReportsLibrary
            savedReports={savedReports}
            onLoadReport={handleLoadReport}
            onDeleteReport={handleDeleteReport}
            onUpdateReportMeta={handleUpdateReportMeta}
            onNavigateToAnalyze={() => setActiveLandingTab('analyze')}
          />
        )
      ) : (
        <Dashboard 
          analysis={analysis} 
          accounts={accounts} 
          isDiscovering={isDiscovering}
          activeReportId={activeReportId}
          savedReports={savedReports}
          onAnalyzeAccount={analyzeAccountDetail}
          onRefreshDiscovery={() => discoverAccounts(analysis)}
          onUpdateReportMeta={handleUpdateReportMeta}
          onUpdateAccount={(acc) => {
            const updated = accounts.map(a => a.id === acc.id ? acc : a);
            setAccounts(updated);
            // Auto update saved report draft if currently reading a saved report
            if (activeReportId) {
              handleSaveReport("", analysis, updated);
            }
          }}
          onSaveReport={handleSaveReport}
          onUpdateReport={(updatedAnalysis, updatedAccounts) => {
            setAnalysis(updatedAnalysis);
            setAccounts(updatedAccounts);
            handleSaveReport("", updatedAnalysis, updatedAccounts);
          }}
          onBack={() => {
            setAnalysis(null);
            setActiveReportId(null);
            toast.info("Returned to seller website input screen");
          }}
        />
      )}
    </div>
  );
}

