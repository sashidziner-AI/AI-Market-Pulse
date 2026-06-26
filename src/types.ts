export interface BusinessAnalysis {
  businessName: string;
  overview: string;
  services: string[];
  valueProp: string;
  targetIndustries: string[];
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
  priorityFlag?: 'Immediate Action Required' | 'Nurture Queue' | 'Standard Follow-up' | 'Do Not Pursue';
  outreachAngle: string;
  status: 'new' | 'viewed' | 'contacted';
  outreachOutcome?: 'No Response' | 'Positive Reply' | 'Meeting Booked' | 'Deal Lost' | 'Deal Won';
  analysis?: DetailedAnalysis;
  isFallback?: boolean;
  
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

export interface SavedReport {
  id: string;
  name: string;
  timestamp: string;
  analysis: BusinessAnalysis;
  accounts: TargetAccount[];
}

