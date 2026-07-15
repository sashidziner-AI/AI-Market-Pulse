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

export interface BuyerPersona {
  role: string;
  painPoints: string[];
  valueAngle: string;
  counterNarratives?: ObjectionCounterNarrative[];
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

export interface DetailedAnalysis {
  score: number;
  rationale: string;
  signals: string[];
  buyerPersonas: BuyerPersona[];
  outreachStrategy: {
    emailHook: string;
    linkedinMessage: string;
  };
  competitors?: CompetingVendor[];
  multiThreadingStrategy?: MultiThreadingStrategy;
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

export interface SocialPost {
  date: string;
  summary: string;
  topic: 'product launch' | 'hiring' | 'thought leadership' | 'partnership' | 'funding' | 'culture' | 'other';
  engagementTier: 'high' | 'medium' | 'low';
  url?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  retweetCount?: number;
}

export interface SocialPlatformData {
  platform: 'linkedin' | 'instagram' | 'x' | 'facebook' | 'youtube';
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

export interface SavedReport {
  id: string;
  name: string;
  timestamp: string;
  analysis: BusinessAnalysis;
  accounts: TargetAccount[];
}

