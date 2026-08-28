export interface BusinessAnalysis {
  businessName: string;
  overview: string;
  services: string[];
  valueProp: string;
  targetIndustries: string[];
  // Primary country the business operates from (full English name recognized
  // by Google Maps, e.g. "United States", "India"). AI-inferred during
  // analyze-business. Used by the Industry Discovery panel to scope Google
  // Maps searches to the seller's country.
  country?: string;
  icp: {
    title: string;
    description: string;
    targetRoles: string[];
    buyingSignals: string[];
  };
  isFallback?: boolean;
}

export interface IntelCitation {
  sourceTier: 'Primary' | 'Secondary' | 'Tertiary';
  sourceName: string;
  dateRetrieved: string; // e.g., "May 20, 2026"
  url?: string;
  isInferred?: boolean;
  confidenceScore?: number; // e.g., 65
  // AI-generated one-liner describing WHY this source qualifies as verified /
  // inferred for this specific account. When omitted the SourceCitation
  // component falls back to a generic hardcoded explainer.
  verificationNote?: string;
}

export interface AccountSignal {
  id: string;
  text: string;
  ageDays: number; // Age in days (e.g., 10 days ago, 200 days ago)
  citation?: IntelCitation;
}

export interface WarmIntroductionPath {
  type: 'vendor' | 'ecosystem' | 'investment' | 'association' | 'defined_network';
  name: string;
  description: string;
  introducedBy?: string;
}

export interface PathwayAssessment {
  approachType: 'Direct' | 'Channel Partner' | 'Integration Partner' | 'Mutual Connection';
  matchedChannelPartnerName?: string;
  warmIntroductionPaths: WarmIntroductionPath[];
  channelScore?: number; // channel-assisted conversion likelihood score (e.g. 1-100)
  distinctOutreachStrategy?: {
    headline: string;
    introHook: string;
    sequenceSteps: string[];
  };
}

export interface TargetAccount {
  id: string;
  name: string;
  domain: string;
  description: string;
  fitReason: string;
  signals: string[];
  signalsWithDates?: AccountSignal[]; // Structured signal items for decay
  fitScore: number;
  timingScore?: number;
  timingStage?: 'Early Awareness' | 'Active Evaluation' | 'Urgent Decision';
  outreachWindow?: string;
  priorityIndex?: number;
  priorityFlag?: 'Immediate Action Required' | 'Warm Track' | 'Standard Follow-up' | 'Do Not Pursue';
  outreachAngle: string;
  status: 'new' | 'viewed' | 'contacted';
  outreachOutcome?: 'No Response' | 'Positive Reply' | 'Meeting Booked' | 'Deal Lost' | 'Deal Won';
  analysis?: DetailedAnalysis;
  isFallback?: boolean;
  // Transient progress state while a streaming analyze-account call is in flight.
  // Cleared once the final result event arrives (analysis populates).
  analysisProgress?: {
    messages: string[];
    searches: string[];
  };
  
  // Firmographic fields for Disqualification / ICP Exclusion Engine
  employeeCount?: number;
  geography?: string;
  industry?: string;
  techStack?: string[];
  financialStatus?: string;
  isDisqualified?: boolean;
  disqualificationReasons?: string[];
  forcedSectorModel?: 'SaaS' | 'Manufacturing' | 'Fintech' | 'Biotech' | 'AEC' | 'General';
  pathway?: PathwayAssessment;
  socialActivity?: SocialActivity;
  voiceCall?: VoiceCallState;
  // Sync tracking — set after a successful push to the connected CRM.
  // Presence of crmSyncedAt is the source-of-truth "already synced" flag; the
  // record id is stored for future de-dupe / update flows.
  crmSyncedAt?: string;
  crmRecordId?: string | number;
  crmProvider?: string;
  // Cached snapshot of the CRM record hydrated on push / refresh / match.
  crmRecord?: CRMRecord;
}

export type CRMLeadStatus =
  | 'New'
  | 'Contacted'
  | 'Working'
  | 'Nurturing'
  | 'Qualified'
  | 'Unqualified';

export type CRMOpportunityStage =
  | 'None'
  | 'Prospecting'
  | 'Qualification'
  | 'Proposal'
  | 'Negotiation'
  | 'Closed Won'
  | 'Closed Lost';

export interface CRMActivity {
  id: string;
  type: 'note' | 'email' | 'call' | 'meeting' | 'stage_change' | 'sync';
  summary: string;
  at: string; // ISO
  actor?: string;
}

export interface CRMRecord {
  id: string | number;
  provider: string;
  name: string;
  domain?: string;
  email?: string;
  mobile?: string;
  linkedin?: string;
  course?: string;
  owner: string;
  leadStatus: CRMLeadStatus;
  opportunityStage: CRMOpportunityStage;
  lastActivityAt: string; // ISO
  createdAt: string;
  updatedAt: string;
  activities: CRMActivity[];
}

export type VoiceCallStatus =
  | 'queued'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'voicemail';

export type VoiceCallScript = 'discovery' | 'follow_up' | 'demo_booking';

export type VoiceCallOutcome =
  | 'interested'
  | 'not_interested'
  | 'meeting_booked'
  | 'callback_requested'
  | 'voicemail'
  | 'no_answer'
  | 'do_not_call';

export interface VoiceCallTranscriptLine {
  speaker: 'ai' | 'human';
  text: string;
  timestamp: string;
}

// Schedule for an AI call that should auto-initiate at a future time.
// Persisted in localStorage; a Dashboard-level poller launches the modal in
// auto-start mode when `scheduledFor` (a UTC ISO instant) is reached and the
// status is still 'pending'. The browser must be open at that time — this is
// a client-side scheduler, not a server cron.
export interface ScheduledCall {
  id: string;
  accountId: string;
  accountName: string;
  contactName: string;   // 'there' when the user left it blank
  script: VoiceCallScript;
  scheduledFor: string;  // absolute UTC ISO — already timezone-resolved
  timezone: string;      // IANA name captured at schedule time (audit/display)
  wallClockLabel: string;// human-readable "Jul 14, 2026 · 3:30 PM IST" for UI
  status: 'pending' | 'triggered' | 'cancelled' | 'failed';
  createdAt: string;     // ISO
  triggeredAt?: string;
  cancelledAt?: string;
  failureReason?: string;
  // How the AI should reach the contact at the scheduled time.
  //   'browser' — open the WebRTC modal in this tab (requires tab open + mic)
  //   'phone'   — Vapi dials `phoneNumber` in the background; no tab needed
  // Default 'browser' preserves the pre-Vapi behavior for older persisted rows.
  mode?: 'browser' | 'phone';
  phoneNumber?: string;  // E.164 (required when mode === 'phone')
  vapiCallId?: string;   // set after a successful phone-mode dial
}

export interface VoiceCallState {
  callId: string;
  status: VoiceCallStatus;
  script: VoiceCallScript;
  contactName: string;
  phoneNumber: string;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  transcript: VoiceCallTranscriptLine[];
  summary?: string;
  outcome?: VoiceCallOutcome;
  recordingUrl?: string;
  cost?: number;
  errorMessage?: string;
}

export interface ObjectionCounterNarrative {
  objection: string;
  reframingMessage: string;
  proofPoint: string;
  suggestedMoment: string;
}

// Objection Library: the 3-5 most common pushbacks THIS persona typically
// raises during evaluation (budget, timing, incumbent vendor, authority,
// need, trust). Each entry ships with a ready-to-say rebuttal so the rep
// isn't improvising mid-call. Distinct from counterNarratives, which reframe
// the value angle at the messaging layer.
export interface CommonObjection {
  objection: string;
  category: 'budget' | 'timing' | 'incumbent' | 'authority' | 'need' | 'trust' | 'other';
  response: string;
  evidence?: string;
}

export interface BuyerPersona {
  role: string;
  painPoints: string[];
  valueAngle: string;
  counterNarratives?: ObjectionCounterNarrative[];
  commonObjections?: CommonObjection[];
  citation?: IntelCitation;
}

export interface CompetingVendor {
  name: string;
  category: string;
  inferredSource: string;
  displacementPotential: 'Low' | 'Medium' | 'High';
  switchingLikelihood: 'Low' | 'Medium' | 'High';
  timingSensitivity: string;
  competitivePositioningAngle: string;
  citation?: IntelCitation;
}

export interface StakeholderNode {
  role: string;
  order: number;
  timing: string;
  messagingFocus: string;
  strategicRole: 'Entry Point' | 'Internal Champion' | 'Economic Buyer' | 'Technical Gatekeeper';
  tacticalTactic: string; // What key action or hook is used to engage them.
}

export interface MultiThreadingStrategy {
  accessibleEntryPoint: StakeholderNode;
  internalChampion: StakeholderNode;
  economicBuyer: StakeholderNode;
  technicalGatekeeper: StakeholderNode;
  sequencedMapDescription: string;
  coordinationRules: string[];
}

// Populated from web-search signals (LinkedIn Jobs listings, Crunchbase
// funding rounds, press releases). Optional because older cached analyses
// won't have them, and web_search may fail to surface either signal.
export interface HiringSignal {
  status: string; // e.g. "Actively hiring - Engineering & Sales (12+ open roles)"
  detail?: string; // Short qualitative note: "Recent surge in Ops hiring", etc.
  openRolesCount?: number;
  focusAreas?: string[]; // e.g. ["Sales", "Engineering", "Customer Success"]
  citation?: IntelCitation;
}

export interface FundingSignal {
  latestRound: string; // e.g. "Series C" | "Seed" | "Bootstrapped" | "IPO"
  amount?: string; // Human-formatted: "$45M", "€12M", "Undisclosed"
  date?: string; // ISO-ish date or free text: "2025-06" or "Q2 2025"
  leadInvestor?: string;
  detail?: string; // Short qualitative note
  citation?: IntelCitation;
}

export interface EmailTouch {
  day: number;                    // 1, 3, 7, 14 — sequence position (days from touch #1)
  type: 'cold' | 'case-study' | 'breakup' | 're-engage';
  subject: string;
  body: string;                   // 3–5 short paragraphs, no signature block (rep adds their own)
  signalUsed: string;             // short label of the buying signal that grounds this touch
  tone?: 'formal' | 'consultative' | 'direct';
}

export interface DetailedAnalysis {
  score: number;
  rationale: string;
  signals: string[];
  buyerPersonas: BuyerPersona[];
  outreachStrategy: {
    emailHook: string;
    linkedinMessage: string;
    emailSequence?: EmailTouch[]; // 4-touch outbound cadence, each grounded in a different signal
  };
  competitors?: CompetingVendor[];
  multiThreadingStrategy?: MultiThreadingStrategy;
  hiringSignal?: HiringSignal;
  fundingSignal?: FundingSignal;
  citation?: IntelCitation;
}

export interface AccountCluster {
  id: string;
  clusterName: string;
  characteristicType: string; // e.g., 'Industry Sub-vertical' | 'Growth Stage' | 'Tech Stack' | 'Hiring Patterns' | 'Revenue Band' | 'Operational Model'
  sharedCharacteristics: string[];
  accountIds: string[]; // references of TargetAccount.id
  collectiveAttractiveness: string;
  sharedPainPoints: string[];
  unifiedValueMessage: string;
  coordinatedOutreachAngle: string;
}

export type SocialPostTopic =
  | 'product launch' | 'product update' | 'hiring' | 'thought leadership'
  | 'partnership' | 'funding' | 'culture' | 'expansion' | 'event'
  | 'marketing' | 'customer success' | 'brand awareness' | 'brand mention'
  | 'media coverage' | 'blog' | 'other';

export interface SocialPost {
  date: string;
  summary: string;
  topic: SocialPostTopic;
  engagementTier: 'high' | 'medium' | 'low';
  url?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  retweetCount?: number;
}

export type SocialPlatformId =
  | 'linkedin' | 'instagram' | 'x' | 'facebook' | 'youtube'
  | 'reddit' | 'web' | 'company_website' | 'news' | 'jobs';

export interface SocialPlatformData {
  platform: SocialPlatformId;
  handle: string;
  url: string;
  followerEstimate?: number;
  postCount?: number;
  postingCadence: 'daily' | 'weekly' | 'monthly' | 'dormant';
  recentPosts: SocialPost[];
  signals: string[];
}

export interface SocialActivity {
  platforms: SocialPlatformData[];
  isFallback?: boolean;
}

// Battle Card — 1-page competitive intel packet a rep pulls up mid-call when
// they hear a specific competitor named. Distinct from CompetingVendor
// (which describes the incumbent at ONE account); this is the reusable
// battle-card for the competitor VENDOR itself.
export interface BattleCardWeakness {
  weakness: string;
  evidence: string;      // customer complaint / review site / product gap — cite when possible
  howToExploit: string;  // the follow-up question a rep should ask to make it visible
}

export interface BattleCardDifferentiator {
  claim: string;         // "We deploy in 2 weeks vs. their 90-day onboarding"
  proofPoint: string;    // metric / case study / feature grounding
}

export interface BattleCardObjection {
  theySay: string;       // the exact phrase from the buyer's mouth
  weSay: string;         // the rehearsed rebuttal — 2-3 sentences
  evidence?: string;
}

export interface BattleCardSwitchingStory {
  customerName: string;
  whenSwitched: string;  // "Q3 2025" | "March 2026"
  reason: string;
  outcome: string;
  citation?: IntelCitation;
}

export interface BattleCard {
  competitorName: string;
  competitorTagline: string;   // one-line positioning of the competitor
  theirStrengths: string[];    // 3-4 items — where they legitimately win (honest baseline)
  theirWeaknesses: BattleCardWeakness[];   // 4-5 items
  ourDifferentiators: BattleCardDifferentiator[]; // 4-5 items
  objectionResponses: BattleCardObjection[];      // 5 rehearsed "when they say X"
  switchingStories: BattleCardSwitchingStory[];   // 3 recent switchers
  generatedAt: string; // ISO
  isFallback?: boolean;
}

// Signal Change Alerts — a compact snapshot of an account's key fields taken
// at a point in time. Diffs across snapshots yield SignalChange records that
// power the header bell + Weekly Digest tab. Stored in localStorage under
// `gtm_account_snapshots`, capped at SNAPSHOT_MAX_KEEP entries.
export interface AccountSnapshot {
  takenAt: string; // ISO
  accounts: {
    id: string;
    name: string;
    domain: string;
    fitScore: number;
    priorityFlag?: TargetAccount['priorityFlag'];
    timingStage?: TargetAccount['timingStage'];
    signals: string[]; // shallow copy of TargetAccount.signals for diff detection
  }[];
}

export type SignalChangeKind =
  | 'moved_to_immediate'      // priorityFlag became 'Immediate Action Required'
  | 'moved_out_of_immediate'  // priorityFlag left 'Immediate Action Required'
  | 'new_signal'              // a signal string appeared that wasn't in prior snapshot
  | 'lost_signal'             // a signal string disappeared
  | 'fit_score_up'            // fitScore rose by ≥ FIT_SCORE_DELTA
  | 'fit_score_down'          // fitScore fell by ≥ FIT_SCORE_DELTA
  | 'timing_advanced'         // timingStage progressed (Early → Active → Urgent)
  | 'new_account';            // account discovered since prior snapshot

export interface SignalChange {
  id: string;                 // stable synthetic id for read-tracking
  accountId: string;
  accountName: string;
  accountDomain: string;
  kind: SignalChangeKind;
  impact: 'high' | 'medium' | 'low';
  detectedAt: string;         // ISO — when the diff was computed
  // Human-readable summary the UI renders directly.
  summary: string;
  // Field-level details when applicable.
  from?: string | number;
  to?: string | number;
  signal?: string;            // populated for new_signal / lost_signal
}

export interface SavedReport {
  id: string;
  name: string;
  timestamp: string;
  analysis: BusinessAnalysis;
  accounts: TargetAccount[];
}

