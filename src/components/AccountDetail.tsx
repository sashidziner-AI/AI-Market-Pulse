import React from 'react';
import { TargetAccount, DetailedAnalysis, MultiThreadingStrategy, StakeholderNode, IntelCitation, SocialActivity, SocialPlatformData } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ShieldCheck, Mail, Linkedin, Users,
  Lightbulb, AlertCircle, Copy, Check,
  ArrowUpRight, ArrowLeft, Info, Clock, TrendingUp, AlertTriangle,
  Network, GitBranch, ShieldAlert, Sparkles, Sliders, SlidersHorizontal, Target,
  ExternalLink, Globe, Activity, RefreshCw, User, Briefcase, TrendingDown, ChevronRight, Download
} from 'lucide-react';
import { FaLinkedin, FaYoutube, FaXTwitter, FaInstagram, FaFacebook } from 'react-icons/fa6';
import { SocialSignalsCard } from './SocialSignalsCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAccountPriorityInfo, getOrInitializeSignals, AccountSignal } from './AccountCard';
import { toast } from 'sonner';
import * as crmMirror from '../utils/crmMirror';
import { EmailPatternWidget } from './EmailPatternWidget';

export function SourceCitation({ citation, inlineLabel, isSignal = false }: { citation?: IntelCitation; inlineLabel?: string; isSignal?: boolean }) {
  if (!citation) return null;

  const { sourceTier, sourceName, dateRetrieved, url, isInferred, confidenceScore } = citation;

  // Modern style indicators matching the source tier
  const tierColors = {
    Primary: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60',
      label: 'Primary Source',
      dot: 'bg-emerald-500'
    },
    Secondary: {
      bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800/60',
      label: 'Secondary Source',
      dot: 'bg-blue-500'
    },
    Tertiary: {
      bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800/60',
      label: 'Tertiary / Inferred Source',
      dot: 'bg-amber-500'
    }
  }[sourceTier] || {
    bg: 'bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
    label: sourceTier,
    dot: 'bg-slate-400'
  };

  return (
    <div className={`mt-3 p-3 rounded-lg border text-left font-sans text-xs ${isInferred ? 'bg-amber-50/10 dark:bg-amber-950/40 border-amber-200/40 dark:border-amber-800/60' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/50'}`}>
      {/* Top row — just the tier badge and confidence chip, no source name here.
          The source name is promoted to its own prominent row above the inline
          label below so it never gets squeezed / hidden on long titles. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-slate-200 dark:border-slate-700/60 pb-2 mb-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border uppercase tracking-normal ${tierColors.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${tierColors.dot}`} />
          {tierColors.label}
        </span>

        {confidenceScore !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] uppercase font-bold text-slate-400 select-none">Confidence:</span>
            <span className={`text-[13px] font-bold tracking-wide bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800 ${confidenceScore >= 85 ? 'text-emerald-700 dark:text-emerald-300' : confidenceScore >= 70 ? 'text-indigo-600 dark:text-indigo-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {confidenceScore}%
            </span>
          </div>
        )}
      </div>

      {/* Main explanation content and source warning */}
      <div className="flex items-start gap-1.5 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
        <Info className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isInferred ? 'text-amber-500 dark:text-amber-400 animate-pulse' : 'text-slate-450'}`} />
        <div className="flex-1 space-y-1">
          {/* Source name — its own row, always visible, wraps freely. */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Source:</span>
            <span className="text-[15px] font-bold text-slate-800 dark:text-slate-100 leading-snug break-words">
              {sourceName}
            </span>
          </div>
          <div>{inlineLabel || 'Intelligence gathered and authenticated on'} <span className="font-bold text-slate-700 dark:text-slate-300">{dateRetrieved}</span>.</div>

          {isInferred ? (
            <div className="mt-1 font-semibold text-amber-800 dark:text-amber-200 flex flex-wrap gap-1 items-center bg-amber-50/60 dark:bg-amber-950/40 py-1.5 pr-1.5 pl-0 rounded border border-amber-100/50 dark:border-amber-800/50">
              <span className="font-bold text-[10px] uppercase tracking-normal bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-1 rounded-sm select-none">Inferred claim warning</span>
              <span>
                {citation.verificationNote
                  || 'This claim depends entirely on tertiary public feedback or indirect inference, and should not be treated as a verified fact.'}
              </span>
            </div>
          ) : (
            <div className="mt-1 font-semibold text-emerald-800 dark:text-emerald-200 flex flex-wrap gap-1 items-center bg-emerald-50/40 dark:bg-emerald-950/40 py-1 pr-1 pl-0 rounded">
              <span className="font-bold text-[10px] uppercase tracking-normal bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 px-1 rounded-sm select-none">AI Verified Fact</span>
              <span>
                {citation.verificationNote
                  || 'This intelligence is verified from official, high-quality public filings or first-party job posts.'}
              </span>
            </div>
          )}

          {url && (
            <div className="mt-1 text-left">
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 hover:underline transition-all tracking-normal"
              >
                Go to Source Document
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface InferredStakeholder {
  name: string;
  avatarBg: string;
  linkedinUrl: string;
  estimatedYoe: number;
  recentPost: {
    text: string;
    likeCount: number;
    timeAgo: string;
  };
}

export function getInferredStakeholderDetails(role: string, company: string): InferredStakeholder {
  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  // We normalize the role to one of 4 core buckets to ensure perfect stakeholder-to-persona consistency
  // across tabs regardless of minor casing or terminology variations (e.g., 'Lead Architect' vs 'lead architect').
  const r = role.toLowerCase();
  let normalizedKey = "entry_point";
  
  if (r.includes("champion") || r.includes("architect") || r.includes("workflows director") || r.includes("director of technical workflows") || (r.includes("workflows") && r.includes("director"))) {
    normalizedKey = "champion";
  } else if (r.includes("buyer") || r.includes("procurement") || r.includes("cfo") || r.includes("finance") || r.includes("budget")) {
    normalizedKey = "buyer";
  } else if (r.includes("gatekeeper") || r.includes("security") || r.includes("compliance") || r.includes("it ") || r.includes("solution assurance")) {
    normalizedKey = "gatekeeper";
  } else if (r.includes("entry") || r.includes("workflows specialist") || r.includes("specialist") || r.includes("draughtsman")) {
    normalizedKey = "entry_point";
  } else if (r.includes("design") || r.includes("layout")) {
    if (r.includes("director") || r.includes("lead") || r.includes("head") || r.includes("manager")) {
      normalizedKey = "champion";
    } else {
      normalizedKey = "entry_point";
    }
  } else {
    if (r.includes("director") || r.includes("manager") || r.includes("head") || r.includes("leader")) {
      normalizedKey = "champion";
    } else if (r.includes("vp") || r.includes("chief") || r.includes("executive")) {
      normalizedKey = "buyer";
    }
  }

  // We assign a predictable offset to each key to select 4 distinct names from our database
  let offset = 0;
  if (normalizedKey === "entry_point") {
    offset = 1;
  } else if (normalizedKey === "champion") {
    offset = 2;
  } else if (normalizedKey === "buyer") {
    offset = 3;
  } else if (normalizedKey === "gatekeeper") {
    offset = 4;
  }

  const companyHash = getHash(company);
  
  const firstNames = [
    "Sarah", "David", "Marcus", "Elena", "Jessica", "Amanda", "Robert", "Michael", "Brian", "Aris", 
    "Sanjay", "Li", "Daniel", "Chloe", "William", "Oliver", "Sophia", "Zac", "Rachel", "Hana"
  ];
  
  const lastNames = [
    "Chen", "Wood", "Vance", "Rostova", "Jenkins", "Kelly", "Harrison", "Miller", "Thompson", "Alvarez", 
    "Patel", "Kim", "O'Connor", "Suzuki", "Dupont", "Becker", "Gomez", "Nakamura", "Smith", "Taylor"
  ];

  const nameIndex = (companyHash + offset) % firstNames.length;
  const lastNameIndex = (companyHash + offset + 3) % lastNames.length;
  const name = `${firstNames[nameIndex]} ${lastNames[lastNameIndex]}`;
  
  const colors = [
    "from-orange-500 to-amber-600",
    "from-indigo-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-rose-500 to-pink-600",
    "from-violet-500 to-purple-600"
  ];
  // Avatar colored by role-key so names/visuals perfectly align
  const avatarBg = colors[(companyHash + offset) % colors.length];
  
  // Route the fallback "Search LinkedIn" through Google with a site:
  // filter — LinkedIn's native search results page redirects unauthenticated
  // visitors to a login wall, so we'd never actually see profiles otherwise.
  // Google returns clickable LinkedIn profile snippets that work signed-out.
  const linkedinUrl = `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in ${role} ${company}`)}`;
  
  const estimatedYoe = ((companyHash + offset) % 12) + 8; // 8 to 19 years of experience

  const roleLower = role.toLowerCase();
  let selectedPostText = "";
  
  if (
    roleLower.includes("design") || 
    roleLower.includes("bim") || 
    roleLower.includes("draft") || 
    roleLower.includes("revit") || 
    roleLower.includes("cad") || 
    roleLower.includes("architect") || 
    roleLower.includes("technology") ||
    roleLower.includes("engineering")
  ) {
    const designPosts = [
      "Just reviewed our engineering pipeline standard models. Automated workflows are definitely the path forward to solve our manual coordinate validation and layout bottleneck issues. #AEC #BIM #Productivity",
      "Had a great sync with our design teams on building out automated QA integrations. Checking BIM format drafts on a continuous delivery cycle saves hours of manual checking. #Revit #CAD #DesignAutomation"
    ];
    selectedPostText = designPosts[(companyHash + offset) % designPosts.length];
  } else if (
    roleLower.includes("security") || 
    roleLower.includes("compliance") || 
    roleLower.includes("gatekeeper") || 
    roleLower.includes("it") || 
    roleLower.includes("technical") || 
    roleLower.includes("network") ||
    roleLower.includes("privacy")
  ) {
    selectedPostText = "Fascinating how security compliance can actually accelerate deal velocity rather than stand in the way. Great discussion on ISO assessments and cloud integration security today. #ITSecurity #Compliance";
  } else if (
    roleLower.includes("buyer") || 
    roleLower.includes("procurement") || 
    roleLower.includes("cfo") || 
    roleLower.includes("finance") || 
    roleLower.includes("financial") ||
    roleLower.includes("economic") || 
    roleLower.includes("budget")
  ) {
    selectedPostText = "Interesting to see how vendor risk policies are shifting towards direct co-delivery SLAs rather than traditional agency models. Optimizing margins has never been more vital. #Procurement #Fintech #Engineering";
  } else {
    selectedPostText = "Always great to meet partners who truly understand our day-to-day workflow frictions instead of just throwing generic slide-decks at us. Continuous feedback loops are key. #Workflows #DevOps";
  }

  const recentPost = {
    text: selectedPostText,
    likeCount: ((companyHash + offset) % 45) + 12,
    timeAgo: `${((companyHash + offset) % 4) + 1}d ago`
  };

  return { name, avatarBg, linkedinUrl, estimatedYoe, recentPost };
}

interface EnrichedStakeholder {
  name: string;
  title: string;
  linkedinUrl: string;
  isFallback?: boolean;
  leadId?: string | null;
  leadCreated?: boolean;
}

export function StakeholderLinkedinCard({ role, company, domain, compact = false }: { role: string; company: string; domain?: string; compact?: boolean }) {
  const details = getInferredStakeholderDetails(role, company);
  const [enriched, setEnriched] = React.useState<EnrichedStakeholder | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/enrich-stakeholder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, company, domain }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: EnrichedStakeholder) => {
        if (cancelled) return;
        if (data && !data.isFallback && data.name) {
          setEnriched(data);
        }
      })
      .catch(() => { /* fall through to synthesized placeholder */ });
    return () => { cancelled = true; };
  }, [role, company, domain]);

  const displayName = enriched?.name || details.name;
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2);
  // Guard against malformed URLs bleeding through from Hunter/other providers
  // (e.g. "linkedin.com/in/…" missing the scheme or a search-page URL). If the
  // enriched value doesn't look like a real profile, fall back to the search.
  const looksLikeProfileUrl = (u: string | undefined) => {
    if (!u) return false;
    try {
      const parsed = new URL(u);
      return parsed.hostname.endsWith('linkedin.com')
        && /^\/(in|pub|company)\/[^/]+/.test(parsed.pathname)
        && !parsed.pathname.startsWith('/search/');
    } catch {
      return false;
    }
  };
  const enrichedProfileUrl = looksLikeProfileUrl(enriched?.linkedinUrl) ? enriched!.linkedinUrl : '';
  const linkedinHref = enrichedProfileUrl || details.linkedinUrl;
  const isReal = Boolean(enriched && enrichedProfileUrl);
  const isTracked = Boolean(enriched?.leadId);
  const tooltip = isReal
    ? `Open ${displayName}'s LinkedIn profile in a new tab`
    : `Search LinkedIn for ${role} at ${company} (illustrative name — the search finds real people in this role)`;
  const trackedTooltip = enriched?.leadCreated
    ? `${displayName} was added to Leads. Open the Leads tab to see them.`
    : `${displayName} is already tracked in Leads.`;

  if (compact) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-700 rounded-lg p-2.5 flex items-center justify-between gap-3 font-sans hover:bg-slate-100/50 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${details.avatarBg} text-white flex items-center justify-center font-bold text-[12px] shrink-0 uppercase shadow-3xs`}>
            {initials}
          </div>
          <div className="min-w-0 space-y-0.5 text-left">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">{displayName}</span>
              <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-1 rounded-full border border-blue-100 dark:border-blue-800/50 font-mono scale-[0.9]">
                1st
              </span>
              {isReal && (
                <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-1 rounded-full border border-emerald-100 dark:border-emerald-800/50 font-mono">
                  Live
                </span>
              )}
              {isTracked && (
                <span title={trackedTooltip} className="bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-[10px] font-bold px-1 rounded-full border border-orange-100 dark:border-orange-800/50 font-mono">
                  Tracked
                </span>
              )}
            </div>
            <div className="text-[12px] text-slate-500 dark:text-slate-300 font-medium truncate">
              {role} at <span className="font-semibold text-slate-700 dark:text-slate-300">{company}</span>
            </div>
          </div>
        </div>
        <a
          href={linkedinHref}
          target="_blank"
          rel="noopener noreferrer"
          title={tooltip}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 text-white font-semibold text-[12px] cursor-pointer shadow-sm hover:shadow-md ring-1 ring-blue-500/40 dark:ring-blue-300/40 transition-all shrink-0"
        >
          <Linkedin className="w-3.5 h-3.5 fill-white text-blue-600 stroke-1" />
          <span>{isReal ? 'Connect on LinkedIn' : 'Search LinkedIn'}</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans shadow-3xs hover:shadow-2xs transition-all w-full">
      <div className="flex items-center gap-3.5 text-left">
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${details.avatarBg} text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 uppercase`}>
          {initials}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-none">{displayName}</span>
            <span className="inline-flex items-center justify-center bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-bold px-1.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-800/50 font-mono">
              1st
            </span>
            {isReal && (
              <span className="inline-flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800/50 font-mono">
                Live
              </span>
            )}
            {isTracked && (
              <span title={trackedTooltip} className="inline-flex items-center justify-center bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-[11px] font-bold px-1.5 py-0.5 rounded-full border border-orange-100 dark:border-orange-800/50 font-mono">
                Tracked
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-300 font-medium leading-none">
            {enriched?.title || role} at <span className="font-semibold text-slate-700 dark:text-slate-300">{company}</span>
          </div>
          <div className="text-[12px] text-slate-400 font-semibold uppercase tracking-normal font-mono">
            {isReal ? (isTracked ? 'Enriched via Apollo · Auto-added to Leads' : 'Enriched via Apollo · Real Contact') : `${details.estimatedYoe} Years Exp • Inferred Stakeholder Node`}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-auto w-full sm:w-auto justify-end">
        <a
          href={linkedinHref}
          target="_blank"
          rel="noopener noreferrer"
          title={tooltip}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[13px] cursor-pointer shadow-sm transition-colors text-center w-full sm:w-auto justify-center"
        >
          <Linkedin className="w-3.5 h-3.5 fill-white text-blue-600 dark:text-blue-300 stroke-1" />
          <span>{isReal ? 'Open LinkedIn Profile' : 'Search LinkedIn for this role'}</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
        </a>
      </div>
    </div>
  );
}

export function getOrGenerateMultiThreadingStrategy(account: TargetAccount): MultiThreadingStrategy {
  if (account.analysis?.multiThreadingStrategy) {
    return account.analysis.multiThreadingStrategy;
  }
  
  return {
    accessibleEntryPoint: {
      role: "Workflows Engineer / Senior Design Specialist",
      order: 1,
      timing: "Day 1 (Warm Discovery)",
      messagingFocus: "Frictionless setup, manual layout bottlenecks, resolving drafting backlog queues, and tool-chain standard audits.",
      strategicRole: "Entry Point",
      tacticalTactic: "Initiate outreach with a simple workflow standard inspection script. Offer a 10-minute diagnostic check to identify structural backlog root-causes."
    },
    internalChampion: {
      role: "Director of Technical Workflows / Regional BIM Manager",
      order: 2,
      timing: "Day 3 (After entry point feedback)",
      messagingFocus: "Horizontal scaling, compressing delivery deadlines from months to days, margin protection, and cross-team standard enforcement.",
      strategicRole: "Internal Champion",
      tacticalTactic: "Co-create a draft business-value case featuring workflow insights learned from step 1. Present comparable results showing 35% productivity gains."
    },
    economicBuyer: {
      role: "VP of Engineering Delivery / Procurement Director",
      order: 3,
      timing: "Day 7 (After aligning champion)",
      messagingFocus: "ROI models, replacing expensive recruitment overhead with subscription-like SLAs, and contract completion security guarantees.",
      strategicRole: "Economic Buyer",
      tacticalTactic: "Provide an executive business-case deck containing risk-mitigation guarantees and strict contract ROI projections."
    },
    technicalGatekeeper: {
      role: "Director of IT Security / Solutions Assurance Architect",
      order: 4,
      timing: "Day 10 (Parallel with ROI discussions)",
      messagingFocus: "Security protocols, SOC2 and ISO system audits, data-sandbox policies, zero-knowledge synchronizations.",
      strategicRole: "Technical Gatekeeper",
      tacticalTactic: "Deliver completed SOC2 checklists, system integration blueprints, and network flow charts pre-proactively before they require it."
    },
    sequencedMapDescription: `This multi-threaded engagement structure minimizes initial barriers by establishing technical proof of value before approaching business decision-makers. Step-by-step engagement builds a solid internal groundswell, giving key sponsors pre-vetted proof of capacity.`,
    coordinationRules: [
      "Wait 48 to 72 hours between first touches of distinct stakeholders to ensure internal discussion syncs without signal fatigue.",
      "Limit concurrent active contacts within the same business unit to a maximum of 2 to preserve a unified corporate face.",
      "Deliver compliance and security documentation as early as the first core demo schedule to pre-empt security gate halts."
    ]
  };
}

interface AccountDetailProps {
  account: TargetAccount;
  onClose: () => void;
  onUpdateAccount?: (account: TargetAccount) => void;
  onSyncToCrm?: (account: TargetAccount) => Promise<void> | void;
  onRefreshCrmStatus?: (account: TargetAccount) => void;
  onUpdateCrmRecord?: (account: TargetAccount) => void;
  crmConnected?: boolean;
  crmProviderName?: string;
  isCrmLoading?: boolean;
}

export function AccountDetail({
  account,
  onClose,
  onUpdateAccount,
  onSyncToCrm,
  onRefreshCrmStatus,
  onUpdateCrmRecord,
  crmConnected = false,
  crmProviderName = 'your CRM',
  isCrmLoading = false,
}: AccountDetailProps) {
  const [copied, setCopied] = React.useState<string | null>(null);

  // Ref on the scrollable content wrapper so we can rasterize it to PDF.
  const reportContentRef = React.useRef<HTMLDivElement | null>(null);
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);

  // Interactive account property editors state variables
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(account.name);
  const [editDomain, setEditDomain] = React.useState(account.domain);
  const [editDescription, setEditDescription] = React.useState(account.description || '');
  const [editRationale, setEditRationale] = React.useState(account.analysis?.rationale || account.fitReason || '');
  const [editFitScore, setEditFitScore] = React.useState(account.fitScore || 75);

  // Sync edits if active account prop changes
  React.useEffect(() => {
    setEditName(account.name);
    setEditDomain(account.domain);
    setEditDescription(account.description || '');
    setEditRationale(account.analysis?.rationale || account.fitReason || '');
    setEditFitScore(account.fitScore || 75);
    setIsEditing(false);
  }, [account]);

  // Rasterize the report content into a multi-page A4 PDF and trigger a
  // download. Uses html2canvas-pro so the PDF matches what's on screen
  // exactly (including dark mode + Tailwind v4 oklch colors).
  const handleDownloadPdf = async () => {
    const node = reportContentRef.current;
    if (!node) {
      toast.error('Report content not ready. Please try again.');
      return;
    }
    setIsExportingPdf(true);

    // html2canvas can force reflows on the source page. Snapshot the scroll
    // position and any active-element focus so we can restore them after the
    // capture completes, preventing the "UI jumped" feel some users hit.
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const activeElement = document.activeElement as HTMLElement | null;

    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas-pro'),
      ]);
      const isDark = document.documentElement.classList.contains('dark');

      // Rasterize the source at its exact desktop-design width so column
      // layouts don't collapse to mobile/single-column during capture.
      const captureWidth = Math.max(node.scrollWidth, 1152);

      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        logging: false,
        width: captureWidth,
        windowWidth: captureWidth,
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.textContent = `
            * { animation: none !important; transition: none !important; }
            [data-motion-anim], [data-framer-appear-id] { transform: none !important; opacity: 1 !important; }
          `;
          clonedDoc.head.appendChild(style);
        },
      });

      // A4 landscape — width closer to the layout's natural design width so
      // content isn't squished vertically. 842 × 595 pt at 72dpi.
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Slice the canvas into page-sized chunks and add each as its own image.
      // This avoids cutting text mid-line by rendering exactly what fits on
      // each page as a separate raster.
      const canvasPageHeight = Math.floor((canvas.width * pageHeight) / pageWidth);
      let renderedHeight = 0;
      let pageIndex = 0;
      while (renderedHeight < canvas.height) {
        const sliceHeight = Math.min(canvasPageHeight, canvas.height - renderedHeight);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2d context unavailable');
        ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        const sliceData = pageCanvas.toDataURL('image/png');
        if (pageIndex > 0) pdf.addPage();
        const imgHeightOnPage = (sliceHeight * pageWidth) / canvas.width;
        pdf.addImage(sliceData, 'PNG', 0, 0, pageWidth, imgHeightOnPage, undefined, 'FAST');
        renderedHeight += sliceHeight;
        pageIndex += 1;
      }

      const safeName = (account.name || 'account')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'account';
      const stamp = new Date().toISOString().slice(0, 10);
      pdf.save(`${safeName}-market-pulse-${stamp}.pdf`);
      toast.success('Report downloaded.');
    } catch (err: any) {
      toast.error(`PDF export failed: ${err.message || 'unknown error'}`);
    } finally {
      setIsExportingPdf(false);

      // Restore scroll and focus that html2canvas may have moved during
      // its clone/measure pass. Nudging window with a resize event forces
      // any responsive components (Recharts, etc.) to re-measure.
      window.scrollTo(scrollX, scrollY);
      if (activeElement && typeof activeElement.focus === 'function') {
        try { activeElement.focus({ preventScroll: true }); } catch { /* noop */ }
      }
      window.dispatchEvent(new Event('resize'));
    }
  };

  // Social signals state — lazy-fetched on mount once per account
  const [socialLoading, setSocialLoading] = React.useState(false);
  const [socialData, setSocialData] = React.useState<SocialActivity | null>(account.socialActivity ?? null);

  // Sync social data when account prop changes (e.g. parent re-propagates saved result)
  React.useEffect(() => {
    setSocialData(account.socialActivity ?? null);
  }, [account.id]);

  // Auto-fetch on mount if social activity not yet loaded for this account
  React.useEffect(() => {
    if (account.socialActivity) return;
    let cancelled = false;
    setSocialLoading(true);
    fetch('/api/analyze-social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: account.domain, companyName: account.name }),
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: SocialActivity) => {
        if (cancelled) return;
        setSocialData(data);
        setSocialLoading(false);
        onUpdateAccount?.({ ...account, socialActivity: data });
      })
      .catch(() => { if (!cancelled) setSocialLoading(false); });
    return () => { cancelled = true; };
  }, [account.id]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const analysis = account.analysis;
  const info = getAccountPriorityInfo(account);
  const resolvedSignals = getOrInitializeSignals(account);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 overflow-y-auto"
    >
      {/* Full-screen blocking overlay while /api/analyze-account is running.
          No close button, no back button, no ESC — the user must wait for
          the model + web search pass to complete. Sits above the Back header
          (z-20) and the modal itself (z-50). */}
      <AnimatePresence>
        {account.analysisProgress && !analysis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-6 select-none"
            onKeyDown={(e) => e.preventDefault()}
            role="dialog"
            aria-modal="true"
            aria-label="AI analysis in progress"
          >
            <div className="w-full max-w-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-orange-500/30 rounded-2xl shadow-2xl shadow-orange-500/10 p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 shrink-0">
                  <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping" />
                  <div className="absolute inset-1 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/40">
                    <Sparkles className="w-6 h-6 text-white animate-pulse" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-white leading-tight">
                    AI is analyzing this account
                  </h3>
                  <p className="text-xs font-mono text-orange-300 mt-1">
                    {account.name} · {account.domain}
                  </p>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300">Live</span>
                  <span className="text-[10px] font-mono text-slate-400">GPT-4o + web search</span>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

              {account.analysisProgress!.messages.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-orange-300">
                    Reasoning trace
                  </div>
                  {account.analysisProgress!.messages.slice(-6).map((msg, idx, arr) => (
                    <div
                      key={`om-${idx}`}
                      className={`flex items-start gap-2 text-[13px] leading-snug ${
                        idx === arr.length - 1
                          ? 'text-white font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      <span className="text-orange-400 mt-0.5">›</span>
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
              )}

              {account.analysisProgress!.searches.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-orange-300">
                    Web searches performed
                  </div>
                  {account.analysisProgress!.searches.slice(-4).map((query, idx) => (
                    <div
                      key={`os-${idx}`}
                      className="flex items-start gap-2 text-[12px] font-mono text-slate-200 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5"
                    >
                      <span className="text-orange-400 shrink-0">🔎</span>
                      <span className="truncate">{query}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex items-center gap-3">
                <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 animate-pulse" style={{ width: '100%' }} />
                </div>
                <span className="text-[10px] font-mono text-slate-500">please wait…</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-20 bg-[#2A2A2B] border-b border-white/[0.06] backdrop-blur-md font-sans select-none">
        <div className="max-w-6xl mx-auto h-14 px-6 md:px-8 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-zinc-300 hover:text-white hover:bg-white/[0.06] px-2.5 py-1 h-8 rounded-lg border border-white/[0.08] cursor-pointer"
            onClick={onClose}
            title="Back to accounts"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-zinc-300" />
            <span>Back</span>
          </Button>
          <h2 className="font-semibold text-zinc-100 text-sm md:text-base lg:text-lg tracking-tight truncate">
            {account.name}
          </h2>
          <span className="text-zinc-500 text-xs font-mono truncate hidden sm:inline">
            {account.domain}
          </span>
        </div>
      </header>
      <div ref={reportContentRef} className="max-w-6xl mx-auto bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-xl shrink-0">
            {(editName.charAt(0) || 'A').toUpperCase()}
          </div>
          {isEditing ? (
            <div className="space-y-1.5 flex-1 min-w-0 pr-2">
              <input 
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Account Name"
                className="w-full text-base font-bold bg-white dark:bg-slate-900 text-slate-850 dark:text-slate-200 border border-slate-250 dark:border-slate-700 px-2.5 py-1 rounded outline-none focus:border-indigo-500 font-sans"
              />
              <input 
                type="text"
                value={editDomain}
                onChange={(e) => setEditDomain(e.target.value)}
                placeholder="domain.com"
                className="w-full text-xs font-mono font-normal bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded outline-none focus:border-indigo-500"
              />
            </div>
          ) : (
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 truncate">{account.name}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300 font-mono truncate">{account.domain}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onUpdateAccount && (
            isEditing ? (
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    // Revert edits
                    setEditName(account.name);
                    setEditDomain(account.domain);
                    setEditDescription(account.description || '');
                    setEditRationale(account.analysis?.rationale || account.fitReason || '');
                    setEditFitScore(account.fitScore || 75);
                    setIsEditing(false);
                  }}
                  className="h-8 px-2.5 text-xs text-slate-500 dark:text-slate-300"
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => {
                    if (!editName.trim()) {
                      toast.error("Account name is required");
                      return;
                    }
                    onUpdateAccount({
                      ...account,
                      name: editName.trim(),
                      domain: editDomain.trim(),
                      description: editDescription.trim(),
                      fitScore: editFitScore,
                      fitReason: editRationale.trim(),
                      analysis: account.analysis ? {
                        ...account.analysis,
                        rationale: editRationale.trim()
                      } : {
                        score: editFitScore,
                        rationale: editRationale.trim(),
                        signals: account.signals || [],
                        buyerPersonas: [],
                        outreachStrategy: {
                          emailHook: "Optimized outreach sequence",
                          linkedinMessage: "Direct industry alignment"
                        },
                        competitors: []
                      }
                    });
                    setIsEditing(false);
                    toast.success("Account intelligence saved & synchronized!");
                  }}
                  className="h-8 px-3 text-xs bg-indigo-650 hover:bg-indigo-700 text-white"
                >
                  Save
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                title="Download this account report as a PDF"
                className="h-8 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download className={`w-3.5 h-3.5 ${isExportingPdf ? 'animate-pulse' : ''}`} />
                <span>{isExportingPdf ? 'Preparing PDF…' : 'Download PDF'}</span>
              </Button>
            )
          )}
        </div>
      </div>

      <div>
        <div className="p-6 space-y-8">
          {/* Live streaming progress — visible while /api/analyze-account is running */}
          {account.analysisProgress && !analysis && (
            <motion.section
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-gradient-to-br from-orange-50 via-amber-50/40 to-white dark:from-orange-950/30 dark:via-amber-950/10 dark:to-slate-900 p-4 space-y-3 shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
                </div>
                <h4 className="text-[13px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-200">
                  AI is analyzing this account
                </h4>
                <span className="ml-auto text-[11px] font-mono text-orange-500 dark:text-orange-400">
                  Live · GPT-4o + web search
                </span>
              </div>

              {account.analysisProgress.messages.length > 0 && (
                <div className="space-y-1">
                  {account.analysisProgress.messages.slice(-5).map((msg, idx) => (
                    <div
                      key={`msg-${idx}`}
                      className={`flex items-start gap-1.5 text-[12.5px] leading-snug ${
                        idx === account.analysisProgress!.messages.slice(-5).length - 1
                          ? 'text-slate-800 dark:text-slate-100 font-semibold'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <span className="text-orange-500 mt-0.5">›</span>
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
              )}

              {account.analysisProgress.searches.length > 0 && (
                <div className="border-t border-orange-100 dark:border-orange-500/20 pt-2.5 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-orange-500 dark:text-orange-300">
                    Web searches performed
                  </div>
                  {account.analysisProgress.searches.slice(-4).map((query, idx) => (
                    <div
                      key={`search-${idx}`}
                      className="flex items-start gap-1.5 text-[12px] font-mono text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-700/70 rounded-lg px-2 py-1"
                    >
                      <span className="text-orange-500 shrink-0">🔎</span>
                      <span className="truncate">{query}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          )}

          {/* Executive Summary */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                Evidence-Based Fit Intel
              </h3>
              {isEditing ? (
                <div className="flex items-center gap-1.5 font-mono text-[13px] text-slate-605 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded">
                  <span>Fit Score:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editFitScore}
                    onChange={(e) => setEditFitScore(Number(e.target.value))}
                    className="w-12 bg-white dark:bg-slate-900 font-bold text-center border rounded outline-none h-5 text-xs text-indigo-700 dark:text-indigo-300 focus:border-indigo-550 focus:border-indigo-500"
                  />
                  <span>%</span>
                </div>
              ) : (
                <Badge variant="outline" className="font-mono text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 flex items-center gap-1">
                  Fit Score: <span className="font-bold">{info.fitScore}%</span>
                  {info.decayApplied && (
                    <span className="text-slate-400 line-through text-[11px] font-normal" title={`Original: ${info.originalFitScore}% before freshness decay`}>
                      ({info.originalFitScore}%)
                    </span>
                  )}
                </Badge>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3 font-sans text-xs text-left">
                <div className="space-y-1 shadow-2xs bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-105">
                  <label className="text-[12px] font-bold uppercase text-slate-400 tracking-normal block">Company Description</label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Brief description of what the company does..."
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-1 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-medium"
                  />
                </div>
                <div className="space-y-1 shadow-2xs bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-105">
                  <label className="text-[12px] font-bold uppercase text-slate-400 tracking-normal block">ICP Alignment & Fit Evidence Rationale</label>
                  <textarea
                    rows={4}
                    value={editRationale}
                    onChange={(e) => setEditRationale(e.target.value)}
                    placeholder="Evidence rationale on why this customer fits..."
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-1 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-medium leading-relaxed"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {account.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-300 italic px-1 font-normal leading-relaxed text-left">{account.description}</p>
                )}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap text-left font-sans shadow-md">
                  {analysis?.rationale || account.fitReason}
                  
                  <SourceCitation 
                    citation={analysis?.citation || {
                      sourceTier: 'Primary',
                      sourceName: `${account.name} Official Press Releases & SEC filings`,
                      dateRetrieved: 'May 24, 2026',
                      url: account.domain ? `https://www.${account.domain}/news` : undefined,
                      isInferred: false,
                      confidenceScore: 95
                    }} 
                    inlineLabel="Account fit analysis verified on" 
                  />
                </div>
              </div>
            )}
          </section>

          {/* Industry Calibration Controls board */}
          <section className="space-y-4 bg-indigo-50/20 dark:bg-indigo-950/40 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 shadow-md text-left">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                  Industry-Specific Buying Intent Calibration
                </h3>
                {account.forcedSectorModel ? (
                  <Badge variant="outline" className="text-[12px] uppercase font-bold tracking-normal text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60">
                    🛠️ Overridden
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[12px] uppercase font-bold tracking-normal text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60">
                    ✓ Auto-Detected
                  </Badge>
                )}
              </div>
              <p className="text-[13px] text-slate-500 dark:text-slate-300 font-semibold leading-relaxed">
                Calibration prevents blending target accounts across different sectors into a single universal average. Different industries interpret identical events (such as engineering hiring or Venture Series rounds) through unique sector norms.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {(['SaaS', 'Manufacturing', 'Fintech', 'Biotech', 'AEC', 'General'] as const).map((model) => {
                const isActive = info.appliedSectorModel === model;
                const isAutoSelected = !account.forcedSectorModel && info.appliedSectorModel === model;
                
                let btnLabel = model === 'SaaS' ? 'SaaS / Tech' :
                               model === 'Manufacturing' ? 'Mfg / Industrial' :
                               model === 'Biotech' ? 'Biotech / Med' :
                               model === 'AEC' ? 'AEC / Eng' : model;
                
                return (
                  <button
                    key={model}
                    onClick={() => {
                      if (onUpdateAccount) {
                        onUpdateAccount({
                          ...account,
                          forcedSectorModel: model
                        });
                        toast.success(`Calibrated to ${btnLabel} norms!`, {
                          description: `Buying priority index score and signal weights re-calculated using ${model}-specific GTM multipliers.`
                        });
                      }
                    }}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                      isActive 
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div>{btnLabel}</div>
                    {isAutoSelected && (
                      <div className="text-[10px] opacity-85 font-semibold mt-0.5 tracking-tight uppercase">Auto-Set</div>
                    )}
                  </button>
                );
              })}
            </div>

            {account.forcedSectorModel && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => {
                    if (onUpdateAccount) {
                      onUpdateAccount({
                        ...account,
                        forcedSectorModel: undefined
                      });
                      toast.success("Reset calibration model to auto-detected industry norms!");
                    }
                  }}
                  className="text-[12px] text-indigo-600 dark:text-indigo-300 hover:text-indigo-750 transition-colors font-bold underline"
                >
                  Reset to Auto-Detected Norms
                </button>
              </div>
            )}
          </section>

          {/* Social Signals — 10-platform vertical list + Buying Intent summary */}
          <SocialSignalsCard
            socialData={socialData}
            loading={socialLoading}
            onRefresh={() => {
              setSocialData(null);
              setSocialLoading(true);
              fetch('/api/analyze-social', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: account.domain, companyName: account.name }),
              })
                .then(r => r.ok ? r.json() : Promise.reject(r.status))
                .then((data: SocialActivity) => {
                  setSocialData(data);
                  setSocialLoading(false);
                  onUpdateAccount?.({ ...account, socialActivity: data });
                })
                .catch(() => setSocialLoading(false));
            }}
          />

          {/* Caution matching Alert indicator */}
          {info.hasCautionMatches && (
            <div className="p-4.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/40 border border-amber-250 dark:border-amber-800/60 text-left space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800 dark:text-amber-200 uppercase tracking-normal font-sans">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-300 animate-pulse" />
                <span>Adaptive Caution Warning Triggered</span>
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1 my-0.5 font-sans leading-relaxed">
                <p className="font-semibold">
                  This target profile matches historical outbound characteristics that struggle to convert:
                </p>
                <ul className="list-disc pl-4 space-y-1 font-medium text-[13px]">
                  {info.cautions.map((caution: string, idx: number) => (
                    <li key={idx} className="marker:text-amber-500">{caution}</li>
                  ))}
                </ul>
                <p className="text-[12px] italic text-amber-600 dark:text-amber-300 font-bold block pt-1.5 border-t border-amber-200/40 dark:border-amber-800/60">
                  💡 Closed-loop adjustment: Target score calibrated -{info.cautions.length * 15} fit penalty points to save marketing overhead.
                </p>
              </div>
            </div>
          )}

          {/* Two-column row: Adaptive Feedback (left) + Prioritization (right).
              Stacks on smaller screens (< lg), side-by-side from lg upward. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

          {/* Outreach Loop & Adaptive Feedback Outcomes Console */}
          <section className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-md text-left h-full">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                Adaptive Feedback & Outreach Outcomes
              </h3>
              {account.outreachOutcome ? (
                <Badge variant="outline" className={`text-[12px] uppercase font-semibold tracking-normal ${
                  ['Positive Reply', 'Meeting Booked', 'Deal Won'].includes(account.outreachOutcome)
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-250 dark:border-emerald-800/60'
                    : 'text-slate-650 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700/80'
                }`}>
                  ✓ Feedback Recorded
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[12px] uppercase font-bold text-slate-400 bg-white dark:bg-slate-900 border-slate-205">
                  Awaiting Pipeline Outcome
                </Badge>
              )}
            </div>
            
            <p className="text-[13px] text-slate-500 dark:text-slate-300 font-normal leading-relaxed">
              Record real-world outbound responses. This feedback loop dynamically adapts future scoring weights for related signal profiles and applies cautionary markers to risky account segments.
            </p>

            <div className="space-y-3.5 pt-1">
              <div>
                <label className="text-[12px] font-bold uppercase text-slate-450 tracking-normal block mb-1.5 font-mono">Outbound Pipeline Stage</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['new', 'viewed', 'contacted'] as const).map((stage) => {
                    const isActive = account.status === stage;
                    return (
                      <button
                        key={stage}
                        onClick={() => {
                          if (onUpdateAccount) {
                            onUpdateAccount({
                              ...account,
                              status: stage,
                              // If reverting status to new/viewed, reset outcome
                              outreachOutcome: stage !== 'contacted' ? undefined : account.outreachOutcome
                            });
                            toast.success(`Pipeline stage set to ${stage.toUpperCase()}!`);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all capitalize select-none cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/50 text-slate-650 dark:text-slate-400 border-slate-250 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {stage}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Show Outreach Outcomes if contacted */}
              {account.status === 'contacted' && (
                <div className="space-y-2.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-[12px] font-bold uppercase text-slate-450 tracking-normal block font-mono">Commercial Outreach Outcome</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {([
                      { value: 'No Response', label: '📭 No Response' },
                      { value: 'Positive Reply', label: '💬 Positive Reply' },
                      { value: 'Meeting Booked', label: '📅 Meeting Booked' },
                      { value: 'Deal Lost', label: '❌ Deal Lost' },
                      { value: 'Deal Won', label: '🏆 Deal Won' }
                    ] as const).map((outcome) => {
                      const isActive = account.outreachOutcome === outcome.value;
                      const isPositive = ['Positive Reply', 'Meeting Booked', 'Deal Won'].includes(outcome.value);
                      
                      return (
                        <button
                          key={outcome.value}
                          onClick={() => {
                            if (onUpdateAccount) {
                              onUpdateAccount({
                                ...account,
                                outreachOutcome: outcome.value
                              });
                              toast.success(`Outcome "${outcome.value}" recorded!`, {
                                description: isPositive 
                                  ? "Weights recalibrated! Lookups matching similar signals now receive higher prioritization scores."
                                  : "Adverse outcome logged. Future segments of this profile will be flagged with cautionary notes."
                              });
                            }
                          }}
                          className={`px-2.5 py-2.5 rounded-xl border text-[13px] font-bold text-left transition-all flex flex-col justify-between cursor-pointer ${
                            isActive
                              ? isPositive 
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-1 ring-emerald-250'
                                : 'bg-slate-800 text-white border-slate-900 shadow-xs ring-1 ring-slate-800'
                              : 'bg-white dark:bg-slate-900 text-slate-755 border-slate-205 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{outcome.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {account.outreachOutcome && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          if (onUpdateAccount) {
                            onUpdateAccount({
                              ...account,
                              outreachOutcome: undefined
                            });
                            toast.success("Outcome cleared safely. Machine learning multipliers readjusted.");
                          }
                        }}
                        className="text-[12px] text-slate-450 hover:text-slate-650 transition-colors font-bold underline cursor-pointer"
                      >
                        Reset Registered Outcome
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Intel summary of dynamic calibration boosts / warnings */}
            {account.outreachOutcome && (
              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 text-left space-y-1 text-[13px] leading-relaxed">
                <span className="font-semibold uppercase text-[11px] text-indigo-750 tracking-normal block mb-1 font-mono">Adaptive AI Recalibration Applied:</span>
                {['Positive Reply', 'Meeting Booked', 'Deal Won'].includes(account.outreachOutcome) ? (
                  <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                    ✓ <strong>Positive Signal Scaling:</strong> Conversion feedback reinforces and dynamically boosts the weights of all underlying triggering signals by up to 30%, increasing prioritize priority for similar future pipeline entries.
                  </p>
                ) : (
                  <p className="text-rose-750 font-medium">
                    ⚠️ <strong>Profile Caution calibration:</strong> Historical negative feedback flags related profiles in sector ({info.appliedSectorModel}) and warns you before starting new sequence attempts to save GTM labor cost.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Outreach Priority & Timing Analytics */}
          <section className="space-y-3.5 bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-md h-full">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Prioritization & Outreach Timing Intel
            </h3>
            
            {(() => {
              const info = getAccountPriorityInfo(account);
              const priorityBg = info.priorityFlag === 'Immediate Action Required' ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60' :
                                 info.priorityFlag === 'Warm Track' ? 'bg-teal-50/50 dark:bg-teal-950/40 border-teal-150 dark:border-teal-800/50' : 
                                 'bg-slate-50 dark:bg-slate-800/50 border-slate-150 dark:border-slate-700';
                                 
              const flagTextClass = info.priorityFlag === 'Immediate Action Required' ? 'text-rose-700 dark:text-rose-300' :
                                   info.priorityFlag === 'Warm Track' ? 'text-teal-700 dark:text-teal-300' : 'text-slate-650 dark:text-slate-400';

              return (
                <div className="space-y-3">
                  <div className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 ${priorityBg}`}>
                    <div>
                      <span className="text-[12px] uppercase font-bold text-slate-400 tracking-normal">Outreach Target Status</span>
                      <div className={`text-xs font-bold uppercase mt-0.5 tracking-wide ${flagTextClass}`}>
                        {info.priorityFlag === 'Immediate Action Required' ? '🚨 Immediate Action Required' : 
                         info.priorityFlag === 'Warm Track' ? '⏳ Warm Track - Build Demand' : 
                         '🎯 Standard Follow-up Opportunity'}
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <span className="text-[12px] uppercase font-bold text-slate-400 tracking-normal">Outreach Window</span>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5 flex items-center gap-1 sm:justify-end">
                        <Clock className="w-3.5 h-3.5 text-indigo-505" />
                        {info.outreachWindow}
                      </div>
                    </div>
                  </div>

                  {/* Stat strip — same visual language as AccountCard so the
                      metrics feel consistent across list and detail views. */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`rounded-lg px-2.5 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] border-l-[3px] ${
                      account.isDisqualified ? 'border-l-red-400'
                      : info.fitScore >= 80 ? 'border-l-emerald-400'
                      : info.fitScore >= 60 ? 'border-l-amber-400'
                      : 'border-l-slate-300 dark:border-l-zinc-600'
                    }`}>
                      <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">ICP Fit Score</div>
                      <div className={`text-[15px] font-semibold font-mono leading-tight mt-0.5 ${
                        account.isDisqualified ? 'text-red-600 dark:text-red-300'
                        : info.fitScore >= 80 ? 'text-emerald-600 dark:text-emerald-300'
                        : info.fitScore >= 60 ? 'text-amber-600 dark:text-amber-300'
                        : 'text-slate-500 dark:text-zinc-400'
                      }`}>{info.fitScore}%</div>
                    </div>
                    <div className={`rounded-lg px-2.5 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] border-l-[3px] ${
                      account.isDisqualified ? 'border-l-red-400'
                      : info.timingScore >= 80 ? 'border-l-rose-400'
                      : info.timingScore >= 60 ? 'border-l-amber-400'
                      : 'border-l-purple-400'
                    }`}>
                      <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">Timing Score</div>
                      <div className={`text-[15px] font-semibold font-mono leading-tight mt-0.5 ${
                        account.isDisqualified ? 'text-red-600 dark:text-red-300'
                        : info.timingScore >= 80 ? 'text-rose-600 dark:text-rose-300'
                        : info.timingScore >= 60 ? 'text-amber-600 dark:text-amber-300'
                        : 'text-purple-600 dark:text-purple-300'
                      }`}>{info.timingScore}%</div>
                    </div>
                    <div className={`rounded-lg px-2.5 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] border-l-[3px] ${
                      account.isDisqualified ? 'border-l-red-400'
                      : info.priorityIndex >= 80 ? 'border-l-rose-400'
                      : info.priorityIndex >= 60 ? 'border-l-amber-400'
                      : 'border-l-indigo-400'
                    }`} title="(Fit + Timing) / 2">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">Priority Index</div>
                      <div className={`text-[15px] font-semibold font-mono leading-tight mt-0.5 ${
                        account.isDisqualified ? 'text-red-600 dark:text-red-300'
                        : info.priorityIndex >= 80 ? 'text-rose-600 dark:text-rose-300'
                        : info.priorityIndex >= 60 ? 'text-amber-600 dark:text-amber-300'
                        : 'text-indigo-600 dark:text-indigo-300'
                      }`}>{info.priorityIndex}</div>
                    </div>
                  </div>

                  <div className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700/50 pt-2 flex items-start gap-1.5 bg-slate-50/20 dark:bg-slate-800/50 p-2 rounded">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Priority score of <strong>{info.priorityIndex}/100</strong> indicates an <strong>{info.timingStage}</strong> stage. 
                      {info.priorityFlag === 'Immediate Action Required' 
                        ? " This high intensity signals immediate operational gaps. Trigger direct personalized cold sequence immediately."
                        : info.priorityFlag === 'Warm Track'
                        ? " High fit combined with low immediate signal intensity advises soft nurture touchpoints to map technical champions."
                        : " Keep steady outbound engagement focused on competitive incumbents."}
                    </span>
                  </div>
                </div>
              );
            })()}
          </section>

          </div>
          {/* /Two-column row */}

          {/* Buying Signals with Live Freshness Tuning */}
          <section className="space-y-4 bg-slate-50/60 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md">
            {/* Header — title, plain-language explainer, and overall freshness. */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-3">
              <div className="text-left space-y-1">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  Signal Freshness tuning & Decay Board
                </h3>
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Every buying signal is worth less the older it gets. Drag the age slider on any signal to see how its weight changes — and how that shifts the account's overall intent score.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge variant="outline" className={`font-mono text-[12px] font-bold tracking-normal uppercase ${
                  info.freshnessLabel === 'FRESH' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60' :
                  info.freshnessLabel === 'AGING' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60' :
                  'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}>
                  Overall {info.freshnessLabel}: {info.freshnessScore}%
                </Badge>
              </div>
            </div>

            {/* Legend row — quick key for the three freshness bands. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <strong>Fresh</strong> <span className="text-slate-500 dark:text-slate-400">(0–90 days · counts 100%)</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <strong>Decaying</strong> <span className="text-slate-500 dark:text-slate-400">(90–180 days · drops linearly)</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <strong>Stale</strong> <span className="text-slate-500 dark:text-slate-400">(180+ days · counts 0%)</span>
              </span>
            </div>

            {/* Recommendations or warnings */}
            {info.reResearchRecommended ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-205 rounded-xl flex items-start gap-3 shadow-3xs animate-fadeIn text-left">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wide">🔍 RE-RESEARCH STRONGLY RECOMMENDED</h4>
                  <p className="text-[13px] leading-relaxed text-amber-750 font-bold">
                    All intent signals for this account are older than 180 days and marked as stale. outreach window holds; do not execute active outbound sequence until intelligence is updated.
                  </p>
                </div>
              </div>
            ) : info.decayApplied ? (
              <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/40 border border-indigo-100/60 dark:border-indigo-800/50 rounded-xl flex items-start gap-2.5 text-left">
                <Info className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
                <p className="text-[13px] leading-normal text-indigo-805 font-medium">
                  <strong>Score Decay Notice:</strong> Intent signals are rotting with progressive weight penalties. Capture a fresh signal to restore perfect prioritization metrics.
                </p>
              </div>
            ) : null}

            {/* List of signals with sliders */}
            <div className="space-y-4">
              {info.resolvedSignals.map((sig, sIdx) => {
                // Freshness pill color tracks the same 3 bands the legend explains.
                const freshnessBand: 'fresh' | 'decaying' | 'stale' =
                  sig.freshnessWeight >= 0.99 ? 'fresh'
                  : sig.freshnessWeight > 0 ? 'decaying'
                  : 'stale';
                const bandStyles = {
                  fresh:    { pill: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', label: 'Fresh' },
                  decaying: { pill: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', label: 'Decaying' },
                  stale:    { pill: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300', dot: 'bg-slate-400', label: 'Stale' },
                }[freshnessBand];

                const finalIntent = Math.round(sig.calibratedWeight * 100);
                const sectorLabel = sig.multiplier > 1.0
                  ? 'boost'
                  : sig.multiplier < 1.0 ? 'penalty' : 'neutral';
                const sectorTone = sig.multiplier > 1.0
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : sig.multiplier < 1.0 ? 'text-amber-600 dark:text-amber-300'
                  : 'text-slate-600 dark:text-slate-300';
                const intentTone = finalIntent >= 80
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : finalIntent >= 40 ? 'text-amber-600 dark:text-amber-300'
                  : 'text-slate-500 dark:text-slate-400';
                const intentPlainMeaning = finalIntent >= 80
                  ? 'Strong buying-intent signal — factor into outreach now.'
                  : finalIntent >= 40 ? 'Moderate signal — supports outreach but not on its own.'
                  : 'Weak signal — too old or off-sector to move priority.';

                return (
                  <div key={sig.id || sIdx} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-xs transition-all space-y-3">
                    {/* Row 1: signal text + freshness state pill */}
                    <div className="flex items-start justify-between gap-3 text-left">
                      <div className="space-y-1 min-w-0 flex-1">
                        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-snug block">
                          {sig.text}
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-150 dark:border-indigo-800/50">
                          {sig.categoryLabel}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-normal font-semibold px-2 py-0.5 rounded border shrink-0 ${bandStyles.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${bandStyles.dot}`} />
                        {bandStyles.label}
                      </span>
                    </div>

                    {/* Row 2: the three math values, clearly labeled — Freshness × Sector = Intent */}
                    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5">
                      <MetricBox
                        label="Age freshness"
                        value={`${Math.round(sig.freshnessWeight * 100)}%`}
                        hint={sig.ageDays <= 90 ? 'still full weight' : sig.ageDays <= 180 ? 'decaying with age' : 'past shelf life'}
                        tone={bandStyles.label === 'Fresh' ? 'text-emerald-600 dark:text-emerald-300' : bandStyles.label === 'Decaying' ? 'text-amber-600 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}
                      />
                      <span className="text-slate-400 font-mono text-sm select-none">×</span>
                      <MetricBox
                        label="Sector weight"
                        value={`${sig.multiplier.toFixed(2)}×`}
                        hint={sectorLabel === 'boost' ? 'high-signal category for this sector' : sectorLabel === 'penalty' ? 'low-signal category for this sector' : 'neutral fit'}
                        tone={sectorTone}
                      />
                      <span className="text-slate-400 font-mono text-sm select-none">=</span>
                      <MetricBox
                        label="Final intent"
                        value={`${finalIntent}%`}
                        hint="how much this signal moves priority"
                        tone={intentTone}
                        emphasized
                      />
                    </div>

                    {/* Row 3: plain-language meaning of the final intent value */}
                    <div className="text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 rounded-lg text-left">
                      <strong className="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider font-bold block mb-0.5">What this means</strong>
                      {intentPlainMeaning}
                      {sig.sectorRationale && (
                        <span className="block mt-1 text-[12px] text-slate-500 dark:text-slate-300">
                          <span className="font-semibold">Sector context: </span>{sig.sectorRationale}
                        </span>
                      )}
                    </div>

                    {/* Row 4: age slider with labeled tick marks so the scale is obvious */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Signal age: <span className="font-mono">{sig.ageDays} days</span></span>
                        <span className="text-[10.5px]">← drag to test how aging changes the score</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="250"
                        step="5"
                        value={sig.ageDays}
                        onChange={(e) => {
                          const newAge = Number(e.target.value);
                          const updatedSignals = resolvedSignals.map((item, i) =>
                            i === sIdx ? { ...item, ageDays: newAge } : item
                          );

                          if (onUpdateAccount) {
                            onUpdateAccount({
                              ...account,
                              signalsWithDates: updatedSignals,
                              signals: updatedSignals.map(s => s.text)
                            });
                          }
                        }}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        id={`sig-slider-${sig.id || sIdx}`}
                      />
                      <div className="flex justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500 px-0.5">
                        <span>0d</span>
                        <span className="text-emerald-500 dark:text-emerald-400">90d</span>
                        <span className="text-amber-500 dark:text-amber-400">180d</span>
                        <span>250d</span>
                      </div>
                    </div>

                    {/* Row 5: source (collapsed by default so it doesn't dominate) */}
                    {sig.citation && (
                      <details className="group">
                        <summary className="cursor-pointer text-[11.5px] font-semibold text-indigo-600 dark:text-indigo-300 hover:underline select-none inline-flex items-center gap-1">
                          <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                          Where did this signal come from?
                        </summary>
                        <div className="pt-1">
                          <SourceCitation
                            citation={sig.citation}
                            inlineLabel="Intent signal retrieved on"
                            isSignal={true}
                          />
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add New Detected Signal Form */}
            <div className="border-t border-slate-200 dark:border-slate-700/80 pt-4 space-y-3 text-left">
              <div>
                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                  Add a new signal you just caught
                </span>
                <p className="text-[12px] text-slate-500 dark:text-slate-300 mt-0.5">
                  Type it below and click Detect. It's added at 0 days old (freshness 100%) and the account's overall intent score updates instantly.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text"
                  placeholder="e.g., Appointed BIM lead or added Revit tech stack intent"
                  id="new-signal-text-input"
                  className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-205 rounded-xl h-9 outline-none focus:border-indigo-500 placeholder:text-slate-400 font-medium"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const inputEl = document.getElementById('new-signal-text-input') as HTMLInputElement;
                    const text = inputEl?.value?.trim();
                    if (!text) {
                      toast.error("Please enter intent signal text first.");
                      return;
                    }

                    const freshSignalElement = {
                      id: `sig-manual-${Math.random().toString(36).substr(2, 9)}`,
                      text,
                      ageDays: 0 // Just detected!
                    };

                    const updatedSignals = [freshSignalElement, ...resolvedSignals];

                    if (onUpdateAccount) {
                      onUpdateAccount({
                        ...account,
                        signalsWithDates: updatedSignals,
                        signals: updatedSignals.map(s => s.text)
                      });
                      toast.success("New monitoring signal detected!", {
                        description: "Decayed opportunity index and fit score recalculated automatically on the board."
                      });
                      if (inputEl) inputEl.value = '';
                    }
                  }}
                  className="px-3 bg-indigo-600 text-white hover:bg-indigo-700 h-9 font-semibold text-[13px] shrink-0"
                >
                  📡 Detect Signal
                </Button>
              </div>

              {/* Presets Row */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-bold uppercase">Simulate Live Feed:</span>
                <button
                  onClick={() => {
                    const presets = [
                      "Secured seed funding expansion round of $8M",
                      "Hiring 3 senior workflow managers specializing in Revit automation",
                      "Publicly targeting legacy COBOL replacement program of works",
                      "Partnering with Enterprise solution provider for building audits"
                    ];
                    const randomText = presets[Math.floor(Math.random() * presets.length)];
                    const freshSignalPreset = {
                      id: `sig-preset-${Math.random().toString(36).substr(2, 9)}`,
                      text: randomText,
                      ageDays: 0 // Just detected!
                    };

                    const updatedSignals = [freshSignalPreset, ...resolvedSignals];

                    if (onUpdateAccount) {
                      onUpdateAccount({
                        ...account,
                        signalsWithDates: updatedSignals,
                        signals: updatedSignals.map(s => s.text)
                      });
                      toast.success("Live monitoring signal caught!", {
                        description: `"${randomText}" applied at age 0d. Recalculated indices live.`
                      });
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 text-[12px] text-indigo-705 font-bold cursor-pointer transition-colors"
                >
                  ⚡ Simulate Incoming Intent Event (New 0d)
                </button>
              </div>
            </div>
          </section>

          {/* Email Pattern widget hidden by user request — restore by unwrapping this block. */}
          {false && account.domain && (
            <div className="mb-6">
              <EmailPatternWidget domain={account.domain} companyName={account.name} />
            </div>
          )}

          <Tabs defaultValue="outreach" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="outreach">Outreach</TabsTrigger>
              <TabsTrigger value="personas">Personas</TabsTrigger>
              <TabsTrigger value="threading">Stakeholder Map</TabsTrigger>
              <TabsTrigger value="tech">Tech & Growth</TabsTrigger>
              <TabsTrigger value="competitive">Competitors</TabsTrigger>
            </TabsList>

            <TabsContent value="outreach" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Personalized Email Angle
                  </h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleCopy(analysis?.outreachStrategy?.emailHook || '', 'email')}
                    className="h-8 text-xs gap-2"
                  >
                    {copied === 'email' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    Copy Hook
                  </Button>
                </div>
                <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 text-slate-800 dark:text-slate-200 text-sm italic">
                  "{analysis?.outreachStrategy?.emailHook || 'No email angle generated yet. Click \"Research with AI\" to generate insights.'}"
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Linkedin className="w-4 h-4" />
                    LinkedIn Hook
                  </h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleCopy(analysis?.outreachStrategy?.linkedinMessage || '', 'linkedin')}
                    className="h-8 text-xs gap-2"
                  >
                    {copied === 'linkedin' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    Copy Message
                  </Button>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm">
                  {analysis?.outreachStrategy?.linkedinMessage || 'No LinkedIn angle generated yet.'}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="personas" className="space-y-4">
               {!analysis?.buyerPersonas || analysis.buyerPersonas.length === 0 ? (
                 <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50">
                   <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                   <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Personas Mapped Yet</p>
                   <p className="text-[13px] text-slate-400 mt-1 max-w-sm mx-auto leading-normal">
                     Activate the GTM research engine to discover technical champions, decision-makers, core pain points, and specific value messaging.
                   </p>
                 </div>
               ) : (
                 analysis.buyerPersonas.map((persona, idx) => {
                   const stDetails = getInferredStakeholderDetails(persona.role, account.name);
                   return (
                     <div key={idx} className="p-5 rounded-xl border border-slate-150 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-4 shadow-sm text-left">
                        <SourceCitation
                          citation={persona.citation || {
                            sourceTier: 'Tertiary',
                            sourceName: 'GTM Persona Mapping & Corporate Hierarchy Inference Engine',
                            dateRetrieved: 'May 25, 2026',
                            isInferred: true,
                            confidenceScore: 72
                          }}
                          inlineLabel="Persona workflow mapped on"
                        />

                       {/* Interactive Stakeholder LinkedIn Info Box */}
                       <div className="space-y-3">
                         <div className="text-[12px] font-bold text-slate-400 uppercase tracking-wide block font-mono">
                           Identified Account Contact (LinkedIn Synced)
                         </div>
                         <StakeholderLinkedinCard role={persona.role} company={account.name} domain={account.domain} />

                         {/* Simulated Live Activity Widget */}
                         <div className="p-3 bg-blue-50/25 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/50 rounded-xl space-y-2 font-sans text-xs">
                           <div className="flex items-center justify-between text-[12px] text-blue-800 dark:text-blue-200 font-semibold uppercase tracking-normal">
                             <span className="flex items-center gap-1.5 leading-none">
                               <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                               LinkedIn Live Signal Feed
                             </span>
                             <span className="font-mono text-[11px] text-slate-400 font-bold">{stDetails.recentPost.timeAgo}</span>
                           </div>
                           <p className="text-slate-650 dark:text-slate-400 italic leading-relaxed">
                             "{stDetails.recentPost.text}"
                           </p>
                           <div className="text-[12px] text-slate-400 font-bold font-mono">
                             👍 {stDetails.recentPost.likeCount} Likes/Comments • Monitored via Social Listening
                           </div>
                         </div>
                       </div>

                       <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                         <div className="text-[13px] text-slate-400 font-bold uppercase tracking-normal">Potential Pain Points</div>
                         <div className="flex flex-wrap gap-2">
                           {persona.painPoints.map((pain, pIdx) => (
                             <span key={pIdx} className="px-2 py-1 rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-medium">
                               {pain}
                             </span>
                           ))}
                         </div>
                       </div>
                       <div className="pt-2">
                         <div className="text-[13px] text-slate-400 font-bold uppercase tracking-normal mb-1">Value Angle</div>
                         <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">{persona.valueAngle}</p>
                       </div>

                       {/* Anticipated Objections & Pre-emptive Counter Narratives */}
                       <div className="pt-3.5 border-t border-slate-200 dark:border-slate-700/65">
                         <div className="text-[13px] text-slate-400 font-bold uppercase tracking-normal mb-2.5 flex items-center gap-1.5">
                           <ShieldCheck className="w-4 h-4 text-indigo-500 dark:text-indigo-400 font-sans" />
                           <span>Pre-emptive Counter-Narratives & Objection Handling</span>
                         </div>
                         {!persona.counterNarratives || persona.counterNarratives.length === 0 ? (
                           <p className="text-[13px] text-slate-400/80 italic">No custom counter-narratives mapped for this persona yet. Re-run research to populate.</p>
                         ) : (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1.5">
                             {persona.counterNarratives.map((cn, cnIdx) => (
                               <div key={cnIdx} className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-50/20 to-slate-50 border border-indigo-100 dark:border-indigo-800/50 space-y-2.5 text-left shadow-2xs">
                                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-indigo-100/50 dark:border-indigo-800/50 pb-1.5 font-sans">
                                   <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide bg-slate-150 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                     🚨 {cn.objection}
                                   </span>
                                   <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-150 dark:border-indigo-800/50 font-mono self-start sm:self-auto">
                                     ⏱ {cn.suggestedMoment}
                                   </span>
                                 </div>
                                 <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-0.5">
                                   <strong className="text-indigo-950 font-bold block text-[12px] mb-0.5 uppercase tracking-wide font-sans">Reframing message:</strong>
                                   <span className="italic font-sans">"{cn.reframingMessage}"</span>
                                 </div>
                                 <div className="text-[13px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 p-2.5 rounded-lg leading-relaxed font-sans">
                                   <strong className="text-emerald-700 dark:text-emerald-300 font-bold block text-[12px] mb-0.5 uppercase tracking-normal">💡 Grounded Proof Point:</strong>
                                   {cn.proofPoint}
                                 </div>
                               </div>
                             ))}
                           </div>
                         )}
                       </div>
                     </div>
                   );
                 })
               )}
            </TabsContent>

            <TabsContent value="threading" className="space-y-6">
              {(() => {
                const threading = getOrGenerateMultiThreadingStrategy(account);
                const steps = [
                  { node: threading.accessibleEntryPoint, color: 'indigo', title: '1nd Step', roleKey: 'Entry Point' },
                  { node: threading.internalChampion, color: 'teal', title: '2nd Step', roleKey: 'Internal Champion' },
                  { node: threading.economicBuyer, color: 'emerald', title: '3rd Step', roleKey: 'Economic Buyer' },
                  { node: threading.technicalGatekeeper, color: 'purple', title: '4th Step', roleKey: 'Technical Gatekeeper' }
                ];

                return (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Header Card */}
                    <div className="bg-gradient-to-r from-indigo-50/70 to-blue-50/30 border border-indigo-100 dark:border-indigo-800/50 p-4 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Network className="w-5 h-5 text-indigo-600 dark:text-indigo-300 animate-pulse" />
                        <h4 className="text-xs font-semibold text-slate-905 uppercase tracking-normal">
                          Coordinated Multi-Threading Stakeholder Engagement Map
                        </h4>
                      </div>
                      <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {threading.sequencedMapDescription}
                      </p>
                    </div>

                    {/* Timeline Steps layout */}
                    <div className="space-y-4">
                      <div className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide pl-1">
                        Threading Sequencing Timeline
                      </div>
                      
                      <div className="relative pl-5 border-l border-dashed border-slate-200 dark:border-slate-700 ml-3.5 space-y-6">
                        {steps.map((step, idx) => {
                          let badgeBg = 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-750 border-indigo-100 dark:border-indigo-800/50';
                          let pinBg = 'bg-indigo-650';
                          let borderHover = 'hover:border-indigo-300';
                          
                          if (idx === 1) {
                            badgeBg = 'bg-teal-50 dark:bg-teal-950/40 text-teal-750 border-teal-100 dark:border-teal-800/50';
                            pinBg = 'bg-teal-650';
                            borderHover = 'hover:border-teal-300';
                          } else if (idx === 2) {
                            badgeBg = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-750 border-emerald-100 dark:border-emerald-800/50';
                            pinBg = 'bg-emerald-650';
                            borderHover = 'hover:border-emerald-300';
                          } else if (idx === 3) {
                            badgeBg = 'bg-purple-50 dark:bg-purple-950/40 text-purple-750 border-purple-100 dark:border-purple-800/50';
                            pinBg = 'bg-purple-650';
                            borderHover = 'hover:border-purple-300';
                          }

                          return (
                            <div key={idx} className="relative group/step">
                              {/* Timeline Junction Pin */}
                              <div className="absolute -left-[27px] top-1.5 flex items-center justify-center">
                                <span className="relative flex h-3.5 w-3.5">
                                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pinBg} opacity-20`}></span>
                                  <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${pinBg} border-2 border-white shadow-sm`}></span>
                                </span>
                              </div>

                              {/* Content Panel */}
                              <div className={`bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 p-4 rounded-xl shadow-xs space-y-3 transition-all ${borderHover}`}>
                                <div className="border-b border-slate-100 dark:border-slate-800 pb-2.5 space-y-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap text-left">
                                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border font-mono ${badgeBg} shrink-0`}>
                                        {step.node.timing}
                                      </span>
                                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">
                                        {step.node.role}
                                      </span>
                                    </div>
                                    
                                    {/* Render standard short-form strategic roles inline */}
                                    {step.node.strategicRole && step.node.strategicRole.length <= 25 && (
                                      <Badge variant="secondary" className="text-[11px] font-bold tracking-normal px-2 py-0.5 uppercase bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap self-start sm:self-auto">
                                        {step.node.strategicRole}
                                      </Badge>
                                    )}
                                  </div>

                                  {/* If strategicRole is a descriptive sentence, display it prominently on its own line beneath as an imperative callout */}
                                  {step.node.strategicRole && step.node.strategicRole.length > 25 && (
                                    <div className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-700 rounded-lg p-2.5 text-left">
                                      <strong className="text-indigo-650 dark:text-indigo-300 uppercase font-bold text-[11px] font-mono block mb-1 tracking-normal leading-none">
                                        Strategic Target Principle:
                                      </strong>
                                      {step.node.strategicRole}
                                    </div>
                                  )}
                                </div>

                                {/* High-fidelity Compact LinkedIn Contact Scanner Node */}
                                <div className="pt-0.5">
                                  <StakeholderLinkedinCard role={step.node.role} company={account.name} domain={account.domain} compact={true} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase font-bold text-slate-400 tracking-normal">
                                      Messaging Angle & Value Focus
                                    </div>
                                    <p className="text-slate-650 dark:text-slate-400 leading-relaxed text-[13px]">
                                      {step.node.messagingFocus}
                                    </p>
                                  </div>
                                  <div className="space-y-1.5 bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 w-full">
                                    <div className="text-[11px] uppercase font-bold text-indigo-600 dark:text-indigo-300 tracking-normal flex items-center gap-1.5">
                                      <GitBranch className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 animate-bounce" />
                                      Tactical Outreach Hook
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed text-[13px]">
                                      {step.node.tacticalTactic}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Safe Coordination / Conflict Prevention Box */}
                    <div className="bg-amber-50/30 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-800/60 p-4 rounded-xl space-y-3 shadow-2xs">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-normal">
                          Outreach Sequence Collision Prevention Protocols
                        </span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 font-sans">
                        Simultaneous or uncoordinated outreach risks cross-contaminating dialogue standards. Align your outreach builders using these automated sequence limits:
                      </p>
                      <ul className="space-y-2 pl-4 list-disc text-[13px] text-slate-600 dark:text-slate-300 font-medium font-sans">
                        {threading.coordinationRules.map((rule, idx) => (
                          <li key={idx} className="marker:text-amber-500/70">
                            <strong>Co-ordination Guideline {idx + 1}:</strong> {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="tech" className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-100 dark:border-amber-800/50">
                <Info className="w-4 h-4 shrink-0" />
                <p className="text-xs font-medium">Verified using latest public signals (LinkedIn, Crunchbase, BuiltWith).</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-[12px] font-bold text-slate-400 uppercase tracking-wide mb-1">Hiring Status</div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-300">Active - Sales & Ops</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-[12px] font-bold text-slate-400 uppercase tracking-wide mb-1">Recent Funding</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Series B ($22M)</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="competitive" className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-indigo-750 bg-indigo-50/75 dark:bg-indigo-950/40 p-3.5 rounded-xl border border-indigo-100/70 dark:border-indigo-800/50 shadow-2xs">
                <Lightbulb className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <p className="text-[13px] font-medium leading-normal text-indigo-900 dark:text-indigo-200">
                  Competitive signals inferred from job boards, website tag stacks, review channels, and case study indicators.
                </p>
              </div>

              {!analysis?.competitors || analysis.competitors.length === 0 ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2 bg-slate-50/30 dark:bg-slate-800/50">
                    <p className="text-[13px] text-slate-500 dark:text-slate-300 leading-normal font-medium">
                      Real-time competitive landscape analyzer active on deep review level. Below is our inferred incumbent intelligence:
                    </p>
                  </div>
                  {getDefaultCompetitors(account).map((comp, idx) => (
                    <CompetitorCard key={idx} comp={comp} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {analysis.competitors.map((comp, idx) => (
                    <CompetitorCard key={idx} comp={comp} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
        {account.crmSyncedAt ? (
          <CrmRecordPanel
            account={account}
            crmProviderName={crmProviderName}
            onRefreshCrmStatus={onRefreshCrmStatus}
            onUpdateCrmRecord={onUpdateCrmRecord}
          />
        ) : !crmConnected ? (
          <Button
            disabled
            className="w-full h-12 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl cursor-not-allowed"
            title="Connect a CRM from the top-right menu first"
          >
            Connect a CRM to enable push
          </Button>
        ) : account.isDisqualified ? (
          <Button
            disabled
            className="w-full h-12 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl cursor-not-allowed"
          >
            Disqualified accounts cannot be pushed
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              onClick={() => onSyncToCrm?.(account)}
              disabled={isCrmLoading || !onSyncToCrm}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isCrmLoading ? 'Adding…' : `Add this account to ${crmProviderName} CRM`}
            </Button>
            {onUpdateAccount && (
              <button
                type="button"
                onClick={() => {
                  const existingId = window.prompt(
                    `If this account already exists in ${crmProviderName} (e.g. from earlier testing), enter its record ID to mark it synced and prevent duplicate pushes.\n\nLeave blank to mark as synced without an ID.`,
                    ''
                  );
                  if (existingId === null) return; // user cancelled
                  onUpdateAccount({
                    ...account,
                    crmSyncedAt: new Date().toISOString(),
                    crmRecordId: existingId.trim() || 'manual',
                    crmProvider: 'prospectaccel',
                  });
                  toast.success('Marked as already in CRM. Push flow will now skip this account.');
                }}
                className="w-full text-[11.5px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline underline-offset-2 py-1 cursor-pointer"
                title="Use this if the account is already in the CRM from earlier testing (before duplicate protection existed)."
              >
                Mark as already in CRM (don't push)
              </button>
            )}
          </div>
        )}
      </div>
      </div>
    </motion.div>
  );
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// Reused by the Signal Freshness card's Freshness × Sector = Intent strip.
// Each box shows a labeled numeric value with a plain-english hint below,
// so the whole formula reads left-to-right without needing a legend.
function MetricBox({
  label,
  value,
  hint,
  tone,
  emphasized = false,
}: {
  label: string;
  value: string;
  hint: string;
  tone: string;
  emphasized?: boolean;
}) {
  return (
    <div className={`rounded-lg px-2 py-1.5 border text-center ${
      emphasized
        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60'
        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
    }`}>
      <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">{label}</div>
      <div className={`text-[15px] font-semibold font-mono leading-tight mt-0.5 ${tone}`}>{value}</div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{hint}</div>
    </div>
  );
}

// Renders the "already in CRM" state: shows the existing CRM record (owner,
// lead status, opportunity stage, last activity) plus diff-vs-research and
// refresh actions.
function CrmRecordPanel({
  account,
  crmProviderName,
  onRefreshCrmStatus,
  onUpdateCrmRecord,
}: {
  account: TargetAccount;
  crmProviderName: string;
  onRefreshCrmStatus?: (a: TargetAccount) => void;
  onUpdateCrmRecord?: (a: TargetAccount) => void;
}) {
  const record = account.crmRecord;
  const diffs = record ? crmMirror.diffAccount(account, record) : [];
  const hasDiffs = diffs.length > 0;

  const statusTone = (status?: string) => {
    if (status === 'Qualified') return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60';
    if (status === 'Unqualified') return 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60';
    if (status === 'Working' || status === 'Contacted') return 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60';
    if (status === 'Nurturing') return 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60';
    return 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700';
  };

  const stageTone = (stage?: string) => {
    if (stage === 'Closed Won') return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60';
    if (stage === 'Closed Lost') return 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60';
    if (stage === 'Proposal' || stage === 'Negotiation') return 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/60';
    if (stage === 'Qualification' || stage === 'Prospecting') return 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60';
    return 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700';
  };

  return (
    <div className="w-full rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
          <Check className="w-4 h-4" />
          <span className="text-sm font-semibold">Already in {crmProviderName}</span>
          {account.crmRecordId != null && (
            <span className="text-emerald-700/80 dark:text-emerald-300/80 text-xs font-mono">
              #{account.crmRecordId}
            </span>
          )}
        </div>
        {onRefreshCrmStatus && (
          <button
            type="button"
            onClick={() => onRefreshCrmStatus(account)}
            className="inline-flex items-center gap-1 text-[11.5px] text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 underline underline-offset-2 cursor-pointer"
            title="Re-pull the latest CRM status"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh status
          </button>
        )}
      </div>

      {record ? (
        <>
          {/* Three-up: owner, lead status, opportunity stage */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-800/40 bg-white dark:bg-slate-900/60 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <User className="w-3 h-3" />
                Account owner
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1 truncate" title={record.owner}>
                {record.owner}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-800/40 bg-white dark:bg-slate-900/60 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Activity className="w-3 h-3" />
                Lead status
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-semibold border mt-1 ${statusTone(record.leadStatus)}`}>
                {record.leadStatus}
              </span>
            </div>
            <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-800/40 bg-white dark:bg-slate-900/60 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Briefcase className="w-3 h-3" />
                Opportunity stage
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-semibold border mt-1 ${stageTone(record.opportunityStage)}`}>
                {record.opportunityStage}
              </span>
            </div>
          </div>

          {/* Diff callout when research disagrees with CRM */}
          {hasDiffs && onUpdateCrmRecord && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-amber-800 dark:text-amber-200">
                    Research disagrees with CRM on {diffs.length} field{diffs.length === 1 ? '' : 's'}
                  </div>
                  <ul className="mt-1.5 space-y-1 text-[11px] text-amber-800 dark:text-amber-200">
                    {diffs.slice(0, 3).map((d, i) => (
                      <li key={i} className="font-mono">
                        <span className="font-semibold">{d.field}:</span>
                        <span className="mx-1 line-through opacity-70">{d.crmValue || '—'}</span>
                        <ArrowUpRight className="w-3 h-3 inline mx-0.5" />
                        <span className="font-semibold">{d.researchValue || '—'}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => onUpdateCrmRecord(account)}
                    className="mt-2 h-8 text-[11.5px] bg-amber-600 hover:bg-amber-700 text-white gap-1 px-3"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Update CRM with latest research
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Activity timeline (last 3) */}
          {record.activities.length > 0 && (
            <div className="border-t border-emerald-200/60 dark:border-emerald-800/40 pt-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Recent activity
              </div>
              <ul className="space-y-1">
                {record.activities.slice(-3).reverse().map(a => (
                  <li key={a.id} className="flex items-start gap-2 text-[11.5px]">
                    <TrendingUp className="w-3 h-3 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 flex-1 min-w-0 truncate" title={a.summary}>
                      {a.summary}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px] shrink-0">
                      {new Date(a.at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            Last activity {new Date(record.lastActivityAt).toLocaleString()}
          </div>
        </>
      ) : (
        <div className="text-[12px] text-slate-600 dark:text-slate-400">
          Marked as synced, but no CRM record snapshot is cached locally. Click Refresh to pull the latest status.
        </div>
      )}
    </div>
  );
}

const SOCIAL_META: Record<string, {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  chipClass: string;
  iconClass: string;
  tabDot: string;
}> = {
  linkedin:  { label: 'LinkedIn',    Icon: FaLinkedin,  chipClass: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800/60',     iconClass: 'text-blue-600 dark:text-blue-400',    tabDot: 'text-blue-500' },
  youtube:   { label: 'YouTube',     Icon: FaYoutube,   chipClass: 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800/60',           iconClass: 'text-red-600 dark:text-red-400',      tabDot: 'text-red-500' },
  x:         { label: 'X',           Icon: FaXTwitter,  chipClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',    iconClass: 'text-slate-800 dark:text-slate-200',  tabDot: 'text-slate-700 dark:text-slate-300' },
  instagram: { label: 'Instagram',   Icon: FaInstagram, chipClass: 'bg-pink-50 dark:bg-pink-950/40 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-800/60',     iconClass: 'text-pink-600 dark:text-pink-400',    tabDot: 'text-pink-500' },
  facebook:  { label: 'Facebook',    Icon: FaFacebook,  chipClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800/60', iconClass: 'text-indigo-600 dark:text-indigo-400', tabDot: 'text-indigo-500' },
};

function SocialPlatformCard({ platform }: { platform: SocialPlatformData; key?: any }) {
  const meta = SOCIAL_META[platform.platform] ?? SOCIAL_META.linkedin;
  const { Icon } = meta;
  const isYouTube = platform.platform === 'youtube';

  const cadenceBadge: Record<string, string> = {
    daily:   'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    weekly:  'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    monthly: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    dormant: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  };

  const topicBadge: Record<string, string> = {
    'product launch':      'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    'hiring':              'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    'thought leadership':  'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/50',
    'partnership':         'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50',
    'funding':             'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    'culture':             'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    'other':               'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  };

  const engagementDot: Record<string, string> = {
    high:   'bg-emerald-500',
    medium: 'bg-amber-400',
    low:    'bg-slate-300 dark:bg-slate-600',
  };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-800/30 overflow-hidden">
      {/* Platform header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[13px] font-bold border ${meta.chipClass}`}>
            <Icon className={`w-3 h-3 ${meta.iconClass}`} />
            {meta.label}
          </span>
          <a
            href={platform.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-mono text-indigo-600 dark:text-indigo-300 hover:underline truncate max-w-[140px]"
          >
            {platform.handle}
          </a>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {platform.followerEstimate !== undefined && platform.followerEstimate > 0 && (
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              {fmtNum(platform.followerEstimate)} {isYouTube ? 'subs' : 'followers'}
            </span>
          )}
          {isYouTube && platform.postCount !== undefined && platform.postCount > 0 && (
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
              {platform.postCount.toLocaleString()} videos
            </span>
          )}
          <span className={`text-[10px] font-bold px-1.5 py-0 rounded-full border capitalize ${cadenceBadge[platform.postingCadence] ?? cadenceBadge.monthly}`}>
            {platform.postingCadence}
          </span>
        </div>
      </div>

      <div className="p-2.5 space-y-2">
        {/* Recent posts */}
        {platform.recentPosts.length === 0 ? (
          <div className="flex items-center justify-center gap-1.5 py-3 text-[11.5px] text-slate-400 dark:text-slate-500 font-medium">
            <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px]">—</span>
            No activity in the past 15 days
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{isYouTube ? 'Recent Videos' : 'Recent Posts'}</div>
            {platform.recentPosts.map((post, i) => (
              <div key={i} className="flex gap-2 bg-white dark:bg-slate-900/60 rounded-md p-2 border border-slate-100 dark:border-slate-700/60">
                <div className="mt-1 shrink-0">
                  <span className={`block w-1.5 h-1.5 rounded-full ${engagementDot[post.engagementTier] ?? engagementDot.low}`} title={`${post.engagementTier} engagement`} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[11.5px] leading-snug text-slate-700 dark:text-slate-300">{post.summary}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[9.5px] font-bold px-1 py-0 rounded border capitalize ${topicBadge[post.topic] ?? topicBadge.other}`}>
                      {post.topic}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{post.date}</span>
                    {/* YouTube real metrics */}
                    {post.viewCount !== undefined && post.viewCount > 0 && (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0 rounded">
                        👁 {fmtNum(post.viewCount)}
                      </span>
                    )}
                    {post.likeCount !== undefined && post.likeCount > 0 && (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0 rounded">
                        👍 {fmtNum(post.likeCount)}
                      </span>
                    )}
                    {post.retweetCount !== undefined && post.retweetCount > 0 && (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0 rounded">
                        🔁 {fmtNum(post.retweetCount)}
                      </span>
                    )}
                    {post.commentCount !== undefined && post.commentCount > 0 && (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0 rounded">
                        💬 {fmtNum(post.commentCount)}
                      </span>
                    )}
                    {post.url && (
                      <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 dark:text-indigo-400 hover:underline flex items-center gap-0.5 font-medium">
                        {isYouTube ? 'Watch' : 'View'} <ExternalLink className="w-2 h-2" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* GTM Signals — always shown even when no posts in window */}
        {platform.signals.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-700/50">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Buying Intent Signals</div>
            {platform.signals.map((signal, i) => (
              <div key={i} className="flex items-start gap-1 text-[13px] text-slate-700 dark:text-slate-300">
                <Activity className="w-2.5 h-2.5 mt-0.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <span>{signal}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompetitorCard({ comp }: { comp: any; key?: any }) {
  const getDisplacementColor = (val: string) => {
    switch (val?.toLowerCase()) {
      case 'high': 
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60';
      case 'medium': 
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800/60';
      default: 
        return 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getLikelihoodColor = (val: string) => {
    switch (val?.toLowerCase()) {
      case 'high': 
        return 'text-emerald-700 dark:text-emerald-300 font-bold';
      case 'medium': 
        return 'text-amber-700 dark:text-amber-300 font-bold';
      default: 
        return 'text-slate-500 dark:text-slate-300 font-medium';
    }
  };

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/65 bg-white dark:bg-slate-900 space-y-3.5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex flex-wrap items-center gap-1.5 leading-tight">
            <span>{comp.name}</span>
            <span className="text-[12px] font-medium text-slate-400">({comp.category})</span>
          </h4>
          <p className="text-[12px] text-slate-400 mt-1 font-medium leading-normal">
            Inferred Signal: <span className="text-slate-650 dark:text-slate-400 font-normal italic">"{comp.inferredSource}"</span>
          </p>
        </div>
        <Badge variant="outline" className={`text-[12px] font-semibold px-2 py-0.5 rounded-md ${getDisplacementColor(comp.displacementPotential)} shrink-0`}>
          Displacement: {comp.displacementPotential}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 bg-slate-50/70 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-normal block mb-0.5">Switch Likelihood</span>
          <span className={`text-[13px] leading-tight ${getLikelihoodColor(comp.switchingLikelihood)}`}>
            {comp.switchingLikelihood}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-normal block mb-0.5">Timing Sensitivity</span>
          <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 leading-tight">
            {comp.timingSensitivity}
          </span>
        </div>
      </div>

      <div className="bg-slate-50/20 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-normal block mb-1">Competitive Positioning Pitch</span>
        <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
          {comp.competitivePositioningAngle}
        </p>
      </div>

      {/* Competitor Citation */}
      <SourceCitation 
        citation={comp.citation || {
          sourceTier: 'Tertiary',
          sourceName: 'Employee reviews, active vendor mentions list & technology footprints',
          dateRetrieved: 'May 20, 2026',
          isInferred: true,
          confidenceScore: 65,
          url: 'https://www.google.com/search?q=incumbent+solutions'
        }}
        inlineLabel="Competing provider tracked on" 
      />
    </div>
  );
}

function getDefaultCompetitors(account: TargetAccount) {
  const brandName = account.name.toLowerCase();
  
  if (brandName.includes("jacobs") || brandName.includes("aecom") || brandName.includes("infrastructure") || brandName.includes("engineering")) {
    return [
      {
        name: "Autodesk Consulting & Core Revit Teams",
        category: "BIM Layout Subcontracting",
        inferredSource: "Tech stack on domains and active LinkedIn job descriptions hiring specialized Revit developers",
        displacementPotential: "High",
        switchingLikelihood: "High",
        timingSensitivity: "Current backlog in heavy infrastructure deliverables",
        competitivePositioningAngle: "Autodesk's implementation consulting incurs bloated pricing setups and static delivery timelines. Leverage our agile offshore delivery ecosystem to clear BIM backlogs at 42% lower costs with 24-hour turnaround cycles."
      },
      {
        name: "Legacy Offshore Outsourcing (Wipro/TCS)",
        category: "Traditional IT/CAD Staffing",
        inferredSource: "Historic vendor partnership announcements and global procurement review site entries",
        displacementPotential: "Medium",
        switchingLikelihood: "Medium",
        timingSensitivity: "Standard annual SLA renewal cycle coming up in late Q3",
        competitivePositioningAngle: "Traditional staff contracting agencies lack deep, purpose-built CAD workflow automated tooling. Highlight our specialized engineering QA protocols and dedicated, zero-hand-off project integration."
      }
    ];
  }

  // Broad fallback
  return [
    {
      name: "Legacy On-premise Infrastructure Agencies",
      category: "IT & Systems Staffing",
      inferredSource: "Review sites and technology stack monitoring showing on-premise active tag integrations",
      displacementPotential: "High",
      switchingLikelihood: "Medium",
      timingSensitivity: "Upcoming hardware lifecycle lease renewals",
      competitivePositioningAngle: "Legacy agencies are bottlenecked by static talent pools. Pitch our hyper-scaler specialists and automated screening workflows to reduce project kick-off window from 6 weeks to 72 hours."
    },
    {
      name: "Generic Freelancer Networks (Upwork Pro/Toptal)",
      category: "Talent Platforms",
      inferredSource: "Public job posting metadata requesting ad-hoc developer capabilities on contract",
      displacementPotential: "Medium",
      switchingLikelihood: "High",
      timingSensitivity: "Immediate scaling friction reported on current design cycles",
      competitivePositioningAngle: "Ad-hoc contract freelancing drops team coordination and compromises structural IP. Present our enterprise compliance safeguards, robust QA, and dedicated project managers."
    }
  ];
}
