import React, { useState } from 'react';
import { BusinessAnalysis, TargetAccount } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { AccountCard, getAccountPriorityInfo } from './AccountCard';
import { AccountDetail } from './AccountDetail';
import { 
  BarChart3, Users, Zap, Briefcase, 
  Search, Filter, Plus, FileUp, Download, Play, LayoutGrid, List,
  LayoutDashboard, ListTodo, Radar, Network,
  ChevronDown, ChevronRight, Bell, Database, RefreshCw, CheckCircle2, CloudLightning, ArrowRight, ArrowLeft,
  Clock, TrendingUp, AlertTriangle, Lightbulb, Compass, Sparkles, FolderOpen, Sliders, Pencil, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { computeWeightsRecalibration, SellerChannelPartner, DEFAULT_CHANNEL_PARTNERS, computePathwayAssessment } from '../utils/calibration';

interface DashboardProps {
  analysis: BusinessAnalysis;
  accounts: TargetAccount[];
  isDiscovering: boolean;
  activeReportId?: string | null;
  savedReports?: any[];
  onAnalyzeAccount: (id: string) => void;
  onRefreshDiscovery: () => void;
  onUpdateAccount?: (account: TargetAccount) => void;
  onSaveReport?: (name: string, customAnalysis?: BusinessAnalysis, customAccounts?: TargetAccount[]) => string;
  onUpdateReport?: (updatedAnalysis: BusinessAnalysis, updatedAccounts: TargetAccount[]) => void;
  onUpdateReportMeta?: (id: string, name: string) => void;
  onBack?: () => void;
}

export function Dashboard({ 
  analysis, 
  accounts, 
  isDiscovering, 
  activeReportId,
  savedReports = [],
  onAnalyzeAccount,
  onRefreshDiscovery,
  onUpdateAccount,
  onSaveReport,
  onUpdateReport,
  onUpdateReportMeta,
  onBack
}: DashboardProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'pipeline' | 'clusters' | 'partner-pathways'>('recommendations');
  const [channelPartners, setChannelPartners] = useState<SellerChannelPartner[]>(() => {
    try {
      const saved = localStorage.getItem('gtm_channel_partners');
      return saved ? JSON.parse(saved) : DEFAULT_CHANNEL_PARTNERS;
    } catch {
      return DEFAULT_CHANNEL_PARTNERS;
    }
  });

  const [partnerEdits, setPartnerEdits] = useState<SellerChannelPartner | null>(null);
  const [isPartnerFormOpen, setIsPartnerFormOpen] = useState(false);
  const [partnerFormType, setPartnerFormType] = useState<'add' | 'edit'>('add');

  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerType, setNewPartnerType] = useState<'channel' | 'integration' | 'referral' | 'investor'>('channel');
  const [newPartnerKeywords, setNewPartnerKeywords] = useState('');
  const [newPartnerWarmContact, setNewPartnerWarmContact] = useState('');
  const [newPartnerDescription, setNewPartnerDescription] = useState('');
  const [newPartnerStrength, setNewPartnerStrength] = useState<'High' | 'Medium' | 'Low'>('Medium');

  const [selectedPathwayStrategyAccount, setSelectedPathwayStrategyAccount] = useState<TargetAccount | null>(null);

  const handleUpdateChannelPartners = (updated: SellerChannelPartner[]) => {
    setChannelPartners(updated);
    try {
      localStorage.setItem('gtm_channel_partners', JSON.stringify(updated));
    } catch (e) {
      console.log(e);
    }
    toast.success("Saved. Pathway assessments calibrated dynamically against the updated partner grid.");
  };

  const handleAddOrEditPartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName) {
      toast.error("Please enter a partner name");
      return;
    }

    const keywordArr = newPartnerKeywords.split(',').map(k => k.trim()).filter(Boolean);

    if (partnerFormType === 'add') {
      const newPartner: SellerChannelPartner = {
        id: `scp-manual-${Date.now()}`,
        name: newPartnerName,
        type: newPartnerType,
        keywords: keywordArr,
        warmContact: newPartnerWarmContact || undefined,
        description: newPartnerDescription,
        strength: newPartnerStrength
      };
      
      const updatedList = [newPartner, ...channelPartners];
      handleUpdateChannelPartners(updatedList);
    } else if (partnerFormType === 'edit' && partnerEdits) {
      const updatedList = channelPartners.map(p => 
        p.id === partnerEdits.id 
          ? {
              ...p,
              name: newPartnerName,
              type: newPartnerType,
              keywords: keywordArr,
              warmContact: newPartnerWarmContact || undefined,
              description: newPartnerDescription,
              strength: newPartnerStrength
            }
          : p
      );
      handleUpdateChannelPartners(updatedList);
    }

    // Reset controls
    setIsPartnerFormOpen(false);
    setPartnerEdits(null);
    setNewPartnerName('');
    setNewPartnerKeywords('');
    setNewPartnerWarmContact('');
    setNewPartnerDescription('');
  };

  const handleStartEditPartner = (partner: SellerChannelPartner) => {
    setPartnerEdits(partner);
    setPartnerFormType('edit');
    setNewPartnerName(partner.name);
    setNewPartnerType(partner.type);
    setNewPartnerKeywords(partner.keywords.join(', '));
    setNewPartnerWarmContact(partner.warmContact || '');
    setNewPartnerDescription(partner.description);
    setNewPartnerStrength(partner.strength || 'Medium');
    setIsPartnerFormOpen(true);
  };

  const handleDeletePartner = (id: string) => {
    const updated = channelPartners.filter(p => p.id !== id);
    handleUpdateChannelPartners(updated);
    toast.success("Referral network partner removed.");
  };

  const handleStartAddPartner = () => {
    setPartnerEdits(null);
    setPartnerFormType('add');
    setNewPartnerName('');
    setNewPartnerType('channel');
    setNewPartnerKeywords('');
    setNewPartnerWarmContact('');
    setNewPartnerDescription('');
    setNewPartnerStrength('Medium');
    setIsPartnerFormOpen(true);
  };
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [clusters, setClusters] = useState<any[]>([]);
  const [isClustering, setIsClustering] = useState<boolean>(false);

  // Rename current report states
  const [isRenameReportOpen, setIsRenameReportOpen] = useState(false);
  const [newReportName, setNewReportName] = useState('');

  // --- REPORT SAVING, EDITING, AND CUSTOM ACCOUNTS STATE ---
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [reportNameInput, setReportNameInput] = useState('');

  const [isEditReportOpen, setIsEditReportOpen] = useState(false);
  const [editBusinessName, setEditBusinessName] = useState(analysis?.businessName || '');
  const [editOverview, setEditOverview] = useState(analysis?.overview || '');
  const [editValueProp, setEditValueProp] = useState(analysis?.valueProp || '');
  const [editTargetIndustries, setEditTargetIndustries] = useState(() => (analysis?.targetIndustries || []).join(', '));
  const [editIcpTitle, setEditIcpTitle] = useState(analysis?.icp?.title || '');
  const [editIcpDescription, setEditIcpDescription] = useState(analysis?.icp?.description || '');
  const [editTargetRoles, setEditTargetRoles] = useState(() => (analysis?.icp?.targetRoles || []).join(', '));
  const [editBuyingSignals, setEditBuyingSignals] = useState(() => (analysis?.icp?.buyingSignals || []).join(', '));

  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccDomain, setNewAccDomain] = useState('');
  const [newAccOverview, setNewAccOverview] = useState('');
  const [newAccFitScore, setNewAccFitScore] = useState<number>(85);
  const [newAccTimingScore, setNewAccTimingScore] = useState<number>(75);
  const [newAccSignals, setNewAccSignals] = useState('');

  // Sync edit states when analysis changes
  React.useEffect(() => {
    if (analysis) {
      setEditBusinessName(analysis.businessName);
      setEditOverview(analysis.overview);
      setEditValueProp(analysis.valueProp);
      setEditTargetIndustries((analysis.targetIndustries || []).join(', '));
      setEditIcpTitle(analysis.icp?.title || '');
      setEditIcpDescription(analysis.icp?.description || '');
      setEditTargetRoles((analysis.icp?.targetRoles || []).join(', '));
      setEditBuyingSignals((analysis.icp?.buyingSignals || []).join(', '));
    }
  }, [analysis]);

  const handleSaveReportEdit = () => {
    const updatedAnalysis = {
      ...analysis,
      businessName: editBusinessName,
      overview: editOverview,
      valueProp: editValueProp,
      targetIndustries: editTargetIndustries.split(',').map(s => s.trim()).filter(Boolean),
      icp: {
        ...analysis.icp,
        title: editIcpTitle,
        description: editIcpDescription,
        targetRoles: editTargetRoles.split(',').map(s => s.trim()).filter(Boolean),
        buyingSignals: editBuyingSignals.split(',').map(s => s.trim()).filter(Boolean)
      }
    };

    if (onUpdateReport) {
      onUpdateReport(updatedAnalysis, accounts);
      toast.success("Saved report configurations updated successfully!");
    }
    setIsEditReportOpen(false);
  };

  const handleAddAccount = () => {
    if (!newAccName || !newAccDomain) {
      toast.error("Please fill in company name and domain URL");
      return;
    }

    const cleanDomain = newAccDomain.replace(/^(https?:\/\/)?(www\.)?/, '').trim().toLowerCase();

    const newAccount: TargetAccount = {
      id: `acc-manual-${Date.now()}`,
      name: newAccName,
      domain: cleanDomain,
      description: newAccOverview,
      fitReason: "Manually added via target account reports customize option.",
      signals: newAccSignals.split(',').map(s => s.trim()).filter(Boolean),
      fitScore: Number(newAccFitScore) || 85,
      timingScore: Number(newAccTimingScore) || 75,
      outreachAngle: `Enterprise Outreach focused on customized goals for ${newAccName}.`,
      status: 'new',
      isFallback: false
    };

    const updatedAccounts = [newAccount, ...accounts];
    if (onUpdateReport) {
      onUpdateReport(analysis, updatedAccounts);
      toast.success(`Successfully added target account "${newAccName}"!`);
    }

    // Reset input fields
    setNewAccName('');
    setNewAccDomain('');
    setNewAccOverview('');
    setNewAccFitScore(85);
    setNewAccTimingScore(75);
    setNewAccSignals('');
    setIsAddAccountOpen(false);
  };

  const handleDeleteAccountDirectly = (accId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const updated = accounts.filter(a => a.id !== accId);
    if (onUpdateReport) {
      onUpdateReport(analysis, updated);
      toast.success("Discovered account suggestion removed from report.");
    }
  };

  const triggerSaveReportInitiation = () => {
    // If active loaded report, find its current name. Otherwise default to GTM Outreach Plan: CompanyName
    let currentName = `Outreach Plan: ${analysis.businessName}`;
    if (activeReportId && savedReports.length > 0) {
      const match = savedReports.find(r => r.id === activeReportId);
      if (match) currentName = match.name;
    }
    setReportNameInput(currentName);
    setIsSaveModalOpen(true);
  };

  const handleExecuteSaveReport = () => {
    if (onSaveReport) {
      onSaveReport(reportNameInput);
      setIsSaveModalOpen(false);
    }
  };

  // CSV Exporter for local account recommendations
  const handleExportData = () => {
    if (sortedFilteredAccounts.length === 0) {
      toast.error("No account data available to export.");
      return;
    }

    const headers = [
      "Company Name",
      "Domain Name",
      "ICP Fit Score (%)",
      "Timing Score (%)",
      "Priority Index",
      "Priority Flag",
      "Applied Sector Model",
      "Outreach Window",
      "Disqualified",
      "Signals",
      "Fit / Discovery Reason",
      "Engagement Status"
    ];

    const rows = sortedFilteredAccounts.map(account => {
      const info = getAccountPriorityInfo(account);
      const signalsStr = (account.signals || []).join(" | ");
      return [
        account.name,
        account.domain,
        info.fitScore,
        info.timingScore,
        account.isDisqualified ? "EXCLUDED" : info.priorityIndex,
        account.isDisqualified ? "DO NOT PURSUE" : info.priorityFlag,
        info.appliedSectorModel,
        info.outreachWindow,
        account.isDisqualified ? "Yes" : "No",
        signalsStr,
        account.description || account.fitReason || "",
        account.status || "new"
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => 
        row.map(val => {
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
      link.setAttribute("download", `gtm_discovered_accounts_${analysis.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Successfully exported ${sortedFilteredAccounts.length} accounts to CSV!`);
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    }
  };

  const fetchClusters = async () => {
    if (accounts.length === 0) return;
    setIsClustering(true);
    try {
      const response = await fetch('/api/cluster-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts, businessContext: analysis })
      });
      const data = await response.json();
      setClusters(data);
    } catch (err) {
      console.log("Cluster generation signal:", err);
    } finally {
      setIsClustering(false);
    }
  };

  const accountsDependency = accounts.map(a => a.id).sort().join(',');
  React.useEffect(() => {
    fetchClusters();
  }, [accountsDependency]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'immediate' | 'nurture' | 'standard'>('all');

  // Dynamic Disqualification & Exclusion Engine States
  const [minSize, setMinSize] = useState<number>(50);
  const [maxSize, setMaxSize] = useState<number>(30000);

  const recalib = React.useMemo(() => {
    return computeWeightsRecalibration(accounts);
  }, [accounts]);
  const [excludedGeographies, setExcludedGeographies] = useState<string[]>([
    'Restricted Eurasia'
  ]);
  const [excludedIndustries, setExcludedIndustries] = useState<string[]>([
    'Military / Combat Systems',
    'Cryptocurrency / Web3'
  ]);
  const [excludedTechStacks, setExcludedTechStacks] = useState<string[]>([
    'COBOL Core',
    'COBOL Mainframe'
  ]);
  const [excludedFinancialStatuses, setExcludedFinancialStatuses] = useState<string[]>([
    'Layoffs',
    'Bankruptcy',
    'Cash-Strap Strain'
  ]);
  const [hideDisqualified, setHideDisqualified] = useState<boolean>(false);
  const [isICPExclusionPanelExpanded, setIsICPExclusionPanelExpanded] = useState<boolean>(false);

  // CRM Integration States
  const getCrmName = (type: string) => {
    if (type === 'hubspot') return 'HubSpot';
    if (type === 'salesforce') return 'Salesforce';
    if (type === 'pipedrive') return 'Pipedrive';
    if (type === 'prospectaccel') return 'Prospect Accel';
    return type;
  };

  const getCrmShortName = (type: string) => {
    if (type === 'hubspot') return 'HS';
    if (type === 'salesforce') return 'SF';
    if (type === 'pipedrive') return 'PD';
    if (type === 'prospectaccel') return 'PA';
    return type.slice(0, 2).toUpperCase();
  };

  const [isCrmOpen, setIsCrmOpen] = useState(false);
  const [crmConnected, setCrmConnected] = useState<'none' | 'hubspot' | 'salesforce' | 'pipedrive' | 'prospectaccel'>('none');
  const [selectedCrmType, setSelectedCrmType] = useState<'hubspot' | 'salesforce' | 'pipedrive' | 'prospectaccel'>('hubspot');
  const [crmStep, setCrmStep] = useState<1 | 2>(1);
  const [isCrmLoading, setIsCrmLoading] = useState(false);
  const [crmApiKey, setCrmApiKey] = useState('');
  const [crmUrl, setCrmUrl] = useState('');

  const handleConnectCrm = () => {
    setIsCrmLoading(true);
    setTimeout(() => {
      setIsCrmLoading(false);
      setCrmConnected(selectedCrmType);
      setIsCrmOpen(false);
      setCrmStep(1);
      toast.success(`${getCrmName(selectedCrmType)} connected successfully! Buyer intent signals are now syncing.`);
    }, 1500);
  };

  // Live Dynamic Disqualification Evaluation Engine
  const evaluateAccountDisqualification = React.useCallback((account: TargetAccount) => {
    const reasons: string[] = [];

    // 1. Min Size Exclusions (e.g. Under target headcount)
    if (account.employeeCount !== undefined && account.employeeCount < minSize) {
      reasons.push(`Company headcount of ${account.employeeCount} is under target minimum criteria of ${minSize} employees.`);
    }
    // 2. Max Size Exclusions (e.g. Too big or heavy enterprise)
    if (account.employeeCount !== undefined && account.employeeCount > maxSize) {
      reasons.push(`Company headcount of ${account.employeeCount} is over target maximum criteria of ${maxSize} employees.`);
    }

    // 3. Geography Exclusions
    if (account.geography && excludedGeographies.length > 0) {
      const matchGeo = excludedGeographies.some(geo => 
        account.geography?.toLowerCase().includes(geo.toLowerCase()) || 
        geo.toLowerCase().includes(account.geography?.toLowerCase() || '')
      );
      if (matchGeo) {
        reasons.push(`Based in excluded geographic region: "${account.geography}".`);
      }
    }

    // 4. Industry Exclusions
    if (account.industry && excludedIndustries.length > 0) {
      const matchInd = excludedIndustries.some(ind => 
        account.industry?.toLowerCase().includes(ind.toLowerCase()) ||
        ind.toLowerCase().includes(account.industry?.toLowerCase() || '')
      );
      if (matchInd) {
        reasons.push(`Operates in high-barrier/prohibited industry: "${account.industry}".`);
      }
    }

    // 5. Tech Stack Exclusions
    if (account.techStack && account.techStack.length > 0 && excludedTechStacks.length > 0) {
      const activeIncompatibility = account.techStack.filter(tech =>
        excludedTechStacks.some(bad => tech.toLowerCase().includes(bad.toLowerCase()))
      );
      if (activeIncompatibility.length > 0) {
        reasons.push(`Uses incompatible technology stack: ${activeIncompatibility.join(', ')}.`);
      }
    }

    // 6. Financial warning statuses
    if (excludedFinancialStatuses.length > 0) {
      const hasFinancialStrain = excludedFinancialStatuses.some(status => {
        const textToSearch = [
          account.financialStatus || '',
          account.description || '',
          account.fitReason || '',
          ...(account.signals || [])
        ].join(' ').toLowerCase();
        return textToSearch.includes(status.toLowerCase());
      });

      if (hasFinancialStrain) {
        reasons.push(`Financial indicators suggest budget unavailability: "${account.financialStatus || 'layoffs/financial strain'}"`);
      }
    }

    return {
      isDisqualified: reasons.length > 0,
      reasons
    };
  }, [minSize, maxSize, excludedGeographies, excludedIndustries, excludedTechStacks, excludedFinancialStatuses]);

  // Combined real-time evaluated accounts list
  const evaluatedAccounts = React.useMemo(() => {
    return accounts.map(account => {
      const dq = evaluateAccountDisqualification(account);
      return {
        ...account,
        isDisqualified: dq.isDisqualified,
        disqualificationReasons: dq.reasons
      };
    });
  }, [accounts, evaluateAccountDisqualification]);

  const selectedAccount = evaluatedAccounts.find(a => a.id === selectedAccountId);

  // Toggle filter logic
  const handleToggleFilter = (filterKey: string) => {
    setSelectedFilters(prev => 
      prev.includes(filterKey) 
        ? prev.filter(f => f !== filterKey) 
        : [...prev, filterKey]
    );
  };

  // Cohesive filter/search matching
  const filteredAccounts = React.useMemo(() => {
    return evaluatedAccounts.filter(account => {
      // If hiding disqualified accounts, actively filter them out from scoring views
      if (hideDisqualified && account.isDisqualified) {
        return false;
      }

      // Prioritization Queue Filter logic
      const info = getAccountPriorityInfo(account);
      if (priorityFilter === 'immediate' && info.priorityFlag !== 'Immediate Action Required') {
        return false;
      }
      if (priorityFilter === 'nurture' && info.priorityFlag !== 'Nurture Queue') {
        return false;
      }
      if (priorityFilter === 'standard' && info.priorityFlag !== 'Standard Follow-up') {
        return false;
      }

      // Search logic
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = account.name.toLowerCase().includes(query);
        const matchesDomain = account.domain.toLowerCase().includes(query);
        const matchesDesc = (account.description || account.fitReason || '').toLowerCase().includes(query);
        const matchesSignals = account.signals?.some(s => s.toLowerCase().includes(query));
        const matchesWindow = (info.outreachWindow || '').toLowerCase().includes(query);
        const matchesStage = (info.timingStage || '').toLowerCase().includes(query);
        if (!matchesName && !matchesDomain && !matchesDesc && !matchesSignals && !matchesWindow && !matchesStage) {
          return false;
        }
      }

      // Filters logic
      if (selectedFilters.length > 0) {
        return selectedFilters.every(filter => {
          if (filter === '70') {
            return (account.isDisqualified ? 0 : account.fitScore) >= 70;
          }
          if (filter === 'Enterprise') {
            const hasEnterpriseKeyword = 
              account.name.toLowerCase().includes('enterprise') ||
              (account.description || '').toLowerCase().includes('enterprise') ||
              (account.fitReason || '').toLowerCase().includes('enterprise') ||
              (account.description || '').toLowerCase().includes('b2b') ||
              account.signals?.some(s => s.toLowerCase().includes('enterprise') || s.toLowerCase().includes('b2b') || s.toLowerCase().includes('mid-market'));
            return hasEnterpriseKeyword;
          }
          if (filter === 'Funding') {
            const hasFundingKeyword = 
              (account.description || '').toLowerCase().includes('funding') ||
              (account.description || '').toLowerCase().includes('series') ||
              (account.description || '').toLowerCase().includes('raised') ||
              (account.description || '').toLowerCase().includes('million') ||
              (account.description || '').toLowerCase().includes('seed') ||
              (account.fitReason || '').toLowerCase().includes('funding') ||
              account.signals?.some(s => s.toLowerCase().includes('funding') || s.toLowerCase().includes('series') || s.toLowerCase().includes('raised') || s.toLowerCase().includes('acquired') || s.toLowerCase().includes('expansion'));
            return hasFundingKeyword;
          }
          return true;
        });
      }

      return true;
    });
  }, [evaluatedAccounts, hideDisqualified, searchQuery, selectedFilters, priorityFilter]);

  // Sort: Put disqualified ones at the bottom of standard list so they don't block high-priority
  const sortedFilteredAccounts = React.useMemo(() => {
    return [...filteredAccounts].sort((a, b) => {
      if (a.isDisqualified && !b.isDisqualified) return 1;
      if (!a.isDisqualified && b.isDisqualified) return -1;
      
      const infoA = getAccountPriorityInfo(a);
      const infoB = getAccountPriorityInfo(b);
      
      // Secondary: put re-research recommended lower than active prioritizable accounts
      if (infoA.reResearchRecommended && !infoB.reResearchRecommended) return 1;
      if (!infoA.reResearchRecommended && infoB.reResearchRecommended) return -1;
      
      return (infoB.priorityIndex ?? 0) - (infoA.priorityIndex ?? 0) || (infoB.fitScore ?? 0) - (infoA.fitScore ?? 0);
    });
  }, [filteredAccounts]);

  // Priority queue metrics for heat wave header (excluding strictly excluded/disqualified)
  const priorityOverview = React.useMemo(() => {
    let immediate = 0;
    let nurture = 0;
    let standard = 0;
    let doNotPursue = 0;
    
    evaluatedAccounts.forEach(acc => {
      const info = getAccountPriorityInfo(acc);
      if (acc.isDisqualified || info.priorityFlag === 'Do Not Pursue') {
        doNotPursue++;
      } else if (info.priorityFlag === 'Immediate Action Required') {
        immediate++;
      } else if (info.priorityFlag === 'Nurture Queue') {
        nurture++;
      } else {
        standard++;
      }
    });

    return {
      total: evaluatedAccounts.length - doNotPursue,
      immediate,
      nurture,
      standard,
      doNotPursue
    };
  }, [evaluatedAccounts]);

  // Compute stats based on accounts state (non-disqualified only)
  const metrics = React.useMemo(() => {
    const activeAccounts = evaluatedAccounts.filter(a => !a.isDisqualified);
    const highFitCount = activeAccounts.filter(a => a.fitScore >= 70).length;
    const allSignalsCount = activeAccounts.reduce((total, acc) => total + (acc.signals?.length || 0), 0);
    const trigCount = activeAccounts.filter(a => a.status === 'contacted').length;
    return {
      highFit: String(highFitCount),
      buyingSignals: String(allSignalsCount),
      liveTriggers: String(trigCount)
    };
  }, [evaluatedAccounts]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      setUploadedFile({ name: file.name, content: "Excel Worksheet Data" });
      toast.success(`Imported Excel worksheet "${file.name}" successfully! Click the "Run File" button to process.`);
    } else {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        setUploadedFile({ name: file.name, content: text });
        toast.success(`Imported text/CSV file "${file.name}" successfully! Click the "Run File" button to process.`);
      };
      reader.readAsText(file);
    }
  };

  const handleRunFile = () => {
    if (!uploadedFile) {
      toast.error("Please import a file first.");
      return;
    }
    
    if (uploadedFile.name.endsWith('.xlsx') || uploadedFile.name.endsWith('.xls')) {
      toast.info(`Extracting domains and syncing ICP targets from worksheet: ${uploadedFile.name}...`);
    } else if (uploadedFile.content) {
      const lines = uploadedFile.content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const startIdx = lines[0]?.toLowerCase().includes('domain') ? 1 : 0;
      const domains = lines.slice(startIdx, startIdx + 10);
      toast.info(`Extracting ${domains.length} target accounts from ${uploadedFile.name}...`);
    } else {
      toast.info(`Running process on ${uploadedFile.name}...`);
    }

    onRefreshDiscovery();
  };

  return (
    <div className="flex bg-slate-50 min-h-screen">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".csv,.txt,.xlsx,.xls" 
        className="hidden" 
      />
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white sticky top-0 h-screen hidden lg:flex flex-col flex-shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <span className="font-bold text-slate-900 tracking-tight text-base">AI Market Pulse</span>
          </div>

          <nav className="space-y-1">
            <SidebarItem icon={<LayoutDashboard />} label="Market Pulse" active={activeTab === 'recommendations'} onClick={() => setActiveTab('recommendations')} />
            <SidebarItem icon={<Users />} label="Smart Clusters" active={activeTab === 'clusters'} onClick={() => setActiveTab('clusters')} />
            <SidebarItem icon={<Network />} label="Partner Pathways" active={activeTab === 'partner-pathways'} onClick={() => setActiveTab('partner-pathways')} />
            <SidebarItem icon={<ListTodo />} label="GTM Pipeline" active={activeTab === 'pipeline'} onClick={() => setActiveTab('pipeline')} />
          </nav>

          {crmConnected !== 'none' && (
            <>
              <Separator className="my-6" />
              <div className="mt-4 px-2">
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                        {getCrmName(crmConnected).toUpperCase()} Connected
                      </span>
                    </div>
                    <button 
                      onClick={() => setIsCrmOpen(true)}
                      className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline transition-colors"
                    >
                      Manage
                    </button>
                  </div>
                  <div className="text-[9px] text-emerald-700 leading-normal">
                    Secure real-time sync active. Data refreshed hourly.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-auto p-4 border-t border-slate-100">
           <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
              <div className="text-xs font-bold text-indigo-900 mb-1">Business Context</div>
              <p className="text-[10px] text-indigo-700 font-medium mb-2 opacity-80">{analysis.businessName}</p>
              <div className="text-[10px] text-indigo-900 font-bold uppercase tracking-wider mb-1">ICP Target</div>
              <p className="text-[10px] text-indigo-700 leading-tight">{analysis.icp.title}</p>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex flex-col border-b border-slate-200 bg-white sticky top-0 z-20 font-sans select-none">
          {/* Row 1: Context, Navigation and CRM */}
          <div className="h-14 px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-1.5 text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-50 px-2.5 py-1 h-8 rounded-lg border border-slate-200 cursor-pointer"
                  onClick={onBack}
                  title="Go back to seller website adding page"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                  <span>Back</span>
                </Button>
              )}
              <h2 className="font-extrabold text-slate-900 text-sm md:text-base lg:text-lg tracking-tight">
                {activeTab === 'recommendations' ? 'Market Pulse' : 
                 activeTab === 'clusters' ? 'Strategic Account Clusters' : 
                 activeTab === 'partner-pathways' ? 'Partner Referral & Warm Pathways' : 'Pipeline'}
              </h2>
              <Badge variant="secondary" className="bg-emerald-55 bg-emerald-50 text-emerald-600 border border-emerald-100 font-mono font-bold text-[10px] px-2 py-0.5 rounded-full">
                {filteredAccounts.length} Leads
              </Badge>
            </div>

            <div className="flex items-center gap-3">
               <Button variant="ghost" size="icon" className="text-slate-400 relative hover:bg-slate-50 h-8 w-8 rounded-lg">
                 <Bell className="w-4 h-4" />
                 <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white" />
               </Button>
               <div className="h-6 w-[1px] bg-slate-200/80 mx-1" />
               <Button 
                 variant="outline" 
                 size="sm" 
                 className={`h-8 gap-1.5 text-xs transition-all ${crmConnected !== 'none' ? 'text-emerald-700 bg-emerald-50/75 border border-emerald-200 hover:bg-emerald-100/50 font-bold' : 'text-slate-650 hover:bg-slate-50'}`} 
                 onClick={() => setIsCrmOpen(true)}
               >
                 <Database className={`w-3.5 h-3.5 ${crmConnected !== 'none' ? 'text-emerald-600 animate-pulse' : 'text-indigo-500'}`} />
                 <span>{crmConnected !== 'none' ? `${crmConnected.charAt(0).toUpperCase() + crmConnected.slice(1)} Active` : 'Connect CRM'}</span>
               </Button>
            </div>
          </div>

          {/* Row 2: Campaign Scope Actions and Lead File Sync Controls */}
          <div className="h-12 px-8 flex items-center justify-between bg-slate-50/50 border-t border-slate-100">
            {/* Left side: Report Saved Status */}
            <div className="flex items-center gap-2">
              {activeReportId ? (
                <div className="flex items-center gap-1.5 group/header-title animate-fadeIn">
                  <span className="text-[11px] bg-indigo-50 border border-indigo-150 text-indigo-700 px-2.5 py-0.5 rounded-md font-bold font-sans flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0" />
                    <span className="truncate max-w-[150px] md:max-w-[240px]">Target Unit: {savedReports.find(r => r.id === activeReportId)?.name || 'Saved Plan'}</span>
                  </span>
                  <button
                    onClick={() => {
                      const rep = savedReports.find(r => r.id === activeReportId);
                      if (rep) {
                        setNewReportName(rep.name);
                        setIsRenameReportOpen(true);
                      }
                    }}
                    className="opacity-0 group-hover/header-title:opacity-100 hover:text-indigo-600 text-slate-400 p-1 bg-white hover:bg-slate-100 rounded border border-slate-150 shadow-xxs transition-all cursor-pointer inline-flex items-center"
                    title="Rename Current Saved Plan"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="text-[11px] bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-0.5 rounded-md font-bold font-sans flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0 animate-pulse" />
                  <span>Interactive Outreach Draft</span>
                </span>
              )}
            </div>

            {/* Right side Actions: Save Scope, Edit Blueprint, Download Template, Import Lead List */}
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto scrollbar-none">
              {onSaveReport && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={triggerSaveReportInitiation}
                  className="h-8 text-[11px] font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 rounded-lg border-0 cursor-pointer transition-all shadow-2xs shrink-0"
                  title="Save current analysis and target list view"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>{activeReportId ? 'Save As' : 'Save Scope'}</span>
                </Button>
              )}
              {onUpdateReport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditReportOpen(true)}
                  className="h-8 text-[11px] font-bold gap-1 px-3 rounded-lg border-slate-200 hover:bg-sky-50/20 text-slate-650 cursor-pointer bg-white shrink-0"
                  title="Configure Ideal Customer Profile and analysis parameters"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Blueprint</span>
                </Button>
              )}
              
              <div className="h-4 w-[1px] bg-slate-200/80 mx-1 shrink-0" />
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-[11px] text-slate-500 hover:text-indigo-600 hover:bg-slate-50 flex items-center gap-1 px-2.5 rounded-lg border border-dashed border-slate-200 bg-white/70 select-none cursor-pointer shrink-0"
                onClick={() => {
                  const headers = "Domain,Company Name,Target Tech,Industry\nexample.com,Example Corp,React | Figma,Technology\nanthropic.com,Anthropic,Python | AWS,Artificial Intelligence\nopenai.com,OpenAI,Node | Google Cloud,Artificial Intelligence\n";
                  const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.setAttribute("href", url);
                  link.setAttribute("download", "gtm_accounts_template.csv");
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast.success("Accounts template CSV downloaded!");
                }}
              >
                <Download className="w-3.5 h-3.5 text-slate-400" /> 
                <span className="hidden sm:inline">Download Template</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                className={`h-8 gap-1 text-[11px] font-semibold bg-white shrink-0 cursor-pointer ${uploadedFile ? 'bg-emerald-50 text-emerald-700 border-emerald-250' : 'border-slate-200 text-slate-650 hover:bg-slate-50'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="w-3.5 h-3.5 text-slate-400" /> 
                <span>{uploadedFile ? `Imported: ${uploadedFile.name.substring(0, 12)}${uploadedFile.name.length > 12 ? '...' : ''}` : 'Import CSV'}</span>
              </Button>

              {uploadedFile && (
                <Button 
                  size="sm" 
                  className="h-8 bg-indigo-650 hover:bg-indigo-700 text-white gap-1 shadow-2xs text-[11px] px-3 font-bold animate-in fade-in slide-in-from-right duration-200 shrink-0 cursor-pointer" 
                  onClick={handleRunFile} 
                  disabled={isDiscovering}
                >
                  {isDiscovering ? <Zap className="w-3.5 h-3.5 animate-pulse" /> : <Play className="w-3.5 h-3.5" />}
                  <span>Run</span>
                </Button>
              )}
            </div>
          </div>
        </header>

        <section className="p-8 flex-1">
          <div className="max-w-6xl mx-auto space-y-8">
            {analysis.isFallback && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 flex items-start gap-3 shadow-xs animate-in fade-in duration-300">
                <CloudLightning className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-900">Gemini Live API Quota Reached (Free Tier Quota of 20 API Calls)</h4>
                  <p className="text-[11px] text-amber-850 leading-relaxed max-w-4xl">
                    You have temporarily exceeded your Gemini free-tier daily or rate limit of 20 requests. To prevent interruptions, 
                    <strong> GTM Intelligence has automatically activated localized high-fidelity simulated backups</strong>, 
                    allowing you to fully test corporate persona mapping, account discovery, and competitive vendor displacement.
                  </p>
                  <p className="text-[11px] text-amber-900 font-semibold mt-1">
                    👉 To restore real-time live AI requests: Go to the "Settings &gt; Secrets" menu and declare your custom <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[10px]">GEMINI_API_KEY</code>.
                  </p>
                </div>
              </div>
            )}

            {/* Adaptive Scoring Intelligence Board */}
            {recalib.hasFeedback && (
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-lg space-y-4 relative overflow-hidden animate-in fade-in duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/25 via-transparent to-slate-900/10 pointer-events-none" />
                
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 text-left">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block mr-1" />
                      <span>Adaptive Closed-Loop Active</span>
                    </div>
                    <h3 className="text-base font-black tracking-tight font-sans flex items-center gap-2">
                      <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
                      Continuous Score Optimization Engine
                    </h3>
                  </div>

                  <div className="text-[10px] font-mono font-medium text-slate-450 text-left md:text-right">
                    <span>Analyzed <strong className="font-extrabold text-white">{accounts.filter(a => !!a.outreachOutcome).length}</strong> commercial outcomes</span>
                  </div>
                </div>

                <p className="text-xs text-slate-350 leading-relaxed max-w-4xl font-sans font-normal text-left">
                  Your recorded campaign results are actively reshaping future score calibrations. The model matches incoming operational triggers to your actual sales closures to maximize conversion alignment.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1.5 text-left relative">
                  {/* Calibrated Multipliers Column */}
                  <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-3">
                    <div className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider font-mono">Dynamic Signal Calibrations</div>
                    
                    {recalib.appliedBoosts.length === 0 && recalib.appliedPenalties.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic font-normal py-1">Scoring weights configured at standard sector parity. Continue logging outcomes to drive calibrations.</p>
                    ) : (
                      <ul className="space-y-2 text-xs">
                        {recalib.appliedBoosts.map((boost, idx) => (
                          <li key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/15">
                            <span className="font-bold text-slate-200">✨ {boost.category}: <span className="text-emerald-400">+{boost.boostPercent}% Priority Boost</span></span>
                            <span className="text-[9.5px] text-slate-450 shrink-0 font-medium">{boost.rationale.split(':')[0]}</span>
                          </li>
                        ))}
                        {recalib.appliedPenalties.map((penalty, idx) => (
                          <li key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-800/30 border border-slate-800">
                            <span className="font-bold text-slate-400">⚡ {penalty.category}: <span className="text-slate-400">-{penalty.penaltyPercent}% Weight Penalty</span></span>
                            <span className="text-[9.5px] text-slate-450 shrink-0 font-medium">{penalty.rationale.split(':')[0]}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Warning Profiles Column */}
                  <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-3">
                    <div className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider font-mono">Closed-Loop Custody & Risk Flags</div>
                    
                    {recalib.sectorCautions.length === 0 && recalib.sizeCautions.length === 0 && recalib.financialCautions.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic font-normal py-1">No cautionary flags compiled yet. No high-risk pipeline trends detected.</p>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-slate-350">
                        {recalib.sectorCautions.map((sector, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-amber-300/90 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span>Risk sector active: {sector} accounts consistently result in lost deals</span>
                          </li>
                        ))}
                        {recalib.sizeCautions.map((band, idx) => {
                          const sizeLabel = band === 'small' ? 'Under 50 employees' : band === 'medium' ? '50-250 employees' : 'Over 250 employees';
                          return (
                            <li key={idx} className="flex items-center gap-2 text-amber-300/90 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                              <span>Scale cautions: Accounts scaling ({sizeLabel}) show poor engagement ratios</span>
                            </li>
                          );
                        })}
                        {recalib.financialCautions.map((fin, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-amber-300/90 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span>Budget freeze flag: "{fin}" profiles carry strong lost deal correlations</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Interactive GTM Outreach priority wave segments */}
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                GTM Outreach Priority Waves & Intent Timing
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div 
                  onClick={() => setPriorityFilter('all')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${priorityFilter === 'all' ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-550/20' : 'border-slate-200/60 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Compass className="w-4 h-4 text-indigo-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">All Candidates</span>
                  </div>
                  <div className="text-2xl font-black text-slate-800 font-mono">{priorityOverview.total}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Total identified opportunities</div>
                </div>

                <div 
                  onClick={() => setPriorityFilter('immediate')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative overflow-hidden ${priorityFilter === 'immediate' ? 'border-rose-500 bg-rose-50/25 ring-1 ring-rose-300' : 'border-slate-200/60 bg-white hover:bg-slate-50'}`}
                >
                  {priorityOverview.immediate > 0 && (
                    <span className="absolute top-2 right-2 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingUp className="w-4 h-4 text-rose-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Immediate Action</span>
                  </div>
                  <div className="text-2xl font-black text-rose-700 font-mono">{priorityOverview.immediate}</div>
                  <div className="text-[10px] text-slate-500 mt-1">High ICP fit + urgent buyers</div>
                </div>

                <div 
                  onClick={() => setPriorityFilter('nurture')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${priorityFilter === 'nurture' ? 'border-teal-500 bg-teal-50/25 ring-1 ring-teal-300' : 'border-slate-200/60 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Clock className="w-4 h-4 text-teal-600" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nurture Queue</span>
                  </div>
                  <div className="text-2xl font-black text-teal-700 font-mono">{priorityOverview.nurture}</div>
                  <div className="text-[10px] text-slate-500 mt-1">High ICP fit, early awareness</div>
                </div>

                <div 
                  onClick={() => setPriorityFilter('standard')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${priorityFilter === 'standard' ? 'border-slate-550 bg-slate-50/40 ring-1 ring-slate-350/20' : 'border-slate-200/60 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Lightbulb className="w-4 h-4 text-slate-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Standard follow-up</span>
                  </div>
                  <div className="text-2xl font-black text-slate-750 font-mono">{priorityOverview.standard}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Normal buying evaluation cycle</div>
                </div>
              </div>
            </div>

            {/* ICP Exclusion & Disqualification Signal Controls */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-sm transition-all text-left">
              <div 
                onClick={() => setIsICPExclusionPanelExpanded(!isICPExclusionPanelExpanded)}
                className="p-5 flex items-center justify-between cursor-pointer bg-slate-50/50 hover:bg-slate-50/80 transition-colors border-b border-slate-100 select-none pb-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-xl text-red-600 border border-red-100 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex flex-wrap items-center gap-2">
                      ICP Exclusion & Automated Disqualification Engine
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-red-700 bg-red-100/80 border border-red-200">
                        {priorityOverview.doNotPursue} Account{priorityOverview.doNotPursue === 1 ? '' : 's'} Excluded
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">Configure thresholds and signal exclusions to isolate poor-fit, low-priority candidates.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] font-bold font-mono uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">Live Scoring Exclusion: Active</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-405 transition-transform duration-300 ${isICPExclusionPanelExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isICPExclusionPanelExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden border-t border-slate-100"
                  >
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        {/* Header / Config controls */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">1. Company Headcount Exclusions</h4>
                            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-150 space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] text-slate-500 font-semibold">Min Headcount Target:</span>
                                <span className="text-xs font-black text-slate-700 font-mono">{minSize} employees</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                step="5"
                                value={minSize} 
                                onChange={(e) => setMinSize(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <p className="text-[10px] text-slate-400 italic">Disqualifies residential boutiques and local studios below headcount bounds.</p>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">2. Geographic Boundaries Exclusions</h4>
                            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-150 space-y-2">
                              <p className="text-[10px] text-slate-450 mb-2">Exclude campaigns from regions with trade blocks, complex timezone issues, or structural barriers:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {['Restricted Eurasia', 'LATAM', 'APAC', 'Eastern Europe', 'Western Europe'].map((geo) => {
                                  const active = excludedGeographies.includes(geo);
                                  return (
                                    <button
                                      key={geo}
                                      onClick={() => {
                                        setExcludedGeographies(prev => 
                                          prev.includes(geo) ? prev.filter(g => g !== geo) : [...prev, geo]
                                        );
                                      }}
                                      className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                        active 
                                          ? 'bg-red-50 border-red-200 text-red-700' 
                                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-105'
                                      }`}
                                    >
                                      {active ? '❌ ' : ''}{geo}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">3. Prohibited/Restricted Sectors Exclusions</h4>
                            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-150 space-y-2">
                              <p className="text-[10px] text-slate-450 mb-2">Exclude fields experiencing public sovereignty blocks, intense ITAR security, or high general volatility:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {['Military / Combat Systems', 'Cryptocurrency / Web3', 'Gambling', 'Local Boutique Design', 'Healthcare Tech', 'Enterprise Software'].map((ind) => {
                                  const active = excludedIndustries.includes(ind);
                                  return (
                                    <button
                                      key={ind}
                                      onClick={() => {
                                        setExcludedIndustries(prev => 
                                          prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
                                        );
                                      }}
                                      className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                        active 
                                          ? 'bg-red-50 border-red-200 text-red-700' 
                                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-105'
                                      }`}
                                    >
                                      {active ? '❌ ' : ''}{ind}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">4. Technology Incompatibilities & Financial Strains</h4>
                            <div className="grid grid-cols-2 gap-3 text-left">
                              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-150">
                                <span className="text-[10px] font-bold text-slate-500 block mb-1.5">Legacy Core Tech:</span>
                                <div className="flex flex-wrap gap-1">
                                  {['COBOL Mainframe', 'Revit', 'MicroStation'].map(tech => {
                                    const active = excludedTechStacks.includes(tech);
                                    return (
                                      <button
                                        key={tech}
                                        onClick={() => {
                                          setExcludedTechStacks(prev => 
                                            prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]
                                          );
                                        }}
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                                          active ? 'bg-red-50 border-red-200 text-red-700 font-extrabold shadow-xxs' : 'bg-white border-slate-150 text-slate-500 hover:bg-slate-105'
                                        }`}
                                      >
                                        {tech}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              
                              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-150">
                                <span className="text-[10px] font-bold text-slate-500 block mb-1.5">Financial Stress:</span>
                                <div className="flex flex-wrap gap-1">
                                  {['Layoffs', 'Bankruptcy', 'Cash-Strap Strain'].map(stress => {
                                    const active = excludedFinancialStatuses.includes(stress);
                                    return (
                                      <button
                                        key={stress}
                                        onClick={() => {
                                          setExcludedFinancialStatuses(prev => 
                                            prev.includes(stress) ? prev.filter(s => s !== stress) : [...prev, stress]
                                          );
                                        }}
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                                          active ? 'bg-red-50 border-red-200 text-red-700 font-extrabold shadow-xxs' : 'bg-white border-slate-150 text-slate-500 hover:bg-slate-105'
                                        }`}
                                      >
                                        {stress}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Button
                            variant={hideDisqualified ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => setHideDisqualified(!hideDisqualified)}
                            className="gap-2 text-[11px] font-extrabold h-9 cursor-pointer"
                          >
                            {hideDisqualified ? '👁️ Show Excluded Accounts' : '🙈 Hide Disqualified From Grid'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setMinSize(0);
                              setMaxSize(50000);
                              setExcludedGeographies([]);
                              setExcludedIndustries([]);
                              setExcludedTechStacks([]);
                              setExcludedFinancialStatuses([]);
                              toast.success('Exclusion criteria completely reset. All account fit scores updated in real time.');
                            }}
                            className="text-slate-500 h-9 font-bold text-[11.5px] hover:text-indigo-650 cursor-pointer"
                          >
                            Clear Exclusions
                          </Button>
                        </div>
                        <div className="text-right text-[11px] text-slate-500 font-medium">
                          💡 Exclusions automatically override indices: Forced to <span className="font-bold text-red-650 font-mono">0% fit</span> with priority flagged as <span className="font-semibold text-red-700 bg-red-50 border border-red-200 px-1 rounded">Do Not Pursue</span>.
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md shadow-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search industries, signals, or domains..." 
                  className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-slate-850"
                />
              </div>
              {/* Intelligent Filter Badges & View Switches & Export */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 overflow-x-auto">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedFilters([])}
                    className={`gap-2 h-8 text-xs text-slate-500 border rounded-lg ${selectedFilters.length === 0 ? 'bg-slate-105 border-slate-200 text-slate-800' : 'border-transparent hover:border-slate-200'}`}
                  >
                    <Filter className="w-3.5 h-3.5" /> All
                  </Button>
                  <Badge 
                    variant={selectedFilters.includes('70') ? 'default' : 'outline'} 
                    onClick={() => handleToggleFilter('70')}
                    className="h-8 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors border-slate-200 select-none px-3 font-medium text-xs text-slate-700"
                  >
                    Score 70+
                  </Badge>
                  <Badge 
                    variant={selectedFilters.includes('Enterprise') ? 'default' : 'outline'} 
                    onClick={() => handleToggleFilter('Enterprise')}
                    className="h-8 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors border-slate-200 select-none px-3 font-medium text-xs text-slate-700"
                  >
                    Enterprise
                  </Badge>
                  <Badge 
                    variant={selectedFilters.includes('Funding') ? 'default' : 'outline'} 
                    onClick={() => handleToggleFilter('Funding')}
                    className="h-8 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors border-slate-200 select-none px-3 font-medium text-xs text-slate-700"
                  >
                    Recent Funding
                  </Badge>
                </div>

                {(activeTab === 'recommendations' || activeTab === 'pipeline') && (
                  <>
                    <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />

                    {/* Grid/List View switcher */}
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className={`h-7 px-2.5 rounded-md text-xs gap-1 cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-550 hover:text-slate-850'}`}
                        title="Grid View"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span className="sr-only sm:not-sr-only sm:text-[10px]">Grid</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className={`h-7 px-2.5 rounded-md text-xs gap-1 cursor-pointer transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-550 hover:text-slate-850'}`}
                        title="List View"
                      >
                        <List className="w-3.5 h-3.5" />
                        <span className="sr-only sm:not-sr-only sm:text-[10px]">List</span>
                      </Button>
                    </div>

                    <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />

                    {/* Export Action */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportData}
                      className="h-8 text-xs font-semibold gap-1.5 px-3 rounded-lg border-slate-250 hover:bg-indigo-50/50 hover:text-indigo-650 hover:border-indigo-200 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-550" />
                      <span>Export Data</span>
                    </Button>

                    {/* Manually Add Tailored Enterprise Account */}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setIsAddAccountOpen(true)}
                      className="h-8 text-xs font-bold gap-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Target Account</span>
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isDiscovering && accounts.length === 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
                        <div className="flex justify-between items-start">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-8 w-12 rounded-lg" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                        <div className="flex gap-2">
                           <Skeleton className="h-6 w-16 rounded-full" />
                           <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                    </div>
                 ))}
               </div>
            ) : activeTab === 'pipeline' ? (
              /* GTM Kanban Sprint Board View */
              viewMode === 'grid' ? (
                <div className="flex flex-row gap-6 font-sans overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-300 w-full snap-x">
                  <div className="min-w-[280px] sm:min-w-[320px] lg:min-w-[350px] flex-1 snap-start">
                    <PipelineColumn 
                      title="To Engage" 
                      description="Newly identified accounts"
                      count={filteredAccounts.filter(a => (a.status === 'new' || !a.status) && !a.isDisqualified).length}
                      accounts={filteredAccounts.filter(a => (a.status === 'new' || !a.status) && !a.isDisqualified)}
                      onAnalyzeAccount={onAnalyzeAccount}
                      setSelectedAccountId={setSelectedAccountId}
                      onUpdateStatus={onUpdateAccount}
                      targetRoles={analysis.icp.targetRoles}
                      onDelete={handleDeleteAccountDirectly}
                    />
                  </div>
                  
                  <div className="min-w-[280px] sm:min-w-[320px] lg:min-w-[350px] flex-1 snap-start">
                    <PipelineColumn 
                      title="Reviewing" 
                      description="Pre-outreach target audits"
                      count={filteredAccounts.filter(a => a.status === 'viewed' && !a.isDisqualified).length}
                      accounts={filteredAccounts.filter(a => a.status === 'viewed' && !a.isDisqualified)}
                      onAnalyzeAccount={onAnalyzeAccount}
                      setSelectedAccountId={setSelectedAccountId}
                      onUpdateStatus={onUpdateAccount}
                      targetRoles={analysis.icp.targetRoles}
                      onDelete={handleDeleteAccountDirectly}
                    />
                  </div>

                  <div className="min-w-[280px] sm:min-w-[320px] lg:min-w-[350px] flex-1 snap-start">
                    <PipelineColumn 
                      title="Enrolled" 
                      description="Campaign triggered / Outreach sent"
                      count={filteredAccounts.filter(a => a.status === 'contacted' && !a.isDisqualified).length}
                      accounts={filteredAccounts.filter(a => a.status === 'contacted' && !a.isDisqualified)}
                      onAnalyzeAccount={onAnalyzeAccount}
                      setSelectedAccountId={setSelectedAccountId}
                      onUpdateStatus={onUpdateAccount}
                      targetRoles={analysis.icp.targetRoles}
                      onDelete={handleDeleteAccountDirectly}
                    />
                  </div>
                </div>
              ) : (
                /* GTM Pipeline List View */
                <div className="flex flex-col gap-3.5 animate-fadeIn">
                  {filteredAccounts.filter(a => !a.isDisqualified).map((account) => {
                    const info = getAccountPriorityInfo(account);
                    const isEnrolled = account.status === 'contacted';
                    const isReviewing = account.status === 'viewed';
                    const isToEngage = !account.status || account.status === 'new';

                    return (
                      <motion.div
                        layout
                        key={account.id}
                        whileHover={{ x: 4 }}
                        onClick={() => {
                          onAnalyzeAccount(account.id);
                          setSelectedAccountId(account.id);
                        }}
                        className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left font-sans"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5 font-sans">
                            <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-base truncate">
                              {account.name}
                            </h3>
                            <div className="flex items-center text-xs text-slate-450 gap-1 font-mono font-normal">
                              <span>({account.domain})</span>
                            </div>

                            {/* Status identifier badge */}
                            {isEnrolled && (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 uppercase flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                Enrolled
                              </span>
                            )}
                            {isReviewing && (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider text-amber-700 bg-amber-50 border border-amber-100 uppercase flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Reviewing
                              </span>
                            )}
                            {isToEngage && (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider text-slate-650 bg-slate-50 border border-slate-200 uppercase flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                To Engage
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-505 text-slate-500 line-clamp-1 mb-2 font-normal leading-normal">
                            {account.description || account.fitReason}
                          </p>

                          <div className="flex flex-wrap gap-1.5">
                            {account.signals?.slice(0, 3).map((sig, sIdx) => (
                              <span key={sIdx} className="text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                                {sig}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Weighted score details right-aligned */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-5 sm:self-center shrink-0">
                          <div className="text-left sm:text-right">
                            <div className="text-[10px] text-slate-450 font-mono font-bold uppercase tracking-wider mb-0.5">Weighted Score</div>
                            <div className="text-sm font-extrabold text-slate-850 text-slate-800 font-mono">
                              {info.priorityIndex} <span className="text-[11px] text-slate-400 font-normal">pts</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Move stage buttons */}
                            {onUpdateAccount && (
                              <div className="flex items-center gap-1">
                                {isToEngage && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateAccount({ ...account, status: 'viewed' });
                                      toast.success(`Moved "${account.name}" to Reviewing stage`);
                                    }}
                                    className="h-8 text-xs font-semibold px-2.5 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 border-slate-200 text-slate-605"
                                  >
                                    Review
                                  </Button>
                                )}
                                {(isToEngage || isReviewing) && (
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateAccount({ ...account, status: 'contacted' });
                                      toast.success(`Enrolled "${account.name}" into campaign outreach`);
                                    }}
                                    className="h-8 text-xs font-bold px-2.5 bg-indigo-650 hover:bg-indigo-700 text-white border-0"
                                  >
                                    Enroll
                                  </Button>
                                )}
                                {isEnrolled && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateAccount({ ...account, status: 'viewed' });
                                      toast.success(`Returned "${account.name}" to Reviewing`);
                                    }}
                                    className="h-8 text-xs font-semibold px-2.5 text-slate-450 hover:text-slate-805"
                                  >
                                    Revert Stage
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {filteredAccounts.filter(a => !a.isDisqualified).length === 0 && (
                    <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white p-6">
                      <p className="text-slate-500 text-sm font-medium">No accounts in active GTM Pipeline.</p>
                    </div>
                  )}
                </div>
              )
            ) : activeTab === 'clusters' ? (
              /* Account Clusters View */
              <div className="space-y-6">
                {/* Top stats explanation banner */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md border border-slate-800">
                   <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/40 via-transparent to-slate-900 opacity-80" />
                   <div className="relative space-y-2 max-w-2xl text-left">
                     <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10.5px] font-black uppercase tracking-wider border border-indigo-500/30">
                       <Users className="w-3" />
                       <span>Cluster Campaign Automation</span>
                     </div>
                     <h3 className="text-xl font-black tracking-tight text-white font-sans">Coordinated Pattern Targeting</h3>
                     <p className="text-xs text-slate-300 leading-relaxed font-sans font-normal">
                       Instead of treating every account as an isolated outpost, focus on cohesive, high-density similarity groups.
                       Run coordinated, template-driven campaigns targeting verified operational commonalities for maximum resonance.
                     </p>
                   </div>

                   <div className="relative shrink-0 flex items-center gap-2">
                     <Button 
                       onClick={fetchClusters} 
                       disabled={isClustering}
                       size="sm"
                       className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-4 rounded-xl shadow-xs transition-colors flex items-center gap-2 text-xs border-0"
                     >
                       <RefreshCw className={`w-4 h-4 ${isClustering ? 'animate-spin' : ''}`} />
                       {isClustering ? 'Analyzing Clusters...' : 'Recalculate Clusters'}
                     </Button>
                   </div>
                </div>

                {isClustering ? (
                  <div className="space-y-6">
                    {[1, 2].map(i => (
                      <div key={i} className="p-6 rounded-3xl bg-white border border-slate-150 animate-pulse space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="space-y-2 w-1/3">
                            <div className="h-6 bg-slate-200 rounded"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                          </div>
                          <div className="h-6 bg-slate-200 rounded w-24"></div>
                        </div>
                        <div className="h-4 bg-slate-200 rounded w-full"></div>
                        <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                        <div className="flex gap-2">
                          <div className="h-6 bg-slate-150 rounded w-20"></div>
                          <div className="h-6 bg-slate-150 rounded w-20"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : clusters.length === 0 ? (
                  <div className="text-center py-24 bg-white border border-dashed border-slate-205 rounded-3xl p-6">
                    <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-sm font-bold text-slate-800 font-sans">No Target Clusters Formed</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed font-sans font-normal">
                      Clusters require active discovered or imported accounts to formulate similarities of scale. Use the "Discovery" tab or upload custom accounts first.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {clusters.map((cluster) => {
                      // Find the actual accounts matching this cluster
                      const matchedAccounts = evaluatedAccounts.filter(a => cluster.accountIds?.includes(a.id));
                      
                      return (
                        <div key={cluster.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xxs hover:shadow-xs transition-all text-left space-y-6 relative overflow-hidden">
                          {/* Accent left highlight */}
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                          
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 font-sans">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-[17px] font-black text-slate-900 tracking-tight leading-snug">{cluster.clusterName}</h3>
                                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                  {cluster.characteristicType}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                                Formulated based on structural characteristics across <span className="font-extrabold text-slate-805 font-mono">{matchedAccounts.length} account{matchedAccounts.length === 1 ? '' : 's'}</span>
                              </p>
                            </div>
                            
                            {/* Copy action */}
                            <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-xs font-semibold gap-1.5 h-8.5 px-3 rounded-lg border-slate-250 cursor-pointer"
                                onClick={() => {
                                  navigator.clipboard.writeText(cluster.unifiedValueMessage);
                                  toast.success("Unified value message copied beautifully to clipboard!");
                                }}
                              >
                                Copy Value Message
                              </Button>
                            </div>
                          </div>

                          {/* Characteristics Badges */}
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-wrap gap-2 items-center">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mr-2 font-mono">Core Commonalities:</span>
                            {cluster.sharedCharacteristics?.map((char: string, cIdx: number) => (
                              <span key={cIdx} className="text-[10.5px] font-extrabold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-xxs font-sans">
                                ✨ {char}
                              </span>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                            {/* Attractiveness & Pain Points */}
                            <div className="space-y-5">
                              <div className="space-y-2 text-left">
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-sans flex items-center gap-1.5">
                                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                                  <span>Collective Attractiveness & ROI Drivers</span>
                                </h4>
                                <p className="text-xs text-slate-650 leading-relaxed font-sans font-normal bg-emerald-50/10 p-3.5 rounded-2xl border border-emerald-100/20">
                                  {cluster.collectiveAttractiveness}
                                </p>
                              </div>

                              <div className="space-y-2 text-left">
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-sans flex items-center gap-1.5">
                                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                                  <span>Shared Common Bottlenecks</span>
                                </h4>
                                <ul className="space-y-2 text-xs text-slate-600 font-sans">
                                  {cluster.sharedPainPoints?.map((pain: string, pIdx: number) => (
                                    <li key={pIdx} className="flex items-start gap-2.5 bg-rose-50/5 p-3 rounded-2xl border border-rose-100/10">
                                      <span className="text-rose-500 shrink-0 select-none text-base leading-none">▪</span>
                                      <span className="leading-relaxed font-normal">{pain}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {/* Campaign Pattern & Target Cards */}
                            <div className="space-y-5">
                              <div className="space-y-2 text-left bg-gradient-to-br from-indigo-50/10 via-slate-50/10 to-transparent p-4.5 rounded-2xl border border-slate-100">
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-950 font-sans flex items-center gap-1.5 mb-2">
                                  <Zap className="w-4 h-4 text-indigo-500" />
                                  <span>Unified Outreach Pitch Template</span>
                                </h4>
                                <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 italic leading-relaxed font-medium shadow-xxs">
                                  "{cluster.unifiedValueMessage}"
                                </div>
                                <div className="pt-3 px-1 text-[11px] text-slate-500 leading-relaxed font-sans">
                                  <strong className="font-extrabold uppercase text-[10px] text-indigo-650 block mb-0.5 tracking-wider font-mono">Coordinated Outreach Angle:</strong>
                                  <span className="font-normal">{cluster.coordinatedOutreachAngle}</span>
                                </div>
                              </div>

                              <div className="space-y-2 text-left">
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-sans flex items-center gap-1.5">
                                  <Users className="w-4 h-4 text-slate-400" />
                                  <span>Mapped Accounts in Cluster ({matchedAccounts.length})</span>
                                </h4>
                                {matchedAccounts.length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic py-2 font-normal">No active accounts matched with exclusion rules applied.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {matchedAccounts.map((acc) => (
                                      <div 
                                        key={acc.id}
                                        onClick={() => {
                                          onAnalyzeAccount(acc.id);
                                          setSelectedAccountId(acc.id);
                                        }}
                                        className="flex items-center justify-between p-3 rounded-xl border border-slate-150 bg-slate-50/50 hover:bg-indigo-50/30 hover:border-indigo-200 transition-colors cursor-pointer text-left group"
                                      >
                                        <div className="space-y-0.5 min-w-0 pr-2">
                                          <div className="font-bold text-xs text-slate-800 group-hover:text-indigo-950 truncate">{acc.name}</div>
                                          <div className="text-[10px] font-mono text-slate-450 truncate">{acc.domain}</div>
                                        </div>
                                        <span className="text-[10.5px] font-extrabold font-mono text-indigo-650 shrink-0">
                                          {acc.fitScore}% →
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeTab === 'partner-pathways' ? (
              /* New Partner Referral & Warm Pathways View */
              <div className="space-y-8 animate-fadeIn text-left">
                {/* Pathway Engine Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md border border-slate-800">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-transparent to-transparent opacity-60" />
                  <div className="relative space-y-2 max-w-2xl">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/25 text-indigo-300 text-[10.5px] font-black uppercase tracking-wider border border-indigo-500/30">
                      <Network className="w-3" />
                      <span>Warm Referral & Alliance Intelligence</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-black tracking-tight text-white font-sans">Dynamic Partner Pathways</h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans font-normal">
                      Bypass cold calling. The system scans tech stack ecosystems, investor alliances, and vendor networks 
                      to calculate warm intro triggers. Matches accounts dynamically based on keywords and relationship strengths.
                    </p>
                  </div>
                  <div className="relative shrink-0">
                    <Button 
                      onClick={handleStartAddPartner}
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-5 rounded-xl shadow-xs border-0 flex items-center gap-2 text-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Define Warm Network</span>
                    </Button>
                  </div>
                </div>

                {/* Pathway Stats Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Warm Pathways Found</div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-indigo-600 font-sans">
                        {filteredAccounts.map(a => getAccountPriorityInfo(a)).filter(p => (p.pathway?.warmIntroductionPaths?.length ?? 0) > 0).length}
                      </span>
                      <span className="text-xs font-bold text-slate-405 text-slate-500">
                        ({Math.round((filteredAccounts.map(a => getAccountPriorityInfo(a)).filter(p => (p.pathway?.warmIntroductionPaths?.length ?? 0) > 0).length / (filteredAccounts.length || 1)) * 100)}%)
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active warm intro doors open
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Direct Cold Approach</div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-slate-700 font-sans font-sans">
                        {filteredAccounts.map(a => getAccountPriorityInfo(a)).filter(p => (p.pathway?.warmIntroductionPaths?.length ?? 0) === 0).length}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        ({Math.round((filteredAccounts.map(a => getAccountPriorityInfo(a)).filter(p => (p.pathway?.warmIntroductionPaths?.length ?? 0) === 0).length / (filteredAccounts.length || 1)) * 100)}%)
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-405 bg-slate-400" /> Cold outreach default index
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Avg. Conversion Likelihood</div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-emerald-600 font-sans font-sans">
                        {Math.round(
                          filteredAccounts.map(a => getAccountPriorityInfo(a)).reduce((sum, curr) => sum + (curr.pathway?.channelScore || 32), 0) / (filteredAccounts.length || 1)
                        )}%
                      </span>
                      <span className="text-xs font-bold text-emerald-500">
                        ▲ Lifted
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-505 bg-emerald-500 animate-pulse" /> Assisted vs cold conversion lift
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Defined Networks</div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-indigo-900 font-sans">
                        {channelPartners.length}
                      </span>
                      <span className="text-xs font-bold text-slate-500">Alliances</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Live scanning active
                    </div>
                  </div>
                </div>

                {/* Main splitting columns for Desktop */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                  {/* Left list: Account assessments */}
                  <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                      <div className="px-6 py-5 border-b border-slate-150 flex items-center justify-between">
                        <div className="text-left space-y-0.5">
                          <h4 className="font-bold text-sm text-slate-900 font-sans">Dynamic Account Pathway Matrix</h4>
                          <p className="text-[11px] text-slate-500">
                            Scanned accounts mapped in order of warm conversion capability.
                          </p>
                        </div>
                        <Badge variant="outline" className="text-slate-550 border-slate-200 text-[10px]">
                          Sorted by Conversion Score
                        </Badge>
                      </div>

                      {filteredAccounts.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 italic">No target accounts found.</div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {filteredAccounts
                            .map(account => ({ account, info: getAccountPriorityInfo(account) }))
                            .sort((a, b) => (b.info.pathway?.channelScore ?? 0) - (a.info.pathway?.channelScore ?? 0))
                            .map(({ account: acc, info }) => {
                              const pathway = info.pathway;
                              const wsFound = (pathway?.warmIntroductionPaths?.length ?? 0) > 0;
                              return (
                                <div key={acc.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                  <div className="space-y-1.5 text-left min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-extrabold text-sm text-slate-900 truncate">{acc.name}</span>
                                      <span className="text-[10.5px] font-mono text-slate-400">({acc.domain})</span>
                                      
                                      {/* Approach Type Tag */}
                                      {pathway?.approachType === 'Direct' ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100/80 text-slate-600 border border-slate-200 uppercase tracking-wider font-mono">
                                          Direct Outreach
                                        </span>
                                      ) : pathway?.approachType === 'Channel Partner' ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wider font-mono">
                                          Channel Partner Pathway
                                        </span>
                                      ) : pathway?.approachType === 'Integration Partner' ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider font-mono">
                                          Integration Partner Pathway
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100 uppercase tracking-wider font-mono">
                                          Mutual Warm Referral
                                        </span>
                                      )}
                                    </div>
                                    
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-normal">
                                      {acc.description || "No company overview provided."}
                                    </p>

                                    {/* Mapped warm introduction pathways detail tags */}
                                    {wsFound && pathway && (
                                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Paths Tracked:</span>
                                        {pathway.warmIntroductionPaths.map((p, pIdx) => {
                                          let colorCode = 'bg-slate-50 text-slate-600 border-slate-200';
                                          if (p.type === 'vendor') colorCode = 'bg-sky-50 text-sky-700 border-sky-100';
                                          if (p.type === 'ecosystem') colorCode = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                                          if (p.type === 'investment') colorCode = 'bg-rose-50 text-rose-700 border-rose-100';
                                          if (p.type === 'association') colorCode = 'bg-amber-50 text-amber-705 text-amber-850 border-amber-150';
                                          if (p.type === 'defined_network') colorCode = 'bg-emerald-50 text-emerald-800 border-emerald-150 font-bold';

                                          return (
                                            <Badge key={pIdx} variant="outline" className={`text-[9.5px] py-0.5 px-2 rounded-lg font-sans ${colorCode}`} title={p.description}>
                                              {p.name}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Right side alignment conversion scoring */}
                                  <div className="flex items-center gap-4.5 justify-between md:justify-end shrink-0">
                                    <div className="text-left md:text-right space-y-0.5 min-w-[120px]">
                                      <div className="text-[9px] text-slate-400 uppercase font-black font-mono tracking-wider">Likelihood Score</div>
                                      <div className="flex items-baseline gap-1 mt-0.5">
                                        <span className="text-lg font-black text-slate-900 font-sans">{(pathway?.channelScore ?? 32)}%</span>
                                        <span className="text-[9.5px] text-slate-450 font-mono">Assisted</span>
                                      </div>
                                      <div className="text-[9.5px] font-mono text-slate-400">
                                        Direct Fit: {acc.fitScore}%
                                      </div>
                                    </div>
                                    
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedPathwayStrategyAccount(acc)}
                                      className="border-indigo-150 text-indigo-700 hover:text-indigo-805 hover:bg-indigo-50/40 text-xs font-bold rounded-xl h-9 px-3.5 cursor-pointer shadow-3xs"
                                    >
                                      {wsFound ? 'Warm outreach' : 'Direct Strategy'}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right list: Partner configurations */}
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-left space-y-0.5">
                          <h4 className="font-bold text-sm text-slate-900 font-sans">Active Partners Grid</h4>
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Configure networks scanned by the matching engine.
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={handleStartAddPartner}
                          className="h-8 w-8 text-indigo-600 hover:text-indigo-800 hover:bg-slate-50 border border-slate-100 rounded-lg cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="space-y-3 max-h-[850px] overflow-y-auto pr-1">
                        {channelPartners.map((partner) => (
                          <div key={partner.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2 text-left relative group/opt">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-800 truncate pr-5">{partner.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  partner.strength === 'High' ? 'bg-emerald-500' :
                                  partner.strength === 'Medium' ? 'bg-amber-400' : 'bg-slate-400'
                                }`} title={`Relationship: ${partner.strength}`}/>
                                <Badge variant="outline" className="text-[8.5px] uppercase px-1 rounded bg-white border-slate-200 shrink-0 font-mono text-slate-500 tracking-wider">
                                  {partner.type}
                                </Badge>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-500 leading-relaxed font-normal line-clamp-2">
                              {partner.description}
                            </p>

                            <div className="flex flex-wrap gap-1">
                              {partner.keywords.map((kw, kwIdx) => (
                                <span key={kwIdx} className="text-[9px] font-mono bg-white text-slate-450 border border-slate-200/50 px-1.5 py-0.2 rounded font-medium">
                                  #{kw}
                                </span>
                              ))}
                            </div>

                            {partner.warmContact && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 font-sans">
                                <span className="font-bold text-slate-500">Contact:</span>
                                <span>{partner.warmContact}</span>
                              </div>
                            )}

                            {/* Hover Options */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/opt:opacity-100 transition-opacity bg-slate-50 pl-2 rounded">
                              <button 
                                onClick={() => handleStartEditPartner(partner)}
                                className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 cursor-pointer shadow-3xs"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                              <button 
                                onClick={() => handleDeletePartner(partner.id)}
                                className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-slate-50 cursor-pointer shadow-3xs"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inline Form Card to add/edit channel partner dynamically */}
                {isPartnerFormOpen && (
                  <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-3xl p-6 shadow-md space-y-4 font-sans mt-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="font-extrabold text-sm text-slate-900 font-sans">
                        {partnerFormType === 'add' ? 'Define New Referral Partner or Network' : 'Edit Alliance Network Configuration'}
                      </h4>
                      <Button variant="ghost" size="sm" onClick={() => setIsPartnerFormOpen(false)} className="text-slate-400 hover:text-slate-700 h-8 px-2 cursor-pointer">
                        Cancel
                      </Button>
                    </div>

                    <form onSubmit={handleAddOrEditPartnerSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Name */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Partner Name *</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Autodesk Systems Alliance, Gensler Partners" 
                          value={newPartnerName}
                          onChange={(e) => setNewPartnerName(e.target.value)}
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/40 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      {/* Connection Type */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Connection Type</label>
                        <select 
                          value={newPartnerType} 
                          onChange={(e: any) => setNewPartnerType(e.target.value)}
                          className="w-full text-xs h-9 px-2 rounded-lg border border-slate-200 bg-slate-50/40 focus:ring-1 focus:ring-indigo-500 outline-none"
                        >
                          <option value="channel">Channel Partner / Distributor</option>
                          <option value="integration">Integration Partner / ISV Alliance</option>
                          <option value="referral">Mutual Connection / Referral Network</option>
                          <option value="investor">Accelerator / Investor Syndicate</option>
                        </select>
                      </div>

                      {/* Strength */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Alliance Strength</label>
                        <select 
                          value={newPartnerStrength} 
                          onChange={(e: any) => setNewPartnerStrength(e.target.value)}
                          className="w-full text-xs h-9 px-2 rounded-lg border border-slate-200 bg-slate-50/40 focus:ring-1 focus:ring-indigo-500 outline-none"
                        >
                          <option value="High">High (Direct trusted referral pipeline)</option>
                          <option value="Medium">Medium (Loose association / shared board portfolio)</option>
                          <option value="Low">Low (Passive vendor alignment only)</option>
                        </select>
                      </div>

                      {/* Warm Contact */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Key Warm Contact Name/Title</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Sarah Jenkins (VP Global Alliances)" 
                          value={newPartnerWarmContact}
                          onChange={(e) => setNewPartnerWarmContact(e.target.value)}
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/40 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      {/* Keywords */}
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Keyword Match Tags (comma separated) *</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. autodesk, revit, bim, drafting, series a" 
                          value={newPartnerKeywords}
                          onChange={(e) => setNewPartnerKeywords(e.target.value)}
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/40 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                        <p className="text-[9.5px] text-slate-400 leading-normal">
                          Keywords are matched against target account description, industry, funding signals, and tech stack tags.
                        </p>
                      </div>

                      {/* Description */}
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Strategic Partner Footprint</label>
                        <textarea 
                          rows={2}
                          placeholder="Brief description of the alliance scope, shared workflows, or reference portfolios..." 
                          value={newPartnerDescription}
                          onChange={(e) => setNewPartnerDescription(e.target.value)}
                          className="w-full text-xs p-3 rounded-lg border border-slate-200 bg-slate-50/40 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                        />
                      </div>

                      <div className="md:col-span-2 text-right pt-2">
                        <Button 
                          type="submit" 
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold h-10 px-6 rounded-xl shadow-md border-0 text-xs cursor-pointer"
                        >
                          {partnerFormType === 'add' ? 'Save New Partner' : 'Apply Configuration'}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              /* Standard Pulse/Discovery Grid View */
              <motion.div 
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn"
              >
                <AnimatePresence mode="popLayout">
                  {sortedFilteredAccounts.map((account) => (
                    <AccountCard 
                      key={account.id} 
                      account={account} 
                      targetRoles={analysis.icp.targetRoles}
                      onStatusChange={onUpdateAccount ? (newStatus) => onUpdateAccount({ ...account, status: newStatus }) : undefined}
                      onDelete={handleDeleteAccountDirectly}
                      onClick={(acc) => {
                        onAnalyzeAccount(acc.id);
                        setSelectedAccountId(acc.id);
                      }} 
                    />
                  ))}
                </AnimatePresence>
                {sortedFilteredAccounts.length === 0 && accounts.length > 0 && (
                  <div className="col-span-full py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white p-6">
                    <p className="text-slate-500 text-sm font-medium">No results match your search or filter configuration.</p>
                    <Button 
                      variant="link" 
                      onClick={() => { setSearchQuery(''); setSelectedFilters([]); }} 
                      className="text-indigo-600 mt-2 h-auto p-0"
                    >
                      Clear search filters
                    </Button>
                  </div>
                )}
              </motion.div>
            ) : (
              /* Standard Pulse/Discovery Compact List View */
              <div className="flex flex-col gap-3.5 animate-fadeIn">
                {sortedFilteredAccounts.map((account) => {
                  const info = getAccountPriorityInfo(account);
                  const scoreColor = account.isDisqualified
                    ? 'text-red-700 bg-red-50 border-red-150'
                    : info.fitScore >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 
                                    info.fitScore >= 60 ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-slate-600 bg-slate-50 border-slate-100';

                  const timingColor = account.isDisqualified
                    ? 'text-red-700 bg-red-50 border-red-150'
                    : info.timingScore >= 80 ? 'text-rose-700 bg-rose-50 border-rose-100' :
                                     info.timingScore >= 60 ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-purple-700 bg-purple-50 border-purple-100';

                  const priorityColor = account.isDisqualified
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : info.priorityIndex >= 80 ? 'text-indigo-700 bg-indigo-50 border-indigo-150' :
                                        info.priorityIndex >= 60 ? 'text-slate-700 bg-slate-100 border-slate-200' : 'text-slate-500 bg-slate-50 border-slate-100';

                  return (
                    <motion.div
                      layout
                      key={account.id}
                      whileHover={{ x: 4 }}
                      onClick={() => {
                        onAnalyzeAccount(account.id);
                        setSelectedAccountId(account.id);
                      }}
                      className={`p-4 rounded-xl bg-white border transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left ${
                        account.isDisqualified ? 'border-red-200 bg-red-50/5' : 'border-slate-200 hover:border-indigo-300 shadow-2xs hover:shadow-xs'
                      }`}
                    >
                      {/* Name & Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5 font-sans">
                          <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-base truncate">
                            {account.name}
                          </h3>
                          <div className="flex items-center text-xs text-slate-450 gap-1 font-mono font-normal">
                            <span>({account.domain})</span>
                          </div>
                          
                          {/* Priority flag badge */}
                          {account.isDisqualified ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider text-red-750 bg-red-100 border border-red-200 uppercase">
                              Excluded
                            </span>
                          ) : info.reResearchRecommended ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider text-amber-700 bg-amber-100 border border-amber-200 uppercase">
                              Re-Research Req
                            </span>
                          ) : info.priorityFlag === 'Immediate Action Required' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider text-rose-700 bg-rose-100 border border-rose-200 animate-pulse">
                              Immediate Outreach
                            </span>
                          ) : info.priorityFlag === 'Nurture Queue' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider text-teal-700 bg-teal-100 border border-teal-200">
                              Nurture
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-medium text-slate-500 bg-slate-100 border border-slate-200">
                              Standard
                            </span>
                          )}

                          {info.weightedSectorMultiplier > 1.0 && (
                            <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100">
                              +{((info.weightedSectorMultiplier - 1) * 100).toFixed(0)}% Boost
                            </span>
                          )}
                        </div>

                        {/* Domain / Industry description */}
                        <p className="text-xs text-slate-500 line-clamp-1 mb-2 font-normal leading-normal font-sans">
                          {account.description || account.fitReason}
                        </p>

                        {/* Signals summary on the left */}
                        <div className="flex flex-wrap gap-1.5">
                          {(account.signals || []).slice(0, 3).map((sig, i) => (
                            <span key={i} className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-150 uppercase font-sans">
                              {sig}
                            </span>
                          ))}
                          {(account.signals || []).length > 3 && (
                            <span className="text-[9.5px] text-slate-400 font-medium self-center font-sans">
                              +{(account.signals || []).length - 3} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Hand Stats & Metrics Column */}
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {/* Metrics Panel */}
                        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border border-slate-105 font-mono shadow-2xs">
                          <div className="text-center px-2">
                            <div className="text-[8px] font-extrabold text-slate-450 uppercase tracking-wide">FIT</div>
                            <div className={`text-xs font-bold mt-0.5 ${scoreColor} px-1.5 rounded border`}>
                              {info.fitScore}%
                            </div>
                          </div>
                          <div className="h-6 w-[1.5px] bg-slate-200/60" />
                          <div className="text-center px-2">
                            <div className="text-[8px] font-extrabold text-slate-450 uppercase tracking-wide">TIMING</div>
                            <div className={`text-xs font-bold mt-0.5 ${timingColor} px-1.5 rounded border`}>
                              {info.timingScore}%
                            </div>
                          </div>
                          <div className="h-6 w-[1.5px] bg-slate-200/60" />
                          <div className="text-center px-2">
                            <div className="text-[8px] font-extrabold text-slate-450 uppercase tracking-wide">PRIORITY</div>
                            <div className={`text-xs font-bold mt-0.5 ${priorityColor} px-1.5 rounded border`}>
                              {account.isDisqualified ? 'EXCL' : info.priorityIndex}
                            </div>
                          </div>
                        </div>

                        {/* Outreach window / outreach stage action buttons */}
                        <div className="flex flex-col items-end gap-1.5 min-w-[120px] font-sans">
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 font-medium">
                            <Clock className="w-3 text-indigo-505" />
                            <span>{info.outreachWindow}</span>
                          </div>
                          
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-0.5 h-8 text-xs gap-1 font-semibold border border-transparent hover:border-indigo-200 rounded-lg transition-all"
                          >
                            Intel Details <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {sortedFilteredAccounts.length === 0 && accounts.length > 0 && (
                  <div className="py-16 text-center border border-dashed border-slate-205 rounded-2xl bg-white p-6">
                    <p className="text-slate-500 text-sm font-medium">No results match your search or filter configuration.</p>
                    <Button 
                      variant="link" 
                      onClick={() => { setSearchQuery(''); setSelectedFilters([]); }} 
                      className="text-indigo-600 mt-2 h-auto p-0"
                    >
                      Clear search filters
                    </Button>
                  </div>
                )}
              </div>
            )}

            {accounts.length === 0 && !isDiscovering && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="p-4 rounded-full bg-slate-100 text-slate-400">
                  <BarChart3 className="w-12 h-12" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-lg">No accounts discovered yet</h3>
                  <p className="text-slate-500 max-w-xs text-sm">Run an autonomous discovery to find target accounts based on your business profile.</p>
                </div>
                <Button onClick={onRefreshDiscovery} className="bg-indigo-600">Start Discovery</Button>
              </div>
            )}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {selectedAccountId && selectedAccount && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAccountId(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 transition-opacity"
            />
            <AccountDetail 
              account={selectedAccount} 
              onClose={() => setSelectedAccountId(null)} 
              onUpdateAccount={onUpdateAccount}
            />
          </>
        )}
      </AnimatePresence>

      <Dialog open={isCrmOpen} onOpenChange={setIsCrmOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-205 p-6 rounded-2xl shadow-xl z-50">
          {crmConnected !== 'none' ? (
            /* Connected Content */
            <div className="text-center py-4 px-2 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-sm">Secure Sync Connection Active</h3>
                <p className="text-[11px] text-slate-500 leading-normal max-w-xs mx-auto">
                  Your workspace is dynamically syncing CAD Design intent signals and buyer personas with **{getCrmName(crmConnected).toUpperCase()}**.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg text-left border border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>Last Automated Sync</span>
                  <span className="font-semibold text-slate-700">Just now (100% complete)</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>Synced Accounts</span>
                  <span className="font-semibold text-slate-700">{accounts.length} organizations matched</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={isCrmLoading}
                  onClick={() => {
                    setIsCrmLoading(true);
                    setTimeout(() => {
                      setIsCrmLoading(false);
                      toast.success('CRM Database has been fully synchronized with current GTM Waves.');
                    }, 1200);
                  }}
                  className="flex-1 text-xs gap-1.5 h-9"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCrmLoading ? 'animate-spin' : ''}`} /> Trigger Daily Sync
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setCrmConnected('none');
                    setCrmStep(1);
                    setIsCrmOpen(false);
                    toast.info('CRM Integration disconnected.');
                  }}
                  className="text-xs text-red-500 hover:text-red-655 hover:bg-red-50 h-9"
                >
                  Disconnect API
                </Button>
              </div>
            </div>
          ) : crmStep === 1 ? (
            /* Select CRM Step 1 */
            <>
              <DialogHeader>
                <DialogTitle className="text-slate-900 font-bold text-base">Connect CRM System</DialogTitle>
                <DialogDescription className="text-slate-500 text-xs text-left leading-normal">
                  Synchronize qualified target accounts, key buyer personas, and CAD CAD operational triggers seamlessly with your CRM pipeline.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 gap-2.5 px-1 py-2">
                <button 
                  onClick={() => setSelectedCrmType('hubspot')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${selectedCrmType === 'hubspot' ? 'border-orange-500 bg-orange-50/20 shadow-xs' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center font-bold text-orange-600 shrink-0 text-xs select-none">HS</div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">HubSpot Integration</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-normal">Sync companies, contact records, and custom intent signals in real time.</div>
                  </div>
                </button>
                <button 
                  onClick={() => setSelectedCrmType('salesforce')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${selectedCrmType === 'salesforce' ? 'border-sky-505 bg-sky-50/20 shadow-xs' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-102 flex items-center justify-center font-bold text-sky-600 shrink-0 text-xs select-none">SF</div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Salesforce Integration</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-normal">Map overall ICP fit score and prioritized buyers to active prospect lists.</div>
                  </div>
                </button>
                <button 
                  onClick={() => setSelectedCrmType('pipedrive')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${selectedCrmType === 'pipedrive' ? 'border-emerald-500 bg-emerald-50/20 shadow-xs' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center font-bold text-emerald-600 shrink-0 text-xs select-none">PD</div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Pipedrive Integration</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-normal">Convert discovered profiles into active leads directly inside visual deals.</div>
                  </div>
                </button>
                <button 
                  onClick={() => setSelectedCrmType('prospectaccel')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${selectedCrmType === 'prospectaccel' ? 'border-indigo-500 bg-indigo-50/20 shadow-xs' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center font-bold text-indigo-605 shrink-0 text-xs select-none">PA</div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Prospect Accel Integration</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-normal">Synchronize high-converting targeted matches and real-time triggers seamlessly.</div>
                  </div>
                </button>
              </div>

              <DialogFooter className="mt-4">
                <Button 
                  onClick={() => setCrmStep(2)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-xs gap-1 h-9 font-medium"
                >
                  Configure Connection <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* Configure CRM Step 2 */
            <>
              <DialogHeader>
                <DialogTitle className="text-slate-900 font-bold text-base">Configure CRM Access</DialogTitle>
                <DialogDescription className="text-slate-500 text-xs text-left leading-normal">
                  Please provide access credentials to authorize synchronization with **{getCrmName(selectedCrmType).toUpperCase()}**.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 px-1 py-1">
                <div className="flex items-center gap-2">
                  <button onClick={() => setCrmStep(1)} className="text-xs font-semibold text-indigo-600 hover:underline">← Platform Choices</button>
                  <span className="text-slate-200 text-xs">|</span>
                  <span className="text-xs font-medium text-slate-500">Integrating secure systems</span>
                </div>

                {selectedCrmType === 'salesforce' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Salesforce Instance URL</label>
                    <input 
                      type="text" 
                      value={crmUrl} 
                      onChange={(e) => setCrmUrl(e.target.value)} 
                      placeholder="https://yourcompany.my.salesforce.com" 
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-655 uppercase tracking-wide">API Personal Token / secrets</label>
                  <input 
                    type="password" 
                    value={crmApiKey} 
                    onChange={(e) => setCrmApiKey(e.target.value)} 
                    placeholder={selectedCrmType === 'hubspot' ? 'pat-na1-xxxx-xxxx-xxxx-xxxx' : selectedCrmType === 'prospectaccel' ? 'pa-live-xxxx-xxxx-xxxx' : 'Enter access token...'} 
                    className="w-full h-9 px-3 text-xs rounded-lg border border-slate-205 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-[10px] text-slate-500 leading-normal flex items-start gap-2">
                  <CloudLightning className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>Your credentials are encrypted inside standard secure client-side storage sessions and sent over TLS.</span>
                </div>
              </div>

              <DialogFooter className="mt-4 gap-2 flex flex-row">
                <Button 
                  variant="outline" 
                  onClick={() => setCrmStep(1)}
                  className="flex-1 text-slate-500 text-xs h-9 border-slate-200"
                >
                  Go Back
                </Button>
                <Button 
                  onClick={handleConnectCrm}
                  disabled={isCrmLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-xs h-9 font-medium"
                >
                  {isCrmLoading ? (
                    <span className="flex items-center gap-1.5 justify-center">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connecting...
                    </span>
                  ) : 'Authorize & Connect'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 💾 MODAL 1: SAVE REPORT VIEW                          */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSaveModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 transition-opacity"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 z-50 space-y-5 text-left font-sans"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">Save Market Scope View</h3>
                  <p className="text-xs text-slate-500">Lock in your current calibrated targets, fit filters, and pipeline stages.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Report / Outreach Name</label>
                <input
                  type="text"
                  value={reportNameInput}
                  onChange={(e) => setReportNameInput(e.target.value)}
                  placeholder="e.g. Outreach - APAC Market Expansion"
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans font-semibold text-slate-800"
                />
              </div>

              <div className="flex gap-2.5 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="flex-1 text-slate-500 hover:text-slate-800 hover:bg-slate-50 h-10 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleExecuteSaveReport}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-10 text-xs font-bold cursor-pointer"
                >
                  Confirm & Save Scope
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* ✏️ MODAL 2: EDIT BLUEPRINT / ICP PARAMETERS             */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isEditReportOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditReportOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 transition-opacity"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 z-50 text-left font-sans space-y-6"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight flex items-center gap-1.5">
                      <span>Edit Market Strategy Blueprint</span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-100 uppercase">Interactive</span>
                    </h3>
                    <p className="text-xs text-slate-500">Recalibrate target buyer details, fit signals, and core definitions.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">Seller Business Name</label>
                  <input
                    type="text"
                    value={editBusinessName}
                    onChange={(e) => setEditBusinessName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">Target Industries (comma-separated)</label>
                  <input
                    type="text"
                    value={editTargetIndustries}
                    onChange={(e) => setEditTargetIndustries(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block">Product/Business Overview Summary</label>
                  <textarea
                    rows={2}
                    value={editOverview}
                    onChange={(e) => setEditOverview(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 text-xs"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block">Core Enterprise Value Proposition</label>
                  <textarea
                    rows={2}
                    value={editValueProp}
                    onChange={(e) => setEditValueProp(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 text-xs"
                  />
                </div>

                <div className="space-y-2 md:col-span-2 p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-4">
                  <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wide border-b border-indigo-100 pb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Key Ideal Customer Persona (ICP) Controls
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 block">ICP Profile Name</label>
                      <input
                        type="text"
                        value={editIcpTitle}
                        onChange={(e) => setEditIcpTitle(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 block">Target Buyer Titles (comma-separated)</label>
                      <input
                        type="text"
                        value={editTargetRoles}
                        onChange={(e) => setEditTargetRoles(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">Intent Signals / Buying Actions (comma-separated)</label>
                    <input
                      type="text"
                      value={editBuyingSignals}
                      onChange={(e) => setEditBuyingSignals(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">ICP Audience Strategy & Scope Details</label>
                    <textarea
                      rows={2}
                      value={editIcpDescription}
                      onChange={(e) => setEditIcpDescription(e.target.value)}
                      className="w-full p-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditReportOpen(false)}
                  className="flex-1 text-slate-500 hover:text-slate-800 hover:bg-slate-50 h-10 text-xs font-bold cursor-pointer"
                >
                  Discard Changes
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveReportEdit}
                  className="flex-1 bg-indigo-650 hover:bg-indigo-700 text-white h-10 text-xs font-bold cursor-pointer"
                >
                  Save & Apply Blueprint
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* ➕ MODAL 3: ADD CUSTOM TARGET ACCOUNT                  */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isAddAccountOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddAccountOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 transition-opacity"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 z-50 text-left font-sans space-y-5"
            >
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">Append Target Organization</h3>
                  <p className="text-xs text-slate-500 font-medium">Add a hand-crafted prospect company directly into this outreach report view.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Spaceworks"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Website Domain *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. acme.space"
                    value={newAccDomain}
                    onChange={(e) => setNewAccDomain(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">ICP Fit Score (1 - 100)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={newAccFitScore}
                      onChange={(e) => setNewAccFitScore(Number(e.target.value))}
                      className="flex-1 accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
                    />
                    <span className="w-12 h-9 border border-slate-200 rounded-lg md:text-sm font-bold font-mono text-center flex items-center justify-center bg-indigo-50/50 text-indigo-700 select-none">
                      {newAccFitScore}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Observed Intent Timing (1 - 100)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={newAccTimingScore}
                      onChange={(e) => setNewAccTimingScore(Number(e.target.value))}
                      className="flex-1 accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
                    />
                    <span className="w-12 h-9 border border-slate-200 rounded-lg md:text-sm font-bold font-mono text-center flex items-center justify-center bg-indigo-50/50 text-indigo-700 select-none">
                      {newAccTimingScore}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block">Specific Observed Signals (comma-separated tags)</label>
                  <input
                    type="text"
                    value={newAccSignals}
                    onChange={(e) => setNewAccSignals(e.target.value)}
                    placeholder="e.g. Cloud scaling, recent product expansion, job openings"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block">Company Overview / Outreach Strategy Description</label>
                  <textarea
                    rows={2}
                    value={newAccOverview}
                    placeholder="Highlight specific reasons and technical needs that make Acme Spaceworks a fantastic prospect..."
                    onChange={(e) => setNewAccOverview(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddAccountOpen(false)}
                  className="flex-1 text-slate-500 hover:text-slate-800 hover:bg-slate-50 h-10 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAddAccount}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-10 text-xs font-bold cursor-pointer"
                >
                  Append Target Account
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ✏️ MODAL: RENAME CURRENT LOADED CONFIGURATION */}
      <Dialog open={isRenameReportOpen} onOpenChange={setIsRenameReportOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-150 rounded-2xl font-sans select-none shadow-xl">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-slate-900 font-bold text-base flex items-center gap-2">
              <Pencil className="w-4 h-4 text-indigo-605" />
              <span>Rename Current Plan</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Change the display title of the loaded outbound strategy blueprint.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-left">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Plan Name</label>
              <input
                type="text"
                value={newReportName}
                onChange={(e) => setNewReportName(e.target.value)}
                placeholder="e.g. outreach wave standard..."
                className="w-full h-10 px-3.5 rounded-lg border border-slate-205 bg-white outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium text-slate-800"
              />
            </div>
          </div>

          <DialogFooter className="flex sm:justify-end gap-2 border-t border-slate-100 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRenameReportOpen(false)}
              className="text-slate-500 hover:text-slate-800 text-xs font-bold h-9 bg-white border border-transparent shadow-none"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                if (!newReportName.trim()) {
                  toast.error("Name cannot be empty");
                  return;
                }
                if (activeReportId && onUpdateReportMeta) {
                  onUpdateReportMeta(activeReportId, newReportName.trim());
                }
                setIsRenameReportOpen(false);
              }}
              className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-lg shadow-xxs"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🚀 MODAL: VIEW DISTINCT PARTNER PATHWAY OUTREACH STRATEGY */}
      <Dialog 
        open={!!selectedPathwayStrategyAccount} 
        onOpenChange={(open) => { if (!open) setSelectedPathwayStrategyAccount(null); }}
      >
        <DialogContent className="sm:max-w-2xl bg-white border border-slate-150 rounded-2xl font-sans text-left shadow-xl max-h-[90vh] overflow-y-auto">
          {selectedPathwayStrategyAccount && (() => {
            const acc = selectedPathwayStrategyAccount;
            const info = getAccountPriorityInfo(acc);
            const pathway = info.pathway;
            const wsFound = (pathway?.warmIntroductionPaths?.length ?? 0) > 0;
            
            return (
              <>
                <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-650">
                      <Network className="w-4 h-4" />
                    </div>
                    <DialogTitle className="text-slate-900 font-extrabold text-base">
                      Referral Routing Plan: {acc.name}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="text-xs text-slate-500 text-left">
                    Calculated pathway leveraging mutual ecosystems, shared vendor stacks, or active partner referral grids.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-3 text-left">
                  {/* Stats Row */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Conversion Likelihood</span>
                      <div className="text-xl font-extrabold text-emerald-600 font-sans">
                        {pathway?.channelScore ?? 32}%
                        <span className="text-xs text-slate-400 font-normal ml-1">(assisted list)</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Cold Fit Rating</span>
                      <div className="text-xl font-extrabold text-slate-700 font-sans">
                        {acc.fitScore ?? 75}%
                        <span className="text-xs text-slate-400 font-normal ml-1">(traditional index)</span>
                      </div>
                    </div>
                  </div>

                  {/* Approach Type */}
                  <div className="space-y-1 font-sans">
                    <h5 className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Assessed Approach Pathway</h5>
                    <div className="flex items-center gap-2 mt-1">
                      {pathway?.approachType === 'Direct' ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-105 text-slate-700 border border-slate-200">
                          Direct Outreach (Default fallback due to lack of overlapping warm nodes)
                        </span>
                      ) : pathway?.approachType === 'Channel Partner' ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-150">
                          Channel Partner Assisted: Approaches should be co-routed through physical distribution partners
                        </span>
                      ) : pathway?.approachType === 'Integration Partner' ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-150">
                          Integration Partner Shared Hub: Leverage synchronized product and tech alliances
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-150">
                          Mutual Connection Introduction: Highly warm relationship thread identified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Warm Intro Connections List */}
                  {wsFound && (
                    <div className="space-y-2">
                      <h5 className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Identified Introducer Nodes</h5>
                      <div className="space-y-2">
                        {pathway?.warmIntroductionPaths.map((p, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-slate-900 font-sans">{p.name}</span>
                              <Badge variant="outline" className="text-[9px] uppercase font-bold shrink-0 bg-white border-slate-200">
                                {p.type === 'defined_network' ? 'Your Referral Network' : p.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed font-normal">
                              {p.description}
                            </p>
                            {p.introducedBy && (
                              <div className="text-[10px] text-slate-500 font-medium font-sans">
                                Introducer Concept: <strong className="text-indigo-650">{p.introducedBy}</strong>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Distinct Outreach Strategy Draft */}
                  {pathway?.distinctOutreachStrategy && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Personalized Pathway Outreach Sequence</h5>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const text = `Subject: ${pathway.distinctOutreachStrategy?.headline}\n\n${pathway.distinctOutreachStrategy?.introHook}\n\nSequence:\n${pathway.distinctOutreachStrategy?.sequenceSteps.join('\n')}`;
                            navigator.clipboard.writeText(text);
                            toast.success("Outreach copy strategy copied to clipboard!");
                          }}
                          className="h-7 text-[10.5px] border border-slate-200 bg-white hover:bg-slate-50 text-indigo-700 font-bold px-2.5 rounded-lg cursor-pointer flex items-center gap-1"
                        >
                          Copy Strategy Draft
                        </Button>
                      </div>

                      <div className="space-y-2.5 font-sans">
                        <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/20 text-xs font-mono space-y-2 max-h-[160px] overflow-y-auto leading-relaxed">
                          <div className="font-bold text-slate-900 border-b border-indigo-50 pb-1">
                            Subject: {pathway.distinctOutreachStrategy.headline}
                          </div>
                          <div className="text-slate-705 text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {pathway.distinctOutreachStrategy.introHook}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-mono font-sans">Sequenced Multitouch Campaign</label>
                          <div className="space-y-1.5 text-xs text-slate-600">
                            {pathway.distinctOutreachStrategy.sequenceSteps.map((step, sIdx) => (
                              <div key={sIdx} className="bg-slate-55 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start gap-2.5 leading-relaxed">
                                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[9.5px] shrink-0 mt-0.5">
                                  {sIdx + 1}
                                </span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="border-t border-slate-100 pt-3">
                  <Button
                    onClick={() => setSelectedPathwayStrategyAccount(null)}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs cursor-pointer"
                  >
                    Done
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* Kanban column child component to manage sprints in GTM Pipeline */
function PipelineColumn({ 
  title, 
  description, 
  count, 
  accounts, 
  onAnalyzeAccount, 
  setSelectedAccountId, 
  onUpdateStatus,
  targetRoles,
  onDelete
}: { 
  title: string, 
  description: string, 
  count: number, 
  accounts: TargetAccount[], 
  onAnalyzeAccount: (id: string) => void, 
  setSelectedAccountId: (id: string) => void,
  onUpdateStatus?: (account: TargetAccount) => void,
  targetRoles?: string[],
  onDelete?: (id: string, event: React.MouseEvent) => void
}) {
  return (
    <div className="bg-slate-100/70 p-4 rounded-2xl flex flex-col h-[calc(100vh-250px)] min-h-[480px] border border-slate-200/50 shadow-inner">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <span>{title}</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono text-xs">{count}</span>
          </h3>
        </div>
        <p className="text-[11px] text-slate-500 leading-tight">{description}</p>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-4 pb-4">
          {accounts.map(account => (
            <AccountCard 
              key={account.id} 
              account={account} 
              targetRoles={targetRoles}
              onStatusChange={onUpdateStatus ? (newStatus) => onUpdateStatus({ ...account, status: newStatus }) : undefined}
              onDelete={onDelete}
              onClick={(acc) => {
                onAnalyzeAccount(acc.id);
                setSelectedAccountId(acc.id);
              }}
            />
          ))}
          {accounts.length === 0 && (
            <div className="border border-dashed border-slate-300 rounded-2xl p-8 py-14 text-center text-slate-400 text-xs bg-slate-50/50">
              No accounts in this stage.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active 
        ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
      }`}
    >
      {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
      {label}
    </button>
  );
}

function MetricItem({ label, value, color = 'text-slate-900' }: { label: string, value: string, color?: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}
