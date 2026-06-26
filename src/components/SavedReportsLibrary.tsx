import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, Calendar, Trash2, FolderOpen, Search, ArrowLeft, 
  Sparkles, Layers, ShieldCheck, TrendingUp, AlertCircle, LayoutGrid, List, ChevronRight,
  Download, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface SavedReportsLibraryProps {
  savedReports: any[];
  onLoadReport: (id: string) => void;
  onDeleteReport: (id: string) => void;
  onNavigateToAnalyze: () => void;
  onUpdateReportMeta?: (id: string, name: string) => void;
}

export function SavedReportsLibrary({
  savedReports = [],
  onLoadReport,
  onDeleteReport,
  onNavigateToAnalyze,
  onUpdateReportMeta
}: SavedReportsLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Edit & Rename states
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingReportName, setEditingReportName] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleOpenEditModal = (id: string, name: string) => {
    setEditingReportId(id);
    setEditingReportName(name);
    setIsEditModalOpen(true);
  };

  const handleSaveRename = () => {
    if (!editingReportName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    if (editingReportId && onUpdateReportMeta) {
      onUpdateReportMeta(editingReportId, editingReportName.trim());
    }
    setIsEditModalOpen(false);
    setEditingReportId(null);
  };

  // CSV Exporter for a single saved report's accounts
  const handleExportReport = (report: any) => {
    const reportAccounts = report.accounts || [];
    if (reportAccounts.length === 0) {
      toast.error("No account data available to export in this saved report.");
      return;
    }

    const headers = [
      "Company Name",
      "Domain Name",
      "ICP Fit Score",
      "Timing Score",
      "Priority Index",
      "Priority Flag",
      "Applied Sector Model",
      "Outreach Window",
      "Disqualified",
      "Signals",
      "Description"
    ];

    const rows = reportAccounts.map((account: any) => {
      const signalsStr = (account.signals || []).join(" | ");
      return [
        account.name,
        account.domain,
        account.fitScore || "65%",
        account.timingScore || "70%",
        account.isDisqualified ? "EXCLUDED" : (account.priorityIndex || "Gold Standard"),
        account.isDisqualified ? "DO NOT PURSUE" : (account.priorityFlag || "Standard Outreach"),
        account.forcedSectorModel || "General",
        account.outreachWindow || "Current Qtr",
        account.isDisqualified ? "Yes" : "No",
        signalsStr,
        account.description || account.fitReason || ""
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) => 
        row.map((val: any) => {
          const str = String(val ?? "");
          if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(",")
      )
    ].join("\n");

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `saved_report_export_${report.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Successfully exported ${reportAccounts.length} accounts to CSV!`);
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    }
  };

  // Calculate statistics
  const totalReportsCount = savedReports.length;
  const totalAccountsDiscovered = savedReports.reduce((sum, r) => sum + (r.accounts?.length || 0), 0);
  
  // Find latest saved report date
  const latestReportDate = savedReports.length > 0 
    ? new Date(Math.max(...savedReports.map(r => new Date(r.timestamp).getTime()))).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'None';

  // Filter reports
  const filteredReports = savedReports.filter(report => {
    const nameMatch = report.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const companyMatch = report.analysis?.businessName?.toLowerCase().includes(searchQuery.toLowerCase());
    const domainMatch = report.analysis?.overview?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || companyMatch || domainMatch;
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8 font-sans">
      
      {/* Top Welcome Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 block">
              <Layers className="w-5 h-5 animate-pulse" />
            </span>
            <span className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">WORKSPACE INTEL</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight font-sans">
            Saved Reports & Market Scopes
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Access your previously generated target accounts, custom ideal customer profiles, and outbound pipelines.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onNavigateToAnalyze}
            className="text-xs font-bold gap-1.5 h-10 border-slate-200 shadow-3xs cursor-pointer text-slate-600 hover:bg-slate-50 transition-all rounded-xl"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go to Website Analyzer</span>
          </Button>
        </div>
      </div>

      {totalReportsCount > 0 ? (
        <>
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white border border-slate-200 p-5 rounded-2xl shadow-3xs flex items-center gap-4"
            >
              <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Saved Reports</span>
                <span className="text-2xl font-black text-slate-900 font-mono">{totalReportsCount}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white border border-slate-200 p-5 rounded-2xl shadow-3xs flex items-center gap-4"
            >
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Leads Mapped</span>
                <span className="text-2xl font-black text-slate-900 font-mono">{totalAccountsDiscovered}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white border border-slate-200 p-5 rounded-2xl shadow-3xs flex items-center gap-4"
            >
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Latest Activity</span>
                <span className="text-sm font-bold text-slate-700 truncate block max-w-[180px]">{latestReportDate}</span>
              </div>
            </motion.div>
          </div>

          {/* Search bar & Filter Header with Grid/List View Switchers */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 p-4 border border-slate-200/60 rounded-xl font-sans">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search saved plans, domains, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 font-medium"
              />
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-medium hidden md:inline">
                Showing <strong className="text-slate-700">{filteredReports.length}</strong> of {totalReportsCount} saved configurations
              </span>
              
              {/* Toggles */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-3xs">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'grid' 
                      ? 'bg-indigo-50 text-indigo-600' 
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'list' 
                      ? 'bg-indigo-50 text-indigo-600' 
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Saved Reports Card Catalog Grid list inside Route Router */}
          {filteredReports.length > 0 ? (
            viewMode === 'grid' ? (
              /* GRID VIEW METHOD */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReports.map((report, idx) => {
                  const industryList = report.analysis?.targetIndustries || [];
                  const accountCount = report.accounts?.length || 0;
                  
                  return (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, scale: 0.98, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-400 hover:shadow-md transition-all group flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3 min-w-0">
                          <div className="min-w-0 flex-1">
                            <Badge 
                              variant="outline" 
                              className="bg-slate-50 text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wide border-slate-150 py-0.5 block truncate w-full max-w-[150px] md:max-w-[170px]"
                              title={report.analysis?.businessName || 'Outbound Scope'}
                            >
                              {report.analysis?.businessName || 'Outbound Scope'}
                            </Badge>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 font-mono shrink-0 whitespace-nowrap">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {new Date(report.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1 group/title">
                            <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-base line-clamp-1 flex-1">
                              {report.name}
                            </h3>
                            <button
                              onClick={() => handleOpenEditModal(report.id, report.name)}
                              className="opacity-0 group-hover/title:opacity-100 hover:text-indigo-650 text-slate-400 p-1 rounded transition-all cursor-pointer inline-flex items-center"
                              title="Rename Report"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed h-8">
                            {report.analysis?.overview || 'No additional company analysis outline saved.'}
                          </p>
                        </div>

                        {/* Industries badge list */}
                        {industryList.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1 h-6 overflow-hidden">
                            {industryList.slice(0, 3).map((ind: string, i: number) => (
                              <span 
                                key={i} 
                                className="text-[9px] font-bold px-2 py-0.5 bg-indigo-50/50 border border-indigo-100 text-indigo-700 rounded-md uppercase"
                              >
                                {ind}
                              </span>
                            ))}
                            {industryList.length > 3 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                                +{industryList.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-100 mt-5 pt-4 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold font-mono text-indigo-650 bg-indigo-50/70 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                            {accountCount} Leads
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => onLoadReport(report.id)}
                            className="h-8 text-xs font-bold gap-1 px-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg cursor-pointer shadow-3xs"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Launch</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportReport(report)}
                            className="h-8 w-8 p-0 text-slate-500 border-slate-200 hover:text-indigo-655 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 rounded-lg cursor-pointer inline-flex items-center justify-center animate-fadeIn"
                            title="Export to CSV"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteReport(report.id)}
                            className="h-8 w-8 p-0 text-slate-450 hover:text-red-650 hover:bg-red-50 rounded-lg cursor-pointer"
                            title="Delete Saved Report"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW METHOD (TABLE ROW DETAILS) */
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white border border-slate-200 rounded-2xl shadow-3xs overflow-hidden"
              >
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase font-bold tracking-wider">
                        <th className="py-3 px-6 select-none">Scope Name / Campaign Unit</th>
                        <th className="py-3 px-6 select-none">Client Brand Domain</th>
                        <th className="py-3 px-6 select-none">Industries Targeted</th>
                        <th className="py-3 px-6 select-none text-center">Date Saved</th>
                        <th className="py-3 px-6 select-none text-center">Mapped Leads</th>
                        <th className="py-3 px-6 text-right select-none">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredReports.map((report, idx) => {
                        const targetIndustries = report.analysis?.targetIndustries || [];
                        const leadCount = report.accounts?.length || 0;
                        const businessName = report.analysis?.businessName || 'Interactive Scope';
                        
                        return (
                          <motion.tr 
                            key={report.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="hover:bg-slate-50/55 transition-all group animate-fadeIn"
                          >
                            <td className="py-4 px-6 font-bold text-slate-800">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 group/cell">
                                  <span className="group-hover:text-indigo-650 transition-colors line-clamp-1">
                                    {report.name}
                                  </span>
                                  <button
                                    onClick={() => handleOpenEditModal(report.id, report.name)}
                                    className="opacity-0 group-hover/cell:opacity-100 hover:text-indigo-650 text-slate-400 p-0.5 rounded transition-all cursor-pointer inline-flex items-center"
                                    title="Rename Report"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>
                                <span className="text-xs font-medium text-slate-400 line-clamp-1 font-sans lg:max-w-xs xl:max-w-md">
                                  {report.analysis?.overview || 'Outbound strategy outline.'}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <span className="font-mono text-xs font-semibold px-2 py-0.5 text-slate-600 bg-slate-100 rounded-md border border-slate-150">
                                {businessName}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {targetIndustries.slice(0, 2).map((ind: string, i: number) => (
                                  <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded uppercase">
                                    {ind}
                                  </span>
                                ))}
                                {targetIndustries.length > 2 && (
                                  <span className="text-[9px] font-bold px-1 bg-slate-150 text-slate-500 rounded">
                                    +{targetIndustries.length - 2}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center text-xs text-slate-500 font-medium whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5 font-mono">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>
                                  {new Date(report.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center whitespace-nowrap">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {leadCount} Leads
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => onLoadReport(report.id)}
                                  className="h-8 text-xs font-bold gap-1 px-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg cursor-pointer shadow-3xs"
                                  title="Load this outbound campaign view"
                                >
                                  <FolderOpen className="w-3.5 h-3.5" />
                                  <span>Launch</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleExportReport(report)}
                                  className="h-8 w-8 p-0 text-slate-500 border-slate-200 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 rounded-lg cursor-pointer inline-flex items-center justify-center animate-fadeIn"
                                  title="Export to CSV"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDeleteReport(report.id)}
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded-lg cursor-pointer"
                                  title="Remove Report"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )
          ) : (
            <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl max-w-md mx-auto space-y-3">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No match found</p>
              <p className="text-xs text-slate-500">Try searching for alternative keywords, company domains, or blueprint titles.</p>
              <Button size="sm" variant="outline" onClick={() => setSearchQuery('')} className="text-xs h-8 cursor-pointer">
                Clear Filters
              </Button>
            </div>
          )}
        </>
      ) : (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-16 px-4 bg-white border border-slate-200 rounded-3xl text-center space-y-6 max-w-xl mx-auto"
        >
          <div className="p-4 rounded-full bg-slate-50 border border-slate-150 text-indigo-500">
            <FileText className="w-10 h-10 stroke-[1.5]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-950 font-sans">Your Report Library is Empty</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
              Generate website market analyzes and target lists first, then click "Save Report" inside the dashboard to build your collection.
            </p>
          </div>
          <Button
            onClick={onNavigateToAnalyze}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-5 rounded-xl cursor-pointer shadow-xs gap-1"
          >
            <Sparkles className="w-4 h-4" />
            <span>Map Companies Now</span>
          </Button>
        </motion.div>
      )}

      {/* ✏️ MODAL: RENAME SAVED CONFIGURATION */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-150 rounded-2xl font-sans select-none shadow-xl">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-slate-900 font-bold text-base flex items-center gap-2">
              <Pencil className="w-4 h-4 text-indigo-650" />
              <span>Rename Saved Configuration</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update the human-readable identifier for this outbound strategy blueprint and target wave.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-left">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-550 block text-slate-500 uppercase tracking-wider">Configuration Name</label>
              <input
                type="text"
                value={editingReportName}
                onChange={(e) => setEditingReportName(e.target.value)}
                placeholder="e.g. outreach wave standard..."
                className="w-full h-10 px-3.5 rounded-lg border border-slate-205 bg-white outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium text-slate-800"
              />
            </div>
          </div>

          <DialogFooter className="flex sm:justify-end gap-2 border-t border-slate-100 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
              className="text-slate-500 hover:text-slate-800 text-xs font-bold h-9 bg-white border border-transparent shadow-none"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveRename}
              className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-lg shadow-xxs"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
