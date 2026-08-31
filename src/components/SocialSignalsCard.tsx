import React from 'react';
import {
  FaLinkedin, FaYoutube, FaXTwitter, FaInstagram, FaFacebook, FaRedditAlien,
} from 'react-icons/fa6';
import {
  Search, Globe, Newspaper, Briefcase, ExternalLink, RefreshCw, Radio, Zap,
  DollarSign, Users, Rocket, Handshake, Megaphone, TrendingUp, Cpu, Sparkles,
  Building2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SocialActivity, SocialPlatformData, SocialPlatformId, SocialPost, SocialPostTopic } from '@/types';

// ─── Platform registry ──────────────────────────────────────────────────────
// Fixed vertical order — the card always shows these 10 sections, filling
// empty ones with the "No significant activity" state so the layout is
// stable across accounts and refreshes.

interface PlatformMeta {
  id: SocialPlatformId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconTone: string;    // color for the icon glyph
  iconBg: string;      // tinted background behind the icon tile
}

const PLATFORMS: PlatformMeta[] = [
  { id: 'linkedin',        label: 'LinkedIn',        Icon: FaLinkedin,     iconTone: 'text-[#0A66C2]',                         iconBg: 'bg-[#0A66C2]/10' },
  { id: 'youtube',         label: 'YouTube',         Icon: FaYoutube,      iconTone: 'text-[#FF0000]',                         iconBg: 'bg-[#FF0000]/10' },
  { id: 'x',               label: 'X (Twitter)',     Icon: FaXTwitter,     iconTone: 'text-slate-900 dark:text-slate-100',     iconBg: 'bg-slate-900/10 dark:bg-slate-100/10' },
  { id: 'facebook',        label: 'Facebook',        Icon: FaFacebook,     iconTone: 'text-[#1877F2]',                         iconBg: 'bg-[#1877F2]/10' },
  { id: 'instagram',       label: 'Instagram',       Icon: FaInstagram,    iconTone: 'text-[#E4405F]',                         iconBg: 'bg-[#E4405F]/10' },
  { id: 'reddit',          label: 'Reddit',          Icon: FaRedditAlien,  iconTone: 'text-[#FF4500]',                         iconBg: 'bg-[#FF4500]/10' },
  { id: 'web',             label: 'Web Search',      Icon: Search,         iconTone: 'text-sky-600 dark:text-sky-400',         iconBg: 'bg-sky-500/10' },
  { id: 'company_website', label: 'Company Website', Icon: Globe,          iconTone: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/10' },
  { id: 'news',            label: 'Google News',     Icon: Newspaper,      iconTone: 'text-amber-600 dark:text-amber-400',     iconBg: 'bg-amber-500/10' },
  { id: 'jobs',            label: 'Job Boards',      Icon: Briefcase,      iconTone: 'text-purple-600 dark:text-purple-400',   iconBg: 'bg-purple-500/10' },
];

// ─── Category (topic) styling ───────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; pill: string; dot: string }> = {
  'hiring':             { label: 'Hiring',             pill: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60', dot: 'bg-emerald-500' },
  'expansion':          { label: 'Expansion',          pill: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60',                 dot: 'bg-teal-500' },
  'partnership':        { label: 'Partnership',        pill: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60',      dot: 'bg-indigo-500' },
  'product launch':     { label: 'Product Launch',     pill: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',                  dot: 'bg-blue-500' },
  'product update':     { label: 'Product Update',     pill: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60',                  dot: 'bg-cyan-500' },
  'event':              { label: 'Event',              pill: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-800/60', dot: 'bg-fuchsia-500' },
  'marketing':          { label: 'Marketing',          pill: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800/60',                  dot: 'bg-pink-500' },
  'customer success':   { label: 'Customer Success',   pill: 'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/40 dark:text-lime-300 dark:border-lime-800/60',                  dot: 'bg-lime-500' },
  'brand awareness':    { label: 'Brand Awareness',    pill: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',                  dot: 'bg-rose-500' },
  'brand mention':      { label: 'Brand Mention',      pill: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',                  dot: 'bg-rose-500' },
  'funding':            { label: 'Funding',            pill: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',            dot: 'bg-amber-500' },
  'media coverage':     { label: 'Media Coverage',     pill: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60',      dot: 'bg-orange-500' },
  'blog':               { label: 'Blog',               pill: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',                  dot: 'bg-slate-500' },
  'thought leadership': { label: 'Thought Leadership', pill: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/60',      dot: 'bg-violet-500' },
  'culture':            { label: 'Culture',            pill: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',                  dot: 'bg-rose-500' },
  'other':              { label: 'Update',             pill: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',                  dot: 'bg-slate-400' },
};

function categoryOf(topic: string): { label: string; pill: string; dot: string } {
  return CATEGORY_META[topic.toLowerCase()] ?? CATEGORY_META.other;
}

// ─── Buying Intent aggregation ──────────────────────────────────────────────
// Rolls up all platform-level signal strings + activity topics into a
// deduped set of intent categories, each with a short representative value
// pulled from the strongest evidence found across platforms.

interface BuyingIntent {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  count: number;
}

const INTENT_DEFS: Array<{
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: RegExp;
}> = [
  { key: 'funding',       label: 'Funding',             icon: DollarSign, keywords: /\b(seed|series [a-z]|round|raise[ds]?|funding|ipo|investor|valuation)\b/i },
  { key: 'hiring',        label: 'Hiring',              icon: Users,      keywords: /\b(hiring|hire|recruit|open role|jobs?|talent|headcount|onboard)\b/i },
  { key: 'product-launch',label: 'Product Launch',      icon: Rocket,     keywords: /\b(launch|release|ship|new (product|feature)|beta|ga|general availability|debut|unveil)\b/i },
  { key: 'partnership',   label: 'Partnership',         icon: Handshake,  keywords: /\b(partner|integration|alliance|collab)\b/i },
  { key: 'media',         label: 'Media Coverage',      icon: Megaphone,  keywords: /\b(featured|coverage|press|techcrunch|forbes|wsj|bloomberg|reuters|interview)\b/i },
  { key: 'expansion',     label: 'Business Expansion',  icon: TrendingUp, keywords: /\b(expand|open (a|new)|office|region|country|market entry|scale)\b/i },
  { key: 'ai',            label: 'AI Investment',       icon: Sparkles,   keywords: /\b(ai|artificial intelligence|ml|machine learning|gen[- ]?ai|llm)\b/i },
  { key: 'tech',          label: 'Technology Investment', icon: Cpu,      keywords: /\b(cloud|infrastructure|migration|modernization|platform|stack|kubernetes|devops)\b/i },
];

function aggregateIntent(data: SocialActivity | null): BuyingIntent[] {
  if (!data) return [];
  const evidence: string[] = [];
  for (const p of data.platforms ?? []) {
    for (const s of p.signals ?? []) evidence.push(s);
    for (const post of p.recentPosts ?? []) {
      evidence.push(`${post.topic} ${post.summary}`);
    }
  }
  const buckets = new Map<string, BuyingIntent>();
  for (const def of INTENT_DEFS) {
    const matches = evidence.filter((e) => def.keywords.test(e));
    if (matches.length === 0) continue;
    // Pick shortest match as the representative value — keeps the pill compact.
    const value = [...matches].sort((a, b) => a.length - b.length)[0].replace(/^\s*[-•*]\s*/, '').slice(0, 60);
    buckets.set(def.key, { key: def.key, label: def.label, icon: def.icon, value, count: matches.length });
  }
  return [...buckets.values()];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function looksLikeDirectUrl(url: string | undefined, platformId: SocialPlatformId): boolean {
  if (!url) return false;
  // Trust anything that's clearly a specific asset URL. Reject generic search
  // pages / homepages if we can identify them so the "View Source" link is
  // only shown when we actually point at the source item.
  const generic: Record<SocialPlatformId, RegExp[]> = {
    linkedin:        [/linkedin\.com\/?$/i, /linkedin\.com\/company\/[^/]+\/?$/i, /google\.com\/search/i],
    youtube:         [/youtube\.com\/?$/i, /youtube\.com\/@[^/]+\/?$/i, /google\.com\/search/i],
    x:               [/twitter\.com\/?$/i, /x\.com\/?$/i, /x\.com\/[^/]+\/?$/i, /twitter\.com\/[^/]+\/?$/i, /google\.com\/search/i],
    facebook:        [/facebook\.com\/?$/i, /facebook\.com\/[^/]+\/?$/i, /google\.com\/search/i],
    instagram:       [/instagram\.com\/?$/i, /instagram\.com\/[^/]+\/?$/i, /google\.com\/search/i],
    reddit:          [/reddit\.com\/?$/i, /reddit\.com\/r\/[^/]+\/?$/i, /google\.com\/search/i],
    web:             [/^https?:\/\/(www\.)?google\.com\/?$/i, /google\.com\/search\?q=[^&]*$/i],
    company_website: [],
    news:            [/^https?:\/\/news\.google\.com\/?$/i],
    jobs:            [/^https?:\/\/(www\.)?(linkedin\.com\/jobs|indeed\.com|glassdoor\.com)\/?$/i],
  };
  return !generic[platformId].some((rx) => rx.test(url));
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SocialSignalsCard({
  socialData,
  loading,
  onRefresh,
}: {
  socialData: SocialActivity | null;
  loading: boolean;
  onRefresh?: () => void;
}) {
  // Normalize incoming data into a fixed 10-slot map so the layout is stable.
  const byId = React.useMemo(() => {
    const m = new Map<SocialPlatformId, SocialPlatformData>();
    for (const p of socialData?.platforms ?? []) m.set(p.platform, p);
    return m;
  }, [socialData]);

  const intents = React.useMemo(() => aggregateIntent(socialData), [socialData]);

  const totalActivities = (socialData?.platforms ?? []).reduce((sum, p) => sum + p.recentPosts.length, 0);

  const isLive = !!socialData && !socialData.isFallback && !loading;
  const isSimulated = !!socialData?.isFallback && !loading;

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-left overflow-hidden">
      {/* Card header ----------------------------------------------------- */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-orange-50/40 to-transparent dark:from-orange-950/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                Social Signals
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60">
                Last 15 Days
              </span>
              {loading ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  Scanning
                </span>
              ) : isLive ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              ) : isSimulated ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                  Simulated
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {totalActivities > 0
                ? `${totalActivities} activit${totalActivities === 1 ? 'y' : 'ies'} across ${byId.size} platform${byId.size === 1 ? '' : 's'} in the last 15 days`
                : 'No activity captured across monitored platforms in the last 15 days.'}
            </p>
          </div>
        </div>

        {onRefresh && !loading && (
          <button
            onClick={onRefresh}
            title="Refresh social signals"
            className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </header>

      {/* Platform list --------------------------------------------------- */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {PLATFORMS.map((meta) => (
          <PlatformRow
            key={meta.id}
            meta={meta}
            data={byId.get(meta.id) ?? null}
          />
        ))}
      </div>

      {/* Buying Intent Signals ------------------------------------------- */}
      <div className="border-t border-slate-100 dark:border-slate-800 bg-gradient-to-b from-orange-50/40 to-transparent dark:from-orange-950/20 px-4 pt-4 pb-3">
        {/* Explicit simulated-data banner so users understand why the same
            chips (Hiring, Product Launch, …) appear across accounts when the
            /api/analyze-social call falls back to seed data. */}
        {isSimulated && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-semibold text-amber-800 dark:text-amber-200 leading-tight">
                Simulated demo signals
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-snug mt-0.5">
                The AI social-signal fetch fell back to seed data — the same chips will appear across accounts.
                Add a valid <code className="font-mono px-1 py-0 rounded bg-amber-100 dark:bg-amber-900/40">OPENAI_API_KEY</code> to <code className="font-mono px-1 py-0 rounded bg-amber-100 dark:bg-amber-900/40">.env</code> and click refresh for live per-account intent.
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-6 h-6 rounded-lg bg-orange-500 flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <h4 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Buying Intent Signals
          </h4>
          {intents.length > 0 && (
            <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60 text-[10px] font-semibold px-1.5 py-0">
              {intents.length} active
            </Badge>
          )}
        </div>

        {intents.length === 0 ? (
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 italic py-2">
            No buying-intent signals extracted from the last 15 days.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {intents.map((intent) => {
              const IntentIcon = intent.icon;
              return (
                <div
                  key={intent.key}
                  className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-orange-100 dark:border-orange-900/40 hover:border-orange-300 dark:hover:border-orange-700/60 transition-colors"
                  title={intent.value}
                >
                  <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center shrink-0">
                    <IntentIcon className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11.5px] font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                        {intent.label}
                      </span>
                      {isSimulated && (
                        <span className="text-[9px] font-mono uppercase tracking-[0.13em] px-1 py-0 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                          demo
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2 mt-0.5">
                      {intent.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center mt-3">
          All signals are from the last 15 days and indicate potential buying intent and business activity.
        </p>
      </div>
    </section>
  );
}

// ─── Platform row ───────────────────────────────────────────────────────────

function PlatformRow({ meta, data }: { meta: PlatformMeta; data: SocialPlatformData | null; key?: any }) {
  const activities = data?.recentPosts ?? [];
  const Icon = meta.Icon;
  const count = activities.length;

  return (
    <div className="px-4 py-3">
      {/* Header row: icon | name | count pill | (optional) profile URL */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-lg ${meta.iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-3.5 h-3.5 ${meta.iconTone}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[12.5px] font-semibold text-slate-900 dark:text-slate-100 truncate">{meta.label}</span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] font-semibold ${
                  count > 0
                    ? 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60'
                    : 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                }`}
              >
                {count} {count === 1 ? 'activity' : 'activities'}
              </span>
            </div>
            {data?.handle && (
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10.5px] text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:underline truncate block max-w-[200px]"
                title={data.url}
              >
                {data.handle}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Activities or empty state */}
      {activities.length === 0 ? (
        <div className="ml-9 flex items-center gap-2 text-[11.5px] text-slate-400 dark:text-slate-500 italic">
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          No significant activity found in the last 15 days.
        </div>
      ) : (
        <ul className="ml-9 space-y-1.5">
          {activities.map((activity, i) => (
            <ActivityItem key={i} activity={activity} platformId={meta.id} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Single activity ────────────────────────────────────────────────────────

function ActivityItem({ activity, platformId }: { activity: SocialPost; platformId: SocialPlatformId; key?: any }) {
  const cat = categoryOf(activity.topic);
  const hasDirectUrl = looksLikeDirectUrl(activity.url, platformId);

  return (
    <li className="group flex items-start gap-2.5 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 px-2 py-1.5 -mx-2 transition-colors">
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${cat.dot} shrink-0`} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] leading-snug text-slate-800 dark:text-slate-200 line-clamp-2">
          {activity.summary}
        </p>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0 rounded-md text-[9.5px] font-semibold border ${cat.pill}`}>
            {cat.label}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            {formatDate(activity.date)}
          </span>
          {hasDirectUrl ? (
            <a
              href={activity.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:underline"
            >
              View Source
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : (
            <span
              className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-slate-400 dark:text-slate-500 italic"
              title="No direct source URL was captured for this activity."
            >
              <Building2 className="w-2.5 h-2.5" />
              Source unavailable
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
