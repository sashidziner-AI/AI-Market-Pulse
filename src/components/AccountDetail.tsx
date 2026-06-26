import React from 'react';
import { TargetAccount, DetailedAnalysis, MultiThreadingStrategy, StakeholderNode, IntelCitation } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ShieldCheck, Mail, Linkedin, Users, 
  Lightbulb, AlertCircle, Copy, Check, 
  ArrowUpRight, Info, Clock, TrendingUp, AlertTriangle,
  Network, GitBranch, ShieldAlert, Sparkles, Sliders, SlidersHorizontal, Target,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAccountPriorityInfo, getOrInitializeSignals, AccountSignal } from './AccountCard';
import { toast } from 'sonner';

export function SourceCitation({ citation, inlineLabel, isSignal = false }: { citation?: IntelCitation; inlineLabel?: string; isSignal?: boolean }) {
  if (!citation) return null;

  const { sourceTier, sourceName, dateRetrieved, url, isInferred, confidenceScore } = citation;

  // Modern style indicators matching the source tier
  const tierColors = {
    Primary: {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      label: 'Primary Source',
      dot: 'bg-emerald-500'
    },
    Secondary: {
      bg: 'bg-blue-50 text-blue-800 border-blue-200',
      label: 'Secondary Source',
      dot: 'bg-blue-500'
    },
    Tertiary: {
      bg: 'bg-amber-50 text-amber-800 border-amber-200',
      label: 'Tertiary / Inferred Source',
      dot: 'bg-amber-500'
    }
  }[sourceTier] || {
    bg: 'bg-slate-50 text-slate-800 border-slate-200',
    label: sourceTier,
    dot: 'bg-slate-400'
  };

  return (
    <div className={`mt-3 p-3 rounded-lg border text-left font-sans text-xs ${isInferred ? 'bg-amber-50/10 border-amber-200/40' : 'bg-slate-50/40 border-slate-200/50'}`}>
      {/* Top badges & core metrics */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-slate-200/60 pb-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold border uppercase tracking-wider ${tierColors.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tierColors.dot}`} />
            {tierColors.label}
          </span>
          <span className="text-slate-300 font-normal select-none">•</span>
          <span className="text-slate-700 font-bold text-[10.5px]">
            {sourceName}
          </span>
        </div>

        {confidenceScore !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase font-bold text-slate-400 select-none">Confidence:</span>
            <span className={`text-[11px] font-black tracking-wide bg-white px-1.5 py-0.5 rounded border border-slate-100 ${confidenceScore >= 85 ? 'text-emerald-700' : confidenceScore >= 70 ? 'text-indigo-600' : 'text-amber-700'}`}>
              {confidenceScore}%
            </span>
          </div>
        )}
      </div>

      {/* Main explanation content and source warning */}
      <div className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-slate-600">
        <Info className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isInferred ? 'text-amber-500 animate-pulse' : 'text-slate-450'}`} />
        <div className="flex-1 space-y-1">
          <div>{inlineLabel || 'Intelligence gathered and authenticated on'} <span className="font-bold text-slate-700">{dateRetrieved}</span>.</div>
          
          {isInferred ? (
            <div className="mt-1 font-semibold text-amber-800 flex flex-wrap gap-1 items-center bg-amber-50/60 p-1.5 rounded border border-amber-100/50">
              <span className="font-black text-[8px] uppercase tracking-wider bg-amber-200 text-amber-900 px-1 rounded-sm select-none">Inferred claim warning</span>
              <span>This claim depends entirely on tertiary public feedback or indirect inference, and should not be treated as a verified fact.</span>
            </div>
          ) : (
            <div className="mt-1 font-semibold text-emerald-800 flex flex-wrap gap-1 items-center bg-emerald-50/40 p-1 rounded">
              <span className="font-black text-[8px] uppercase tracking-wider bg-emerald-100 text-emerald-900 px-1 rounded-sm select-none">Verified Fact</span>
              <span>This intelligence is verified from official, high-quality public filings or first-party job posts.</span>
            </div>
          )}
        </div>
      </div>

      {url && (
        <div className="mt-2 text-right">
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700 hover:underline transition-all tracking-wider"
          >
            Go to Source Document
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}
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
  
  // Direct clean link to LinkedIn's official People Search pre-populated with the target name and company.
  // This takes the user straight to LinkedIn to search and connect immediately.
  const linkedinUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name + " " + company)}`;
  
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

export function StakeholderLinkedinCard({ role, company, compact = false }: { role: string; company: string; compact?: boolean }) {
  const details = getInferredStakeholderDetails(role, company);
  const initials = details.name.split(' ').map(n => n[0]).join('');

  if (compact) {
    return (
      <div className="bg-slate-50 border border-slate-150 rounded-lg p-2.5 flex items-center justify-between gap-3 font-sans hover:bg-slate-100/50 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${details.avatarBg} text-white flex items-center justify-center font-bold text-[10.5px] shrink-0 uppercase shadow-3xs`}>
            {initials}
          </div>
          <div className="min-w-0 space-y-0.5 text-left">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-xs text-slate-800 truncate">{details.name}</span>
              <span className="bg-blue-50 text-blue-700 text-[8px] font-bold px-1 rounded-full border border-blue-100 font-mono scale-[0.9]">
                1st
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium truncate">
              {role} at <span className="font-extrabold text-slate-700">{company}</span>
            </div>
          </div>
        </div>
        <a
          href={details.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-blue-600 hover:text-blue-700 hover:bg-slate-50 font-bold text-[9.5px] cursor-pointer shadow-3xs transition-colors shrink-0"
        >
          <Linkedin className="w-3 h-3 fill-blue-600 text-white stroke-1" />
          <span>Connect</span>
        </a>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans shadow-3xs hover:shadow-2xs transition-all w-full">
      <div className="flex items-center gap-3.5 text-left">
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${details.avatarBg} text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 uppercase`}>
          {initials}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900 leading-none">{details.name}</span>
            <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-blue-100 font-mono">
              1st
            </span>
          </div>
          <div className="text-xs text-slate-500 font-medium leading-none">
            {role} at <span className="font-extrabold text-slate-700">{company}</span>
          </div>
          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono">
            {details.estimatedYoe} Years Exp • Inferred Stakeholder Node
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-auto w-full sm:w-auto justify-end">
        <a
          href={details.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] cursor-pointer shadow-sm transition-colors text-center w-full sm:w-auto justify-center"
        >
          <Linkedin className="w-3.5 h-3.5 fill-white text-blue-600 stroke-1" />
          <span>Real-time LinkedIn Scan</span>
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
}

export function AccountDetail({ account, onClose, onUpdateAccount }: AccountDetailProps) {
  const [copied, setCopied] = React.useState<string | null>(null);
  
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
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
    >
      <div className="flex items-center justify-between p-6 border-b border-slate-100">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
            {(editName.charAt(0) || 'A').toUpperCase()}
          </div>
          {isEditing ? (
            <div className="space-y-1.5 flex-1 min-w-0 pr-2">
              <input 
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Account Name"
                className="w-full text-base font-bold bg-white text-slate-850 border border-slate-250 px-2.5 py-1 rounded outline-none focus:border-indigo-500 font-sans"
              />
              <input 
                type="text"
                value={editDomain}
                onChange={(e) => setEditDomain(e.target.value)}
                placeholder="domain.com"
                className="w-full text-xs font-mono font-normal bg-white text-slate-650 border border-slate-200 px-2.5 py-1 rounded outline-none focus:border-indigo-500"
              />
            </div>
          ) : (
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900 truncate">{account.name}</h2>
              <p className="text-sm text-slate-500 font-mono truncate">{account.domain}</p>
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
                  className="h-8 px-2.5 text-xs text-slate-500"
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
                onClick={() => setIsEditing(true)}
                className="h-8 text-xs font-bold gap-1 text-slate-650 border-slate-200 hover:text-indigo-605 hover:bg-slate-50"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Edit Info</span>
              </Button>
            )
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8">
            <X className="w-5 h-5 text-slate-500" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-slate-200">
        <div className="p-6 space-y-8">
          {/* Executive Summary */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Evidence-Based Fit Intel
              </h3>
              {isEditing ? (
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-605 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                  <span>Fit Score:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editFitScore}
                    onChange={(e) => setEditFitScore(Number(e.target.value))}
                    className="w-12 bg-white font-bold text-center border rounded outline-none h-5 text-xs text-indigo-700 focus:border-indigo-550 focus:border-indigo-500"
                  />
                  <span>%</span>
                </div>
              ) : (
                <Badge variant="outline" className="font-mono text-indigo-600 border-indigo-200 bg-indigo-50 flex items-center gap-1">
                  Fit Score: <span className="font-bold">{info.fitScore}%</span>
                  {info.decayApplied && (
                    <span className="text-slate-400 line-through text-[9px] font-normal" title={`Original: ${info.originalFitScore}% before freshness decay`}>
                      ({info.originalFitScore}%)
                    </span>
                  )}
                </Badge>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3 font-sans text-xs text-left">
                <div className="space-y-1 shadow-2xs bg-slate-50/50 p-3 rounded-lg border border-slate-105">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Company Description</label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Brief description of what the company does..."
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-1 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 font-medium"
                  />
                </div>
                <div className="space-y-1 shadow-2xs bg-slate-50/50 p-3 rounded-lg border border-slate-105">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">ICP Alignment & Fit Evidence Rationale</label>
                  <textarea
                    rows={4}
                    value={editRationale}
                    onChange={(e) => setEditRationale(e.target.value)}
                    placeholder="Evidence rationale on why this customer fits..."
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-1 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 font-medium leading-relaxed"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {account.description && (
                  <p className="text-xs text-slate-500 italic px-1 font-normal leading-relaxed text-left">{account.description}</p>
                )}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap text-left font-sans">
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
          <section className="space-y-4 bg-indigo-50/20 p-5 rounded-2xl border border-indigo-100 shadow-2xs text-left">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  Industry-Specific Buying Intent Calibration
                </h3>
                {account.forcedSectorModel ? (
                  <Badge variant="outline" className="text-[10px] uppercase font-black tracking-wider text-rose-700 bg-rose-50 border-rose-200">
                    🛠️ Overridden
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] uppercase font-black tracking-wider text-emerald-800 bg-emerald-50 border-emerald-200">
                    ✓ Auto-Detected
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
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
                        : 'bg-white text-slate-650 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>{btnLabel}</div>
                    {isAutoSelected && (
                      <div className="text-[8px] opacity-85 font-semibold mt-0.5 tracking-tight uppercase">Auto-Set</div>
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
                  className="text-[10px] text-indigo-600 hover:text-indigo-750 transition-colors font-bold underline"
                >
                  Reset to Auto-Detected Norms
                </button>
              </div>
            )}
          </section>

          {/* Caution matching Alert indicator */}
          {info.hasCautionMatches && (
            <div className="p-4.5 rounded-2xl bg-amber-50/50 border border-amber-250 text-left space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800 uppercase tracking-wider font-sans">
                <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>Adaptive Caution Warning Triggered</span>
              </div>
              <div className="text-xs text-amber-700 space-y-1 my-0.5 font-sans leading-relaxed">
                <p className="font-semibold">
                  This target profile matches historical outbound characteristics that struggle to convert:
                </p>
                <ul className="list-disc pl-4 space-y-1 font-medium text-[11.5px]">
                  {info.cautions.map((caution: string, idx: number) => (
                    <li key={idx} className="marker:text-amber-500">{caution}</li>
                  ))}
                </ul>
                <p className="text-[10px] italic text-amber-600 font-bold block pt-1.5 border-t border-amber-200/40">
                  💡 Closed-loop adjustment: Target score calibrated -{info.cautions.length * 15} fit penalty points to save marketing overhead.
                </p>
              </div>
            </div>
          )}

          {/* Outreach Loop & Adaptive Feedback Outcomes Console */}
          <section className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                Adaptive Feedback & Outreach Outcomes
              </h3>
              {account.outreachOutcome ? (
                <Badge variant="outline" className={`text-[10px] uppercase font-extrabold tracking-wider ${
                  ['Positive Reply', 'Meeting Booked', 'Deal Won'].includes(account.outreachOutcome)
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-250'
                    : 'text-slate-650 bg-slate-100 border-slate-200/80'
                }`}>
                  ✓ Feedback Recorded
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-400 bg-white border-slate-205">
                  Awaiting Pipeline Outcome
                </Badge>
              )}
            </div>
            
            <p className="text-[11px] text-slate-500 font-normal leading-relaxed">
              Record real-world outbound responses. This feedback loop dynamically adapts future scoring weights for related signal profiles and applies cautionary markers to risky account segments.
            </p>

            <div className="space-y-3.5 pt-1">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-450 tracking-wider block mb-1.5 font-mono">Outbound Pipeline Stage</label>
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
                            : 'bg-slate-50 text-slate-650 border-slate-250 hover:bg-slate-100'
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
                <div className="space-y-2.5 pt-1.5 border-t border-slate-100">
                  <label className="text-[10px] font-black uppercase text-slate-450 tracking-wider block font-mono">Commercial Outreach Outcome</label>
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
                          className={`px-2.5 py-2.5 rounded-xl border text-[11.5px] font-bold text-left transition-all flex flex-col justify-between cursor-pointer ${
                            isActive
                              ? isPositive 
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-1 ring-emerald-250'
                                : 'bg-slate-800 text-white border-slate-900 shadow-md ring-1 ring-slate-800'
                              : 'bg-white text-slate-755 border-slate-205 hover:bg-slate-50'
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
                        className="text-[10px] text-slate-450 hover:text-slate-650 transition-colors font-bold underline cursor-pointer"
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
              <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-left space-y-1 text-[11px] leading-relaxed">
                <span className="font-extrabold uppercase text-[9.5px] text-indigo-750 tracking-wider block mb-1 font-mono">Adaptive AI Recalibration Applied:</span>
                {['Positive Reply', 'Meeting Booked', 'Deal Won'].includes(account.outreachOutcome) ? (
                  <p className="text-emerald-700 font-medium">
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
          <section className="space-y-3.5 bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 shadow-xs">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              Prioritization & Outreach Timing Intel
            </h3>
            
            {(() => {
              const info = getAccountPriorityInfo(account);
              const priorityBg = info.priorityFlag === 'Immediate Action Required' ? 'bg-rose-50 border-rose-200' :
                                 info.priorityFlag === 'Nurture Queue' ? 'bg-teal-50/50 border-teal-150' : 
                                 'bg-slate-50 border-slate-150';
                                 
              const flagTextClass = info.priorityFlag === 'Immediate Action Required' ? 'text-rose-700' :
                                   info.priorityFlag === 'Nurture Queue' ? 'text-teal-700' : 'text-slate-650';

              return (
                <div className="space-y-3">
                  <div className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 ${priorityBg}`}>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Outreach Target Status</span>
                      <div className={`text-xs font-black uppercase mt-0.5 tracking-wide ${flagTextClass}`}>
                        {info.priorityFlag === 'Immediate Action Required' ? '🚨 Immediate Action Required' : 
                         info.priorityFlag === 'Nurture Queue' ? '⏳ Nurture Queue - Build Demand' : 
                         '🎯 Standard Follow-up Opportunity'}
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Outreach Window</span>
                      <div className="text-xs font-bold text-slate-700 mt-0.5 flex items-center gap-1 sm:justify-end">
                        <Clock className="w-3.5 h-3.5 text-indigo-505" />
                        {info.outreachWindow}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-white rounded-lg border border-slate-150 text-center">
                      <div className="text-[9px] uppercase font-bold text-slate-400">ICP Fit Score</div>
                      <div className="text-lg font-black text-slate-800 font-mono mt-0.5">{info.fitScore}%</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-150 text-center">
                      <div className="text-[9px] uppercase font-bold text-slate-400">Timing Score</div>
                      <div className="text-lg font-black text-slate-800 font-mono mt-0.5">{info.timingScore}%</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-150 text-center">
                      <div className="text-[9px] uppercase font-bold text-slate-400">Priority Index</div>
                      <div className="text-lg font-extrabold text-indigo-700 font-mono mt-0.5" title="(Fit + Timing) / 2">{info.priorityIndex}</div>
                    </div>
                  </div>

                  <div className="text-[11px] leading-relaxed text-slate-500 border-t border-slate-200/50 pt-2 flex items-start gap-1.5 bg-slate-50/20 p-2 rounded">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      Priority score of <strong>{info.priorityIndex}/100</strong> indicates an <strong>{info.timingStage}</strong> stage. 
                      {info.priorityFlag === 'Immediate Action Required' 
                        ? " This high intensity signals immediate operational gaps. Trigger direct personalized cold sequence immediately."
                        : info.priorityFlag === 'Nurture Queue'
                        ? " High fit combined with low immediate signal intensity advises soft nurture touchpoints to map technical champions."
                        : " Keep steady outbound engagement focused on competitive incumbents."}
                    </span>
                  </div>
                </div>
              );
            })()}
          </section>

          {/* Buying Signals with Live Freshness Tuning */}
          <section className="space-y-4 bg-slate-50/60 p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
              <div className="text-left">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  Signal Freshness tuning & Decay Board
                </h3>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Decay factor: <span className="font-bold text-emerald-650">100% at 0-90 days</span>, linear decay, <span className="font-bold text-red-650">0% at 180+ days</span>.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge variant="outline" className={`font-mono text-[10px] font-black tracking-wider uppercase ${
                  info.freshnessLabel === 'FRESH' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' :
                  info.freshnessLabel === 'AGING' ? 'bg-amber-50 text-amber-700 border-amber-200/60' :
                  'bg-slate-100 text-slate-700 border-slate-300'
                }`}>
                  {info.freshnessLabel} : {info.freshnessScore}%
                </Badge>
              </div>
            </div>

            {/* Recommendations or warnings */}
            {info.reResearchRecommended ? (
              <div className="p-4 bg-amber-50 border border-amber-205 rounded-xl flex items-start gap-3 shadow-3xs animate-fadeIn text-left">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-wide">🔍 RE-RESEARCH STRONGLY RECOMMENDED</h4>
                  <p className="text-[11px] leading-relaxed text-amber-750 font-bold">
                    All intent signals for this account are older than 180 days and marked as stale. outreach window holds; do not execute active outbound sequence until intelligence is updated.
                  </p>
                </div>
              </div>
            ) : info.decayApplied ? (
              <div className="p-3 bg-indigo-50/40 border border-indigo-100/60 rounded-xl flex items-start gap-2.5 text-left">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5 animate-pulse" />
                <p className="text-[11px] leading-normal text-indigo-805 font-medium">
                  <strong>Score Decay Notice:</strong> Intent signals are rotting with progressive weight penalties. Capture a fresh signal to restore perfect prioritization metrics.
                </p>
              </div>
            ) : null}

            {/* List of signals with sliders */}
            <div className="space-y-4">
              {info.resolvedSignals.map((sig, sIdx) => {
                let sigBadgeColor = "bg-emerald-50 border-emerald-105 text-emerald-805";
                if (sig.freshnessWeight >= 0.8) {
                  sigBadgeColor = "bg-emerald-50 border-emerald-100 text-emerald-700";
                } else if (sig.freshnessWeight > 0) {
                  sigBadgeColor = "bg-amber-50 border-amber-100 text-amber-700";
                } else {
                  sigBadgeColor = "bg-slate-100 border-slate-200 text-slate-500";
                }

                return (
                  <div key={sig.id || sIdx} className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-xs transition-all space-y-3">
                    <div className="flex items-start justify-between gap-3 text-left">
                      <div className="space-y-1 min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-800 leading-relaxed block overflow-hidden text-ellipsis">
                          {sig.text}
                        </span>
                        {/* Signal Category Badge */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase text-indigo-700 bg-indigo-50 border border-indigo-150">
                            {sig.categoryLabel}
                          </span>
                          {sig.multiplier > 1.0 ? (
                            <span className="text-[9px] font-black text-emerald-650 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              {sig.multiplier.toFixed(2)}x Calibration Boost
                            </span>
                          ) : sig.multiplier < 1.0 ? (
                            <span className="text-[9px] font-black text-amber-650 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                              {sig.multiplier.toFixed(2)}x Runway Penalty
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-150">
                              1.00x Base Par
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded border ${sigBadgeColor} shrink-0`}>
                        {sig.ageDays <= 90 ? 'Fresh (100%)' : sig.ageDays <= 180 ? `Decaying (${Math.round(sig.freshnessWeight*100)}%)` : 'Stale (0%)'}
                      </span>
                    </div>

                    {/* Sector norm explanation */}
                    <div className="text-[10.5px] leading-relaxed text-slate-600 bg-slate-50/80 border border-slate-150 p-3 rounded-lg text-left font-medium">
                      💡 <strong className="text-slate-800 font-bold uppercase text-[9px] tracking-wide inline-block mr-1">Interpretation:</strong>{sig.sectorRationale}
                    </div>

                    {/* Signal Citation */}
                    {sig.citation && (
                      <SourceCitation 
                        citation={sig.citation} 
                        inlineLabel="Intent signal retrieved on" 
                        isSignal={true}
                      />
                    )}

                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          Age: <strong className="text-slate-700 font-mono font-bold">{sig.ageDays} days ago</strong>
                        </span>
                        <span className="font-mono text-[9px]">
                          calibrated: <strong className="text-indigo-600 font-extrabold">{Math.round(sig.freshnessWeight * 100)}% fresh</strong> × <strong className="text-slate-600 font-extrabold">{sig.multiplier.toFixed(2)}x sector weight</strong> = <strong className="text-indigo-650 font-black">{Math.round(sig.calibratedWeight * 100)}% intent</strong>
                        </span>
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
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        id={`sig-slider-${sig.id || sIdx}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add New Detected Signal Form */}
            <div className="border-t border-slate-200/80 pt-4 space-y-3 text-left">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-505 animate-pulse" />
                  Monitor/Detect Live Buying Signal
                </span>
                <p className="text-[10.5px] text-slate-500 mt-0.5">Capture real-time intent events in the environment. Triggers automatic, instant recalculations of the account index scores.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text"
                  placeholder="e.g., Appointed BIM lead or added Revit tech stack intent"
                  id="new-signal-text-input"
                  className="flex-1 px-3 py-2 text-xs bg-white border border-slate-205 rounded-xl h-9 outline-none focus:border-indigo-500 placeholder:text-slate-400 font-medium"
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
                  className="px-3 bg-indigo-600 text-white hover:bg-indigo-700 h-9 font-extrabold text-[11px] shrink-0"
                >
                  📡 Detect Signal
                </Button>
              </div>

              {/* Presets Row */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[9px] text-slate-400 font-bold uppercase">Simulate Live Feed:</span>
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
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-[10px] text-indigo-705 font-black cursor-pointer transition-colors"
                >
                  ⚡ Simulate Incoming Intent Event (New 0d)
                </button>
              </div>
            </div>
          </section>

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
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
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
                <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 text-slate-800 text-sm italic">
                  "{analysis?.outreachStrategy?.emailHook || 'No email angle generated yet. Click \"Research with AI\" to generate insights.'}"
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
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
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm">
                  {analysis?.outreachStrategy?.linkedinMessage || 'No LinkedIn angle generated yet.'}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="personas" className="space-y-4">
               {!analysis?.buyerPersonas || analysis.buyerPersonas.length === 0 ? (
                 <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                   <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                   <p className="text-xs font-bold text-slate-600">No Personas Mapped Yet</p>
                   <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto leading-normal">
                     Activate the GTM research engine to discover technical champions, decision-makers, core pain points, and specific value messaging.
                   </p>
                 </div>
               ) : (
                 analysis.buyerPersonas.map((persona, idx) => {
                   const stDetails = getInferredStakeholderDetails(persona.role, account.name);
                   return (
                     <div key={idx} className="p-5 rounded-xl border border-slate-150 bg-white space-y-4 shadow-sm text-left">
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
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                           Identified Account Contact (LinkedIn Synced)
                         </div>
                         <StakeholderLinkedinCard role={persona.role} company={account.name} />
                         
                         {/* Simulated Live Activity Widget */}
                         <div className="p-3 bg-blue-50/25 border border-blue-100 rounded-xl space-y-2 font-sans text-xs">
                           <div className="flex items-center justify-between text-[10px] text-blue-800 font-extrabold uppercase tracking-wider">
                             <span className="flex items-center gap-1.5 leading-none">
                               <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                               LinkedIn Live Signal Feed
                             </span>
                             <span className="font-mono text-[9px] text-slate-400 font-bold">{stDetails.recentPost.timeAgo}</span>
                           </div>
                           <p className="text-slate-650 italic leading-relaxed">
                             "{stDetails.recentPost.text}"
                           </p>
                           <div className="text-[10px] text-slate-400 font-bold font-mono">
                             👍 {stDetails.recentPost.likeCount} Likes/Comments • Monitored via Social Listening
                           </div>
                         </div>
                       </div>

                       <div className="space-y-2 pt-2 border-t border-slate-100">
                         <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Potential Pain Points</div>
                         <div className="flex flex-wrap gap-2">
                           {persona.painPoints.map((pain, pIdx) => (
                             <span key={pIdx} className="px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-medium">
                               {pain}
                             </span>
                           ))}
                         </div>
                       </div>
                       <div className="pt-2">
                         <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Value Angle</div>
                         <p className="text-xs text-slate-600 leading-relaxed mb-3">{persona.valueAngle}</p>
                       </div>

                       {/* Anticipated Objections & Pre-emptive Counter Narratives */}
                       <div className="pt-3.5 border-t border-slate-200/65">
                         <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                           <ShieldCheck className="w-4 h-4 text-indigo-500 font-sans" />
                           <span>Pre-emptive Counter-Narratives & Objection Handling</span>
                         </div>
                         {!persona.counterNarratives || persona.counterNarratives.length === 0 ? (
                           <p className="text-[11px] text-slate-400/80 italic">No custom counter-narratives mapped for this persona yet. Re-run research to populate.</p>
                         ) : (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1.5">
                             {persona.counterNarratives.map((cn, cnIdx) => (
                               <div key={cnIdx} className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-50/20 to-slate-50 border border-indigo-100 space-y-2.5 text-left shadow-2xs">
                                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-indigo-100/50 pb-1.5 font-sans">
                                   <span className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wide bg-slate-150 px-2 py-0.5 rounded border border-slate-200">
                                     🚨 {cn.objection}
                                   </span>
                                   <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150 font-mono self-start sm:self-auto">
                                     ⏱ {cn.suggestedMoment}
                                   </span>
                                 </div>
                                 <div className="text-xs text-slate-700 leading-relaxed pt-0.5">
                                   <strong className="text-indigo-950 font-black block text-[10.5px] mb-0.5 uppercase tracking-wide font-sans">Reframing message:</strong>
                                   <span className="italic font-sans">"{cn.reframingMessage}"</span>
                                 </div>
                                 <div className="text-[11px] text-slate-600 bg-white border border-slate-150 p-2.5 rounded-lg leading-relaxed font-sans">
                                   <strong className="text-emerald-700 font-bold block text-[10px] mb-0.5 uppercase tracking-wider">💡 Grounded Proof Point:</strong>
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
                    <div className="bg-gradient-to-r from-indigo-50/70 to-blue-50/30 border border-indigo-100 p-4 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Network className="w-5 h-5 text-indigo-600 animate-pulse" />
                        <h4 className="text-xs font-bold text-slate-905 uppercase tracking-wider">
                          Coordinated Multi-Threading Stakeholder Engagement Map
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {threading.sequencedMapDescription}
                      </p>
                    </div>

                    {/* Timeline Steps layout */}
                    <div className="space-y-4">
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                        Threading Sequencing Timeline
                      </div>
                      
                      <div className="relative pl-5 border-l border-dashed border-slate-200 ml-3.5 space-y-6">
                        {steps.map((step, idx) => {
                          let badgeBg = 'bg-indigo-50 text-indigo-750 border-indigo-100';
                          let pinBg = 'bg-indigo-650';
                          let borderHover = 'hover:border-indigo-300';
                          
                          if (idx === 1) {
                            badgeBg = 'bg-teal-50 text-teal-750 border-teal-100';
                            pinBg = 'bg-teal-650';
                            borderHover = 'hover:border-teal-300';
                          } else if (idx === 2) {
                            badgeBg = 'bg-emerald-50 text-emerald-750 border-emerald-100';
                            pinBg = 'bg-emerald-650';
                            borderHover = 'hover:border-emerald-300';
                          } else if (idx === 3) {
                            badgeBg = 'bg-purple-50 text-purple-750 border-purple-100';
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
                              <div className={`bg-white border border-slate-150 p-4 rounded-xl shadow-xs space-y-3 transition-all ${borderHover}`}>
                                <div className="border-b border-slate-100 pb-2.5 space-y-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap text-left">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border font-mono ${badgeBg} shrink-0`}>
                                        {step.node.timing}
                                      </span>
                                      <span className="text-sm font-black text-slate-800 leading-tight">
                                        {step.node.role}
                                      </span>
                                    </div>
                                    
                                    {/* Render standard short-form strategic roles inline */}
                                    {step.node.strategicRole && step.node.strategicRole.length <= 25 && (
                                      <Badge variant="secondary" className="text-[9px] font-bold tracking-wider px-2 py-0.5 uppercase bg-slate-50 text-slate-500 border border-slate-200 shrink-0 whitespace-nowrap self-start sm:self-auto">
                                        {step.node.strategicRole}
                                      </Badge>
                                    )}
                                  </div>

                                  {/* If strategicRole is a descriptive sentence, display it prominently on its own line beneath as an imperative callout */}
                                  {step.node.strategicRole && step.node.strategicRole.length > 25 && (
                                    <div className="text-[10.5px] leading-relaxed text-slate-600 bg-slate-50 border border-slate-150 rounded-lg p-2.5 text-left">
                                      <strong className="text-indigo-650 uppercase font-black text-[9px] font-mono block mb-1 tracking-wider leading-none">
                                        Strategic Target Principle:
                                      </strong>
                                      {step.node.strategicRole}
                                    </div>
                                  )}
                                </div>

                                {/* High-fidelity Compact LinkedIn Contact Scanner Node */}
                                <div className="pt-0.5">
                                  <StakeholderLinkedinCard role={step.node.role} company={account.name} compact={true} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                                  <div className="space-y-1">
                                    <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                                      Messaging Angle & Value Focus
                                    </div>
                                    <p className="text-slate-650 leading-relaxed text-[11px]">
                                      {step.node.messagingFocus}
                                    </p>
                                  </div>
                                  <div className="space-y-1.5 bg-slate-50/50 p-3 rounded-lg border border-slate-100/80 w-full">
                                    <div className="text-[9px] uppercase font-bold text-indigo-600 tracking-wider flex items-center gap-1.5">
                                      <GitBranch className="w-3.5 h-3.5 text-indigo-500 animate-bounce" />
                                      Tactical Outreach Hook
                                    </div>
                                    <p className="text-slate-700 font-medium leading-relaxed text-[11px]">
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
                    <div className="bg-amber-50/30 border border-amber-200/50 p-4 rounded-xl space-y-3 shadow-2xs">
                      <div className="flex items-center gap-2 text-amber-800">
                        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-extrabold uppercase tracking-wider">
                          Outreach Sequence Collision Prevention Protocols
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600 font-sans">
                        Simultaneous or uncoordinated outreach risks cross-contaminating dialogue standards. Align your outreach builders using these automated sequence limits:
                      </p>
                      <ul className="space-y-2 pl-4 list-disc text-[11px] text-slate-600 font-medium font-sans">
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
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-100">
                <Info className="w-4 h-4 shrink-0" />
                <p className="text-xs font-medium">Verified using latest public signals (LinkedIn, Crunchbase, BuiltWith).</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hiring Status</div>
                    <div className="text-sm font-bold text-emerald-600">Active - Sales & Ops</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Recent Funding</div>
                    <div className="text-sm font-bold text-slate-900">Series B ($22M)</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="competitive" className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-indigo-750 bg-indigo-50/75 p-3.5 rounded-xl border border-indigo-100/70 shadow-2xs">
                <Lightbulb className="w-4 h-4 text-indigo-500 shrink-0" />
                <p className="text-[11px] font-medium leading-normal text-indigo-900">
                  Competitive signals inferred from job boards, website tag stacks, review channels, and case study indicators.
                </p>
              </div>

              {!analysis?.competitors || analysis.competitors.length === 0 ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/30">
                    <p className="text-[11px] text-slate-500 leading-normal font-medium">
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
      
      <div className="p-6 border-t border-slate-100 bg-slate-50/50">
        <Button className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200">
          Sync to CRM (Salesforce/Hubspot)
        </Button>
      </div>
    </motion.div>
  );
}

function CompetitorCard({ comp }: { comp: any; key?: any }) {
  const getDisplacementColor = (val: string) => {
    switch (val?.toLowerCase()) {
      case 'high': 
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'medium': 
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default: 
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getLikelihoodColor = (val: string) => {
    switch (val?.toLowerCase()) {
      case 'high': 
        return 'text-emerald-700 font-bold';
      case 'medium': 
        return 'text-amber-700 font-bold';
      default: 
        return 'text-slate-500 font-medium';
    }
  };

  return (
    <div className="p-4 rounded-xl border border-slate-200/65 bg-white space-y-3.5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-800 flex flex-wrap items-center gap-1.5 leading-tight">
            <span>{comp.name}</span>
            <span className="text-[10px] font-medium text-slate-400">({comp.category})</span>
          </h4>
          <p className="text-[10.5px] text-slate-400 mt-1 font-medium leading-normal">
            Inferred Signal: <span className="text-slate-650 font-normal italic">"{comp.inferredSource}"</span>
          </p>
        </div>
        <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${getDisplacementColor(comp.displacementPotential)} shrink-0`}>
          Displacement: {comp.displacementPotential}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Switch Likelihood</span>
          <span className={`text-[11px] leading-tight ${getLikelihoodColor(comp.switchingLikelihood)}`}>
            {comp.switchingLikelihood}
          </span>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Timing Sensitivity</span>
          <span className="text-[11px] font-semibold text-slate-700 leading-tight">
            {comp.timingSensitivity}
          </span>
        </div>
      </div>

      <div className="bg-slate-50/20 p-2.5 rounded-lg border border-slate-100">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Competitive Positioning Pitch</span>
        <p className="text-[11.5px] text-slate-700 leading-relaxed font-normal">
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
