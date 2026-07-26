import React from 'react';
import {
  Search, Filter, RefreshCw, Users, Sparkles, Mail, Copy, Check,
  ExternalLink, ChevronRight, AlertCircle, TrendingUp, Building2,
  Download, Upload, Bell, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { SchedulerStatus } from './SchedulerStatus';

/**
 * Leads tab. Backed by /api/leads (JSON file store in Phase A). Refresh flows
 * through /api/leads/:id/refresh which calls Proxycurl if a key is set,
 * else returns a deterministic stub. Push-to-CRM and Export are still toasts.
 */

type LeadStatus = 'fresh' | 'role_changed' | 'left_company' | 'stale' | 'unreachable';
type EmailConfidence = 'verified' | 'probable' | 'guess' | 'unknown';
type LeadSource = 'seed' | 'auto' | 'csv' | 'manual';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  currentRole: string;
  previousRole?: string;
  company: string;
  companyDomain: string;
  previousCompany?: string;
  linkedinUrl: string;
  emailGuess: string;
  emailConfidence: EmailConfidence;
  status: LeadStatus;
  source: LeadSource;
  lastVerifiedAt: string; // ISO
  events: Array<{ at: string; type: string; detail: string }>;
  seniority: 'executive' | 'senior' | 'manager' | 'ic';
}

const STATUS_STYLES: Record<LeadStatus, { label: string; badge: string; dot: string; icon: React.ReactNode }> = {
  fresh: {
    label: 'Fresh',
    badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
    icon: <Check className="w-3 h-3" />,
  },
  role_changed: {
    label: 'Role changed',
    badge: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/60',
    dot: 'bg-orange-500',
    icon: <TrendingUp className="w-3 h-3" />,
  },
  left_company: {
    label: 'Left company',
    badge: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
    dot: 'bg-purple-500',
    icon: <ExternalLink className="w-3 h-3" />,
  },
  stale: {
    label: 'Stale',
    badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    dot: 'bg-amber-500',
    icon: <Clock className="w-3 h-3" />,
  },
  unreachable: {
    label: 'Unreachable',
    badge: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60',
    dot: 'bg-red-500',
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

const CONF_STYLES: Record<EmailConfidence, { badge: string; dot: string }> = {
  verified: { badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60', dot: 'bg-emerald-500' },
  probable: { badge: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60', dot: 'bg-blue-500' },
  guess:    { badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60', dot: 'bg-amber-500' },
  unknown:  { badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700', dot: 'bg-slate-400' },
};

type FilterKey = 'all' | 'role_changed' | 'left_company' | 'stale' | 'email_verified' | 'email_guess';

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.round((now - then) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

interface ApiLeadRow {
  id: string;
  first_name: string;
  last_name: string;
  current_role: string;
  previous_role: string | null;
  company_name: string;
  company_domain: string;
  previous_company: string | null;
  linkedin_url: string;
  email_guess: string | null;
  email_confidence: EmailConfidence;
  seniority: 'executive' | 'senior' | 'manager' | 'ic';
  status: LeadStatus;
  source?: LeadSource;
  last_verified_at: string | null;
  first_seen_at: string;
  events?: Array<{ id: string; event_type: string; detail: string; source: string; at: string }>;
}

function mapApiLead(a: ApiLeadRow): Lead {
  return {
    id: a.id,
    firstName: a.first_name,
    lastName: a.last_name,
    currentRole: a.current_role,
    previousRole: a.previous_role ?? undefined,
    company: a.company_name,
    companyDomain: a.company_domain,
    previousCompany: a.previous_company ?? undefined,
    linkedinUrl: a.linkedin_url,
    emailGuess: a.email_guess ?? '',
    emailConfidence: a.email_confidence,
    status: a.status,
    source: a.source ?? 'seed',
    lastVerifiedAt: a.last_verified_at ?? a.first_seen_at,
    events: (a.events ?? []).map((e) => ({ at: e.at, type: e.event_type, detail: e.detail })),
    seniority: a.seniority,
  };
}

const SOURCE_STYLES: Record<LeadSource, { label: string; badge: string; dot: string; title: string }> = {
  seed: {
    label: 'Seed',
    badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
    title: 'Hand-authored demo seed row (planted at server startup).',
  },
  auto: {
    label: 'Auto',
    badge: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/60',
    dot: 'bg-orange-500',
    title: 'Auto-tracked from an AccountDetail stakeholder (Hunter enrichment).',
  },
  csv: {
    label: 'CSV',
    badge: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    dot: 'bg-blue-500',
    title: 'Imported via CSV bulk upload.',
  },
  manual: {
    label: 'Manual',
    badge: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/60',
    dot: 'bg-violet-500',
    title: 'Added via POST /api/leads (script or manual entry).',
  },
};

export function LeadsTab({ analysisDomains }: { analysisDomains?: string[] } = {}) {
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<FilterKey>('all');
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  // Default: scope to current analysis whenever we have accounts to filter by.
  // This makes the tab reflect the current URL analysis on load, while a
  // one-click toggle reveals the full lifetime BD pipeline.
  const hasAnalysisScope = (analysisDomains?.length ?? 0) > 0;
  const [scopeToAnalysis, setScopeToAnalysis] = React.useState(hasAnalysisScope);
  React.useEffect(() => {
    setScopeToAnalysis(hasAnalysisScope);
  }, [hasAnalysisScope]);
  const analysisDomainSet = React.useMemo(
    () => new Set((analysisDomains ?? []).map((d) => d.trim().toLowerCase())),
    [analysisDomains],
  );

  const fetchLeads = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/leads?limit=200');
      const data = (await r.json()) as { leads: ApiLeadRow[]; total: number };
      setLeads((data.leads ?? []).map(mapApiLead));
    } catch (e: any) {
      toast.error(`Failed to load leads: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const refreshLead = React.useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/leads/${id}/refresh`, { method: 'POST' });
      const data = await r.json() as {
        source?: 'proxycurl' | 'stub';
        reachable?: boolean;
        changes?: string[];
        note?: string;
      };

      if (!data.reachable) {
        toast.error(data.note ?? 'Profile unreachable');
      } else if ((data.changes?.length ?? 0) > 0) {
        toast.success(
          `${data.source === 'proxycurl' ? 'LinkedIn' : 'Stub'} verified — ${data.changes!.join(', ')}`,
          { duration: 4500 },
        );
      } else {
        toast.info(data.source === 'proxycurl' ? 'LinkedIn verified — no changes' : (data.note ?? 'Refreshed'));
      }
      void fetchLeads();
    } catch (e: any) {
      toast.error(`Refresh failed: ${e.message}`);
    }
  }, [fetchLeads]);

  const changedCount = leads.filter((l) => l.status === 'role_changed' || l.status === 'left_company').length;

  const analysisScopedLeads = React.useMemo(() => {
    if (!scopeToAnalysis || analysisDomainSet.size === 0) return leads;
    return leads.filter((l) => analysisDomainSet.has(l.companyDomain.trim().toLowerCase()));
  }, [leads, scopeToAnalysis, analysisDomainSet]);

  const filteredLeads = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return analysisScopedLeads.filter((l) => {
      if (filter === 'role_changed' && l.status !== 'role_changed') return false;
      if (filter === 'left_company' && l.status !== 'left_company') return false;
      if (filter === 'stale' && l.status !== 'stale') return false;
      if (filter === 'email_verified' && l.emailConfidence !== 'verified') return false;
      if (filter === 'email_guess' && l.emailConfidence !== 'guess') return false;
      if (!q) return true;
      return (
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
        l.currentRole.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.emailGuess.toLowerCase().includes(q)
      );
    });
  }, [analysisScopedLeads, filter, query]);

  const inAnalysisCount = React.useMemo(() => {
    if (analysisDomainSet.size === 0) return 0;
    return leads.filter((l) => analysisDomainSet.has(l.companyDomain.trim().toLowerCase())).length;
  }, [leads, analysisDomainSet]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredLeads.length) setSelected(new Set());
    else setSelected(new Set(filteredLeads.map((l) => l.id)));
  };

  const copyEmail = (l: Lead) => {
    navigator.clipboard.writeText(l.emailGuess);
    setCopiedId(l.id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  return (
    <div className="space-y-6 animate-fadeIn text-left">
      {/* Banner: recent activity */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs border border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/30 via-transparent to-transparent opacity-60" />
        <div className="relative space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/25 text-orange-300 text-[12px] font-bold uppercase tracking-normal border border-orange-500/30">
            <Bell className="w-3" />
            <span>Lead Lifecycle Monitor</span>
          </div>
          <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-white font-sans">
            {changedCount > 0
              ? `${changedCount} lead${changedCount === 1 ? '' : 's'} changed since your last visit`
              : 'All leads are up to date'}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans font-normal">
            Employment status is re-verified against LinkedIn + company websites on a tiered schedule.
            Executives weekly, managers monthly, individual contributors quarterly. Manually refresh anything anytime.
          </p>
        </div>
        <div className="relative shrink-0 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.info('CSV import coming in Phase P4')}
            className="h-10 px-4 rounded-xl text-xs gap-2 bg-transparent border-white/20 text-white hover:bg-white/10"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </Button>
          <Button
            size="sm"
            onClick={() => { toast.success(`Queued re-verification for ${leads.length} leads`); void fetchLeads(); }}
            className="bg-orange-600 hover:bg-orange-500 text-white font-bold h-10 px-4 rounded-xl shadow-xs border-0 flex items-center gap-2 text-xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh all</span>
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Leads" value={leads.length} accent="text-slate-900 dark:text-slate-100" />
        <StatCard label="Role Changed (7d)" value={leads.filter((l) => l.status === 'role_changed').length} accent="text-orange-600 dark:text-orange-400" />
        <StatCard label="Left Company" value={leads.filter((l) => l.status === 'left_company').length} accent="text-purple-600 dark:text-purple-400" />
        <StatCard label="Email Verified" value={leads.filter((l) => l.emailConfidence === 'verified').length} accent="text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Scheduled re-runs — background lead/pattern refresh, plus per-job "Run now" */}
      <SchedulerStatus onLeadsRefreshed={() => void fetchLeads()} />

      {/* Filter + search bar */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, role, company, or email…"
            className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasAnalysisScope && (
            <button
              onClick={() => setScopeToAnalysis((v) => !v)}
              title={
                scopeToAnalysis
                  ? `Showing ${inAnalysisCount} lead${inAnalysisCount === 1 ? '' : 's'} whose company is in the current analysis. Click to see the full lifetime pipeline.`
                  : `Showing all ${leads.length} leads. Click to narrow to the ${inAnalysisCount} in the current analysis.`
              }
              className={`px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                scopeToAnalysis
                  ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:border-orange-600'
                  : 'bg-white dark:bg-slate-900 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800/60 hover:border-orange-500'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>{scopeToAnalysis ? `In this analysis (${inAnalysisCount})` : `Show this analysis only (${inAnalysisCount})`}</span>
            </button>
          )}
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterChip>
          <FilterChip active={filter === 'role_changed'} onClick={() => setFilter('role_changed')} accent="orange">Role changed</FilterChip>
          <FilterChip active={filter === 'left_company'} onClick={() => setFilter('left_company')} accent="purple">Left company</FilterChip>
          <FilterChip active={filter === 'stale'} onClick={() => setFilter('stale')} accent="amber">Stale</FilterChip>
          <FilterChip active={filter === 'email_verified'} onClick={() => setFilter('email_verified')} accent="emerald">Verified email</FilterChip>
          <FilterChip active={filter === 'email_guess'} onClick={() => setFilter('email_guess')} accent="amber">Email guess</FilterChip>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="rounded-xl border border-orange-200 dark:border-orange-800/60 bg-orange-50 dark:bg-orange-950/30 px-4 py-2.5 flex items-center gap-3 text-sm">
          <span className="text-orange-800 dark:text-orange-200 font-semibold">
            {selected.size} lead{selected.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => toast.success(`Queued refresh for ${selected.size} leads`)} className="h-8 text-xs gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.success(`Pushing ${selected.size} leads to CRM…`)} className="h-8 text-xs gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />Push to CRM
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.success(`Exporting ${selected.size} leads to CSV…`)} className="h-8 text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" />Export
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="h-8 text-xs">
            Clear
          </Button>
        </div>
      )}

      {/* Lead table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="grid grid-cols-[24px_1.5fr_1.3fr_1.5fr_0.85fr_0.75fr_0.85fr_24px] items-center gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={selected.size === filteredLeads.length && filteredLeads.length > 0}
            onChange={toggleAll}
            className="w-3.5 h-3.5 accent-orange-500 cursor-pointer"
          />
          <div>Name</div>
          <div>Role</div>
          <div>Email</div>
          <div>Status</div>
          <div>Source</div>
          <div>Last Verified</div>
          <div />
        </div>

        {filteredLeads.length === 0 && (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No leads match your filter.</p>
            <Button variant="link" onClick={() => { setQuery(''); setFilter('all'); }} className="text-orange-600 dark:text-orange-400 mt-1 h-auto p-0 text-xs">
              Clear filters
            </Button>
          </div>
        )}

        {filteredLeads.map((l) => (
          <div key={l.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
            <div className="grid grid-cols-[24px_1.5fr_1.3fr_1.5fr_0.85fr_0.75fr_0.85fr_24px] items-center gap-3 px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
              <input
                type="checkbox"
                checked={selected.has(l.id)}
                onChange={() => toggleSelect(l.id)}
                className="w-3.5 h-3.5 accent-orange-500 cursor-pointer"
              />

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {l.firstName} {l.lastName}
                  </div>
                  <a href={l.linkedinUrl} target="_blank" rel="noreferrer" title="Open LinkedIn" className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                  <Building2 className="w-2.5 h-2.5" />
                  {l.company}
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-[12.5px] text-slate-800 dark:text-slate-200 truncate">{l.currentRole}</div>
                {l.previousRole && l.status === 'role_changed' && (
                  <div className="text-[10.5px] text-slate-400 dark:text-slate-500 line-through truncate">was: {l.previousRole}</div>
                )}
              </div>

              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-[12px] font-mono text-slate-700 dark:text-slate-300 truncate">{l.emailGuess}</span>
                <span className={`inline-flex items-center gap-1 text-[9.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border shrink-0 ${CONF_STYLES[l.emailConfidence].badge}`}>
                  <span className={`w-1 h-1 rounded-full ${CONF_STYLES[l.emailConfidence].dot}`} />
                  {l.emailConfidence}
                </span>
                <button onClick={() => copyEmail(l)} className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0" title="Copy email">
                  {copiedId === l.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </button>
              </div>

              <div>
                <span className={`inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${STATUS_STYLES[l.status].badge}`}>
                  {STATUS_STYLES[l.status].icon}
                  {STATUS_STYLES[l.status].label}
                </span>
              </div>

              <div>
                <span
                  title={SOURCE_STYLES[l.source].title}
                  className={`inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${SOURCE_STYLES[l.source].badge}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${SOURCE_STYLES[l.source].dot}`} />
                  {SOURCE_STYLES[l.source].label}
                </span>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {relTime(l.lastVerifiedAt)}
              </div>

              <button
                onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="View details"
              >
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded === l.id ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {expanded === l.id && (
              <div className="px-4 py-4 bg-slate-50/60 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Event Timeline</div>
                  <div className="space-y-2">
                    {l.events.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-[12px]">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <div className="text-slate-700 dark:text-slate-300">{e.detail}</div>
                          <div className="text-[10.5px] text-slate-400">{relTime(e.at)} · <span className="font-mono">{e.type}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Actions</div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => refreshLead(l.id)} className="h-8 text-xs gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" />Refresh now
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toast.success('Re-learning email pattern via Hunter.io…')} className="h-8 text-xs gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />Re-learn email
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toast.success(`Pushing to CRM…`)} className="h-8 text-xs gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" />Push to CRM
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(l.linkedinUrl, '_blank')} className="h-8 text-xs gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" />Open LinkedIn
                    </Button>
                  </div>
                  <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
                    Domain: <span className="font-mono">{l.companyDomain}</span>
                    {' · '}Seniority: <span className="font-semibold">{l.seniority}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 px-4 py-3 text-[11.5px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
        <Filter className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Backed by a SQLite lead store (Phase A). Every upsert dedupes on <span className="font-mono">linkedin_url</span>, writes to <span className="font-mono">lead_events</span>, and flips status when role or company changes.
          Swap the DB driver for Postgres/Supabase without touching this UI. Refresh currently queues a placeholder event — real Proxycurl worker lands in Phase P1.
        </span>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

const CHIP_ACCENT: Record<string, string> = {
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800/60',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
  amber:  'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
  emerald:'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
};

function FilterChip({
  active, onClick, children, accent,
}: { active: boolean; onClick: () => void; children: React.ReactNode; accent?: keyof typeof CHIP_ACCENT }) {
  const base = 'px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border transition-colors cursor-pointer';
  const activeStyle = accent ? CHIP_ACCENT[accent] : 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100';
  const inactive = 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500';
  return (
    <button onClick={onClick} className={`${base} ${active ? activeStyle : inactive}`}>
      {children}
    </button>
  );
}
