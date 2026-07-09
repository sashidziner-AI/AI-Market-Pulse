import React, { useState, useRef, useEffect } from 'react';
import { BusinessAnalysis, TargetAccount } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { AccountCard, getAccountPriorityInfo } from './AccountCard';
import { AccountDetail } from './AccountDetail';
import { 
  BarChart3, Users, Zap, Briefcase, 
  Search, Filter, Plus, FileUp, Download, Play, LayoutGrid, List,
  LayoutDashboard, ListTodo, Radar, Network,
  ChevronDown, ChevronRight, Bell, Database, RefreshCw, CheckCircle2, CloudLightning, ArrowRight, ArrowLeft,
  Clock, TrendingUp, AlertTriangle, Lightbulb, Compass, Sparkles, FolderOpen, Sliders, Pencil, Trash2, X, BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { computeWeightsRecalibration, SellerChannelPartner, DEFAULT_CHANNEL_PARTNERS, computePathwayAssessment } from '../utils/calibration';
import { ThemeToggle } from './ThemeToggle';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

// Classic 3-face 3D bar shape for recharts
const ThreeDBar = ({ x, y, width, height, fill, topColor, sideColor, depth = 5 }: {
  x: number; y: number; width: number; height: number;
  fill: string; topColor: string; sideColor: string; depth?: number;
}) => {
  if (!height || height <= 0 || !width || width <= 0) return null;
  const d = Math.min(depth, width * 0.55);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} />
      <polygon points={`${x},${y} ${x+d},${y-d} ${x+width+d},${y-d} ${x+width},${y}`} fill={topColor} />
      <polygon points={`${x+width},${y} ${x+width+d},${y-d} ${x+width+d},${y+height-d} ${x+width},${y+height}`} fill={sideColor} />
    </g>
  );
};

// Country → states/provinces. Countries not in this map have no state-level picker.
const COUNTRY_STATES: Record<string, string[]> = {
  'United States': [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
    'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
    'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
    'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
    'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
    'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  ],
  'Canada': [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
    'Nova Scotia', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan',
    'Northwest Territories', 'Nunavut', 'Yukon',
  ],
  'India': [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
    'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
  ],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  'Australia': [
    'New South Wales', 'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia',
    'Australian Capital Territory', 'Northern Territory',
  ],
  'Germany': [
    'Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hesse',
    'Lower Saxony', 'Mecklenburg-Vorpommern', 'North Rhine-Westphalia', 'Rhineland-Palatinate',
    'Saarland', 'Saxony', 'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia',
  ],
  'Brazil': [
    'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal',
    'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais',
    'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro',
    'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina',
    'São Paulo', 'Sergipe', 'Tocantins',
  ],
  'Mexico': [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
    'Coahuila', 'Colima', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'México',
    'Mexico City', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla',
    'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
    'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
  ],
};

// Full sovereign country list (~195) used by the ICP Exclusion geography multi-select.
const COUNTRIES: string[] = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina',
  'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
  'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina',
  'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia',
  'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia',
  'Comoros', 'Congo (Brazzaville)', 'Congo (Kinshasa)', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus',
  'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt',
  'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji',
  'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada',
  'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland',
  'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica',
  'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos',
  'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands',
  'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro',
  'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand',
  'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan',
  'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland',
  'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia',
  'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain',
  'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan',
  'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia',
  'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates',
  'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City',
  'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];

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

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

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
  const [isICPExclusionModalOpen, setIsICPExclusionModalOpen] = useState<boolean>(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState<string>('');
  const [pendingCountrySelections, setPendingCountrySelections] = useState<string[]>([]);
  const [pendingStateSelect, setPendingStateSelect] = useState<string>('');
  const [industryInputValue, setIndustryInputValue] = useState<string>('');
  const [financialInputValue, setFinancialInputValue] = useState<string>('');
  const [isScoringGuideOpen, setIsScoringGuideOpen] = useState<boolean>(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState<boolean>(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFilterMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFilterMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isFilterMenuOpen]);

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
      // Prioritization Queue Filter logic
      const info = getAccountPriorityInfo(account);
      if (priorityFilter === 'immediate' && info.priorityFlag !== 'Immediate Action Required') {
        return false;
      }
      if (priorityFilter === 'nurture' && info.priorityFlag !== 'Warm Track') {
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
          if (filter === 'Excludes') {
            return !account.isDisqualified;
          }
          return true;
        });
      }

      return true;
    });
  }, [evaluatedAccounts, searchQuery, selectedFilters, priorityFilter]);

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
      } else if (info.priorityFlag === 'Warm Track') {
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
    <div className="flex bg-white dark:bg-[#1F1F20] min-h-screen text-zinc-900 dark:text-zinc-100 font-sans">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".csv,.txt,.xlsx,.xls" 
        className="hidden" 
      />
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/[0.06] bg-[#2A2A2B] sticky top-0 h-screen hidden lg:flex flex-col flex-shrink-0">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 flex items-center justify-center shadow-[0_1px_2px_rgba(245,130,32,0.5)]">
              <span className="text-white text-[10px] font-bold">M</span>
            </div>
            <span className="font-semibold text-zinc-100 tracking-tight text-[13px]" style={{ letterSpacing: '-0.02em' }}>AI Market Pulse</span>
          </div>

          <nav className="space-y-1">
            <SidebarItem icon={<LayoutDashboard />} label="Analysis" active={activeTab === 'recommendations'} onClick={() => setActiveTab('recommendations')} />
            <SidebarItem icon={<Users />} label="Target Segments" active={activeTab === 'clusters'} onClick={() => setActiveTab('clusters')} />
            <SidebarItem icon={<Network />} label="Partner Pathways" active={activeTab === 'partner-pathways'} onClick={() => setActiveTab('partner-pathways')} />
            <SidebarItem icon={<ListTodo />} label="GTM Pipeline" active={activeTab === 'pipeline'} onClick={() => setActiveTab('pipeline')} />
          </nav>

          {crmConnected !== 'none' && (
            <>
              <Separator className="my-6 bg-white/[0.06]" />
              <div className="mt-4 px-2">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-[12px] font-bold text-emerald-300 uppercase tracking-normal">
                        {getCrmName(crmConnected).toUpperCase()} Connected
                      </span>
                    </div>
                    <button
                      onClick={() => setIsCrmOpen(true)}
                      className="text-[12px] font-semibold text-indigo-400 hover:text-indigo-300 underline transition-colors cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>
                  <div className="text-[11px] text-emerald-200/80 leading-normal">
                    Secure real-time sync active. Data refreshed hourly.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-auto p-4 border-t border-white/[0.06]">
           <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <div className="text-xs font-bold text-indigo-300 mb-1">Business Context</div>
              <p className="text-[12px] text-indigo-200/85 font-medium mb-2">{analysis.businessName}</p>
              <div className="text-[12px] text-indigo-300 font-bold uppercase tracking-normal mb-1">ICP Target</div>
              <p className="text-[12px] text-indigo-200/85 leading-tight">{analysis.icp.title}</p>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex flex-col border-b border-white/[0.06] bg-[#2A2A2B] backdrop-blur-md sticky top-0 z-20 font-sans select-none">
          {/* Row 1: Context, Navigation and CRM */}
          <div className="h-14 px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-zinc-300 hover:text-white hover:bg-white/[0.06] px-2.5 py-1 h-8 rounded-lg border border-white/[0.08] cursor-pointer"
                  onClick={onBack}
                  title="Go back to seller website adding page"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Back</span>
                </Button>
              )}
              <h2 className="font-semibold text-zinc-100 text-sm md:text-base lg:text-lg tracking-tight">
                {activeTab === 'recommendations' ? 'Analysis' :
                 activeTab === 'clusters' ? 'Strategic Account Segments' :
                 activeTab === 'partner-pathways' ? 'Partner Referral & Warm Pathways' : 'Pipeline'}
              </h2>
              {isDiscovering && accounts.length === 0 ? (
                <Badge variant="secondary" className="bg-orange-500/15 text-orange-300 border border-orange-500/20 font-mono font-bold text-[12px] px-2 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                  Scanning…
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono font-bold text-[12px] px-2 py-0.5 rounded-full">
                  {filteredAccounts.length} Leads
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3">
               <Button variant="ghost" size="icon" className="text-zinc-400 relative hover:text-zinc-100 hover:bg-white/[0.06] h-8 w-8 rounded-lg">
                 <Bell className="w-4 h-4" />
                 <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-[#2A2A2B]" />
               </Button>
               <div className="h-6 w-[1px] bg-white/[0.08] mx-1" />
               <Button
                 variant="outline"
                 size="sm"
                 className={`h-8 gap-1.5 text-xs transition-all cursor-pointer ${crmConnected !== 'none' ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/15 font-bold' : 'text-zinc-300 bg-transparent border-white/[0.08] hover:bg-white/[0.06] hover:text-zinc-100'}`}
                 onClick={() => setIsCrmOpen(true)}
               >
                 <Database className={`w-3.5 h-3.5 ${crmConnected !== 'none' ? 'text-emerald-400 animate-pulse' : 'text-indigo-400'}`} />
                 <span>{crmConnected !== 'none' ? `${crmConnected.charAt(0).toUpperCase() + crmConnected.slice(1)} Active` : 'Connect CRM'}</span>
               </Button>
               <ThemeToggle />
            </div>
          </div>

          {/* Row 2: Campaign Scope Actions and Lead File Sync Controls */}
          <div className="h-12 px-8 flex items-center justify-between bg-white/[0.02] border-t border-white/[0.04]">
            {/* Left side: Report Saved Status */}
            <div className="flex items-center gap-2">
              {activeReportId ? (
                <div className="flex items-center gap-1.5 group/header-title animate-fadeIn">
                  <span className="text-[13px] bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 px-2.5 py-0.5 rounded-md font-bold font-sans flex items-center gap-1.5">
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
                    className="opacity-0 group-hover/header-title:opacity-100 hover:text-indigo-300 text-zinc-400 p-1 bg-white/[0.04] hover:bg-white/[0.08] rounded border border-white/[0.08] transition-all cursor-pointer inline-flex items-center"
                    title="Rename Current Saved Plan"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsICPExclusionModalOpen(true)}
                  className="h-8 text-[13px] font-bold gap-1 px-3 rounded-lg border-white/[0.08] hover:bg-white/[0.06] text-zinc-300 hover:text-zinc-100 cursor-pointer bg-transparent shrink-0"
                  title="Open ICP Exclusion & Automated Disqualification Engine"
                >
                  <Filter className="w-3.5 h-3.5 text-zinc-400" />
                  <span>ICP Exclusion Criteria</span>
                  {priorityOverview.doNotPursue > 0 && (
                    <span className="ml-1 inline-flex items-center px-1.5 py-0 rounded text-[10px] font-bold text-red-300 bg-red-500/15 border border-red-500/25">
                      {priorityOverview.doNotPursue}
                    </span>
                  )}
                </Button>
              )}
            </div>

            {/* Right side Actions: Save Scope, Edit Blueprint, Download Template, Import Lead List */}
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto scrollbar-none">
              {onSaveReport && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={triggerSaveReportInitiation}
                  className="h-8 text-[13px] font-bold gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 rounded-lg border-0 cursor-pointer transition-all shadow-[0_1px_2px_rgba(245,130,32,0.35)] shrink-0"
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
                  className="h-8 text-[13px] font-bold gap-1 px-3 rounded-lg border-white/[0.08] hover:bg-white/[0.06] text-zinc-300 hover:text-zinc-100 cursor-pointer bg-transparent shrink-0"
                  title="Configure Ideal Customer Profile and analysis parameters"
                >
                  <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Edit Blueprint</span>
                </Button>
              )}

              <div className="h-4 w-[1px] bg-white/[0.08] mx-1 shrink-0" />

              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-white/[0.06] flex items-center gap-1 px-2.5 rounded-lg border border-dashed border-white/[0.10] bg-transparent select-none cursor-pointer shrink-0"
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
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden sm:inline">Download Template</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className={`h-8 gap-1 text-[13px] font-semibold shrink-0 cursor-pointer ${uploadedFile ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' : 'bg-transparent border-white/[0.08] text-zinc-300 hover:text-zinc-100 hover:bg-white/[0.06]'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="w-3.5 h-3.5 text-zinc-400" />
                <span>{uploadedFile ? `Imported: ${uploadedFile.name.substring(0, 12)}${uploadedFile.name.length > 12 ? '...' : ''}` : 'Import CSV'}</span>
              </Button>

              {uploadedFile && (
                <Button
                  size="sm"
                  className="h-8 bg-indigo-650 hover:bg-indigo-600 text-white gap-1 shadow-[0_1px_2px_rgba(245,130,32,0.35)] text-[13px] px-3 font-bold animate-in fade-in slide-in-from-right duration-200 shrink-0 cursor-pointer"
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

        <motion.section
          className="p-8 flex-1"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="max-w-full mx-auto space-y-8">
            {analysis.isFallback && (
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/40 flex items-start gap-3 shadow-xs animate-in fade-in duration-300">
                <CloudLightning className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-200">OpenAI Live API Unavailable (Quota Reached or Key Missing)</h4>
                  <p className="text-[13px] text-amber-850 dark:text-amber-200 leading-relaxed max-w-4xl">
                    The OpenAI API call did not return live data. To prevent interruptions,
                    <strong> GTM Intelligence has automatically activated localized high-fidelity simulated backups</strong>,
                    allowing you to fully test corporate persona mapping, account discovery, and competitive vendor displacement.
                  </p>
                  <p className="text-[13px] text-amber-900 dark:text-amber-200 font-semibold mt-1">
                    👉 To restore real-time live AI requests: set <code className="bg-amber-100/80 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono text-[12px]">OPENAI_API_KEY</code> in your <code className="bg-amber-100/80 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono text-[12px]">.env</code> file and restart the server.
                  </p>
                </div>
              </div>
            )}

            {/* Adaptive Scoring Intelligence Board */}
            {recalib.hasFeedback && (
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-sm space-y-4 relative overflow-hidden animate-in fade-in duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/25 via-transparent to-slate-900/10 pointer-events-none" />
                
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 text-left">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[12px] font-bold uppercase tracking-normal border border-emerald-500/20 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block mr-1" />
                      <span>Adaptive Closed-Loop Active</span>
                    </div>
                    <h3 className="text-base font-semibold tracking-tight font-sans flex items-center gap-2">
                      <Sparkles className="w-4.5 h-4.5 text-indigo-400 dark:text-indigo-300" />
                      Continuous Score Optimization Engine
                    </h3>
                  </div>

                  <div className="text-[12px] font-mono font-medium text-slate-450 text-left md:text-right">
                    <span>Analyzed <strong className="font-semibold text-white">{accounts.filter(a => !!a.outreachOutcome).length}</strong> commercial outcomes</span>
                  </div>
                </div>

                <p className="text-xs text-slate-350 leading-relaxed max-w-4xl font-sans font-normal text-left">
                  Your recorded campaign results are actively reshaping future score calibrations. The model matches incoming operational triggers to your actual sales closures to maximize conversion alignment.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1.5 text-left relative">
                  {/* Calibrated Multipliers Column */}
                  <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-3">
                    <div className="text-[12px] font-semibold text-indigo-300 uppercase tracking-normal font-mono">Dynamic Signal Calibrations</div>
                    
                    {recalib.appliedBoosts.length === 0 && recalib.appliedPenalties.length === 0 ? (
                      <p className="text-[13px] text-slate-500 dark:text-slate-300 italic font-normal py-1">Scoring weights configured at standard sector parity. Continue logging outcomes to drive calibrations.</p>
                    ) : (
                      <ul className="space-y-2 text-xs">
                        {recalib.appliedBoosts.map((boost, idx) => (
                          <li key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/15">
                            <span className="font-bold text-slate-200">✨ {boost.category}: <span className="text-emerald-400 dark:text-emerald-300">+{boost.boostPercent}% Priority Boost</span></span>
                            <span className="text-[11px] text-slate-450 shrink-0 font-medium">{boost.rationale.split(':')[0]}</span>
                          </li>
                        ))}
                        {recalib.appliedPenalties.map((penalty, idx) => (
                          <li key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-800/30 border border-slate-800">
                            <span className="font-bold text-slate-400">⚡ {penalty.category}: <span className="text-slate-400">-{penalty.penaltyPercent}% Weight Penalty</span></span>
                            <span className="text-[11px] text-slate-450 shrink-0 font-medium">{penalty.rationale.split(':')[0]}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Warning Profiles Column */}
                  <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-3">
                    <div className="text-[12px] font-semibold text-amber-400 dark:text-amber-300 uppercase tracking-normal font-mono">Closed-Loop Custody & Risk Flags</div>
                    
                    {recalib.sectorCautions.length === 0 && recalib.sizeCautions.length === 0 && recalib.financialCautions.length === 0 ? (
                      <p className="text-[13px] text-slate-500 dark:text-slate-300 italic font-normal py-1">No cautionary flags compiled yet. No high-risk pipeline trends detected.</p>
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

            {/* Interactive GTM Outreach priority wave segments — Market Pulse tab only */}
            {activeTab === 'recommendations' && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                GTM Outreach Priority Waves & Intent Timing
              </h3>
              {(() => {
                const total = Math.max(1, priorityOverview.total);
                const immediatePct = Math.round((priorityOverview.immediate / total) * 100);
                const nurturePct = Math.round((priorityOverview.nurture / total) * 100);
                const standardPct = Math.round((priorityOverview.standard / total) * 100);

                const compositionData = [
                  { name: 'Immediate', value: priorityOverview.immediate, fill: '#f43f5e' },
                  { name: 'Warm Track', value: priorityOverview.nurture, fill: '#14b8a6' },
                  { name: 'Standard', value: priorityOverview.standard, fill: '#94a3b8' },
                ].filter(d => d.value > 0);

                // Fit-score histograms (5 bins) per priority bucket
                const emptyBins = () => [
                  { range: '0-19', count: 0 },
                  { range: '20-39', count: 0 },
                  { range: '40-59', count: 0 },
                  { range: '60-79', count: 0 },
                  { range: '80+', count: 0 },
                ];
                const immBins = emptyBins();
                const nurBins = emptyBins();
                const stdBins = emptyBins();
                evaluatedAccounts.forEach(acc => {
                  const info = getAccountPriorityInfo(acc);
                  if (acc.isDisqualified || info.priorityFlag === 'Do Not Pursue') return;
                  const idx = Math.min(4, Math.floor((acc.fitScore ?? 0) / 20));
                  if (info.priorityFlag === 'Immediate Action Required') immBins[idx].count++;
                  else if (info.priorityFlag === 'Warm Track') nurBins[idx].count++;
                  else stdBins[idx].count++;
                });

                const tooltipStyle = {
                  background: 'rgba(15,15,17,0.92)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 8,
                  color: '#fafafa',
                  fontSize: 11,
                  padding: '4px 8px',
                } as const;
                const tooltipLabelStyle = { color: '#a1a1aa', fontSize: 10 } as const;
                const tooltipItemStyle = { color: '#fafafa' } as const;

                return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Pipeline — HERO DONUT with vertical legend list */}
                <div
                  onClick={() => setPriorityFilter('all')}
                  className="relative overflow-hidden p-3 rounded-2xl border transition-all cursor-pointer text-left border-[#1d8ecd] bg-gradient-to-br from-[#1d8ecd]/15 to-[#1d8ecd]/[0.05] dark:from-[#1d8ecd]/30 dark:to-[#1d8ecd]/15 ring-1 ring-[#1d8ecd]/30"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Compass className="w-4 h-4 text-[#1d8ecd]" />
                    <span className="text-[16px] font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Total Pipeline</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 mb-4 leading-snug">
                    Full pipeline coverage across every priority tier
                  </p>

                  <div className="flex items-center gap-3">
                    {/* Enlarged pie — classic 3D tilt */}
                    <div className="flex flex-col items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="relative w-20 h-20">
                        <div className="absolute inset-0" style={{ transform: 'perspective(400px) rotateX(15deg)', transformOrigin: 'center 60%', filter: 'drop-shadow(0 4px 3px rgba(0,0,0,0.15))' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={compositionData.length ? compositionData : [{ name: 'Empty', value: 1, fill: '#e5e7eb' }]}
                                cx="50%"
                                cy="50%"
                                outerRadius={36}
                                paddingAngle={compositionData.length > 1 ? 3 : 0}
                                dataKey="value"
                                stroke="none"
                              >
                                {(compositionData.length ? compositionData : [{ fill: '#e5e7eb' }]).map((d, i) => (
                                  <Cell key={i} fill={d.fill} />
                                ))}
                              </Pie>
                              {compositionData.length > 0 && (
                                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                              )}
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                    {/* Vertical legend list */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Immediate</span>
                        <span className="font-mono font-semibold text-slate-700 dark:text-zinc-200">{priorityOverview.immediate}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300"><span className="w-1.5 h-1.5 rounded-full bg-teal-500" />Warm Track</span>
                        <span className="font-mono font-semibold text-slate-700 dark:text-zinc-200">{priorityOverview.nurture}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />Standard</span>
                        <span className="font-mono font-semibold text-slate-700 dark:text-zinc-200">{priorityOverview.standard}</span>
                      </div>
                      {/* Total — highlighted below Standard */}
                      <div className="flex items-center justify-between text-[11px] pt-1 mt-0.5 border-t border-[#1d8ecd]/30">
                        <span className="flex items-center gap-1.5 font-semibold text-[#1d8ecd]"><span className="w-1.5 h-1.5 rounded-full bg-[#1d8ecd]" />Total</span>
                        <span className="font-mono font-bold text-[#1d8ecd] bg-[#1d8ecd]/10 px-1.5 py-0.5 rounded">{priorityOverview.total}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Immediate Action — URGENT ALERT with pulsing accent bar + gradient */}
                <div
                  onClick={() => setPriorityFilter('immediate')}
                  className="relative overflow-hidden p-3 rounded-2xl border transition-all cursor-pointer text-left border-rose-500 bg-gradient-to-br from-rose-100 to-rose-50 dark:from-rose-900/30 dark:to-rose-950/20"
                >
                  {/* Pulsing accent bar at top */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-400 via-rose-500 to-orange-500 animate-pulse" />

                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                      <span className="text-[16px] font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Immediate Action</span>
                    </div>
                    {priorityOverview.immediate > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 uppercase tracking-wider">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                        </span>
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 mb-4 leading-snug">
                    Hot buyers ready now — reach out within 48 hours
                  </p>

                  {/* Huge dominant count */}
                  <div className="relative z-10 flex items-baseline gap-1 leading-none mb-1">
                    <span className="text-4xl font-semibold font-mono text-rose-600 dark:text-rose-300" style={{ letterSpacing: '-0.04em' }}>{priorityOverview.immediate}</span>
                    <span className="text-lg font-mono text-rose-400/70 dark:text-rose-400/60" style={{ letterSpacing: '-0.02em' }}>/{priorityOverview.total}</span>
                  </div>
                  <div className="relative z-10 text-[11px] text-rose-700/80 dark:text-rose-300/80 font-medium">
                    high-intent accounts
                  </div>

                  {/* Running spline wave — decorative bottom fill */}
                  <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden pointer-events-none rounded-b-2xl">
                    <motion.div
                      className="absolute bottom-0 flex"
                      style={{ width: '200%' }}
                      animate={{ x: ['0%', '-50%'] }}
                      transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
                    >
                      {[0, 1].map(i => (
                        <svg key={i} viewBox="0 0 800 160" style={{ width: '50%', display: 'block', flexShrink: 0 }} preserveAspectRatio="none">
                          <path d="M0,100 C67,55 133,145 200,100 C267,55 333,145 400,100 C467,55 533,145 600,100 C667,55 733,145 800,100 L800,160 L0,160 Z" fill="rgba(244,63,94,0.22)" />
                          <path d="M0,120 C67,85 133,152 200,120 C267,85 333,152 400,120 C467,85 533,152 600,120 C667,85 733,152 800,120 L800,160 L0,160 Z" fill="rgba(244,63,94,0.12)" />
                        </svg>
                      ))}
                    </motion.div>
                  </div>
                </div>

                {/* Card 3: Warm Track — CENTERED RADIAL GAUGE dominating the card */}
                <div
                  onClick={() => setPriorityFilter('nurture')}
                  className="relative overflow-hidden p-3 rounded-2xl border transition-all cursor-pointer text-left flex flex-col items-center border-teal-500 bg-gradient-to-br from-teal-100 to-teal-50 dark:from-teal-900/40 dark:to-teal-950/20 ring-1 ring-teal-300"
                >
                  <div className="w-full flex items-center gap-1.5 mb-1">
                    <Clock className="w-4 h-4 text-teal-600 dark:text-teal-300" />
                    <span className="text-[16px] font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Warm Track</span>
                  </div>
                  <p className="w-full text-[11px] text-slate-600 dark:text-zinc-400 mb-4 leading-snug">
                    Right customer, wrong time — stay in touch until they're ready to buy
                  </p>

                  {/* Speed meter gauge — pure SVG, large, % text on right */}
                  {(() => {
                    const W = 170, H = 68;
                    const cx = W / 2, cy = H - 8;
                    const innerR = 40, outerR = 62;
                    const needleLen = outerR - 3;
                    const angleRad = Math.PI - (nurturePct / 100) * Math.PI;
                    const nx = cx + needleLen * Math.cos(angleRad);
                    const ny = cy - needleLen * Math.sin(angleRad);
                    const tx = cx - 10 * Math.cos(angleRad);
                    const ty = cy + 10 * Math.sin(angleRad);
                    const arc = (sDeg: number, eDeg: number) => {
                      const s = sDeg * Math.PI / 180, e = eDeg * Math.PI / 180;
                      const ox1 = cx + outerR * Math.cos(s), oy1 = cy - outerR * Math.sin(s);
                      const ox2 = cx + outerR * Math.cos(e), oy2 = cy - outerR * Math.sin(e);
                      const ix2 = cx + innerR * Math.cos(e), iy2 = cy - innerR * Math.sin(e);
                      const ix1 = cx + innerR * Math.cos(s), iy1 = cy - innerR * Math.sin(s);
                      const lg = Math.abs(sDeg - eDeg) > 180 ? 1 : 0;
                      return `M${ox1},${oy1} A${outerR},${outerR} 0 ${lg} 1 ${ox2},${oy2} L${ix2},${iy2} A${innerR},${innerR} 0 ${lg} 0 ${ix1},${iy1}Z`;
                    };
                    const zones = [
                      { s: 180, e: 120, fill: isDark ? '#5eead4' : '#99f6e4' },
                      { s: 120, e: 60,  fill: isDark ? '#14b8a6' : '#2dd4bf' },
                      { s: 60,  e: 0,   fill: isDark ? '#0f766e' : '#0d9488' },
                    ];
                    return (
                      <div className="flex items-center w-full gap-3 my-1" onClick={(e) => e.stopPropagation()}>
                        {/* Gauge */}
                        <div className="relative shrink-0" style={{ width: W, height: H }}>
                          <svg width={W} height={H} style={{ overflow: 'visible' }}>
                            {zones.map((z, i) => <path key={i} d={arc(z.s, z.e)} fill={z.fill} />)}
                            <line x1={tx} y1={ty} x2={nx} y2={ny} stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx={cx} cy={cy} r="5" fill="#99f6e4" />
                            <circle cx={cx} cy={cy} r="2.5" fill="#0d9488" />
                            <text x={cx - outerR} y={cy + 14} fontSize="8" textAnchor="middle" fill={isDark ? '#6b7280' : '#94a3b8'} fontFamily="ui-monospace,monospace">0%</text>
                            <text x={cx + outerR} y={cy + 14} fontSize="8" textAnchor="middle" fill={isDark ? '#6b7280' : '#94a3b8'} fontFamily="ui-monospace,monospace">100%</text>
                          </svg>
                        </div>
                        {/* Value + Queued — right side */}
                        <div className="flex flex-col items-center shrink-0 gap-2">
                          <div className="flex flex-col items-center">
                            <span className="text-2xl font-bold font-mono text-teal-600 dark:text-teal-300 leading-none" style={{ letterSpacing: '-0.03em' }}>{nurturePct}%</span>
                            <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 dark:text-zinc-500 mt-1">share</span>
                          </div>
                          <div className="flex flex-col items-center border-t border-teal-200 dark:border-teal-800 pt-2 w-full">
                            <div className="flex items-baseline gap-0.5 leading-none">
                              <span className="text-2xl font-bold font-mono text-teal-600 dark:text-teal-300" style={{ letterSpacing: '-0.04em' }}>{priorityOverview.nurture}</span>
                              <span className="text-base font-mono text-teal-400/70 dark:text-teal-400/60" style={{ letterSpacing: '-0.02em' }}>/{priorityOverview.total}</span>
                            </div>
                            <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 dark:text-zinc-500 mt-1">queued</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Card 4: Standard follow-up — MINIMAL TYPOGRAPHIC (no chart, tabular list) */}
                <div
                  onClick={() => setPriorityFilter('standard')}
                  className="p-3 rounded-2xl border transition-all cursor-pointer text-left border-amber-500 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-950/20 ring-1 ring-amber-300"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Lightbulb className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                    <span className="text-[16px] font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Standard follow-up</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 mb-2 leading-snug">
                    Lower priority — check back with a light touch every few months
                  </p>

                  {/* Big monospace number, no chart */}
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-semibold font-mono text-slate-700 dark:text-zinc-100 leading-none" style={{ letterSpacing: '-0.03em' }}>{priorityOverview.standard}</span>
                    <span className="text-[12px] font-mono text-slate-400 dark:text-zinc-500">/ {priorityOverview.total} total</span>
                  </div>

                  {/* Vertical bar chart — fit-score distribution */}
                  <div className="border-t border-slate-200/70 dark:border-white/[0.06] pt-2">
                    <ResponsiveContainer width="100%" height={82}>
                      <BarChart
                        data={stdBins.map(b => ({ name: b.range, count: b.count }))}
                        margin={{ top: 24, right: 6, bottom: 4, left: 4 }}
                        barCategoryGap="10%"
                      >
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 9, fill: isDark ? '#fde68a' : '#92400e', fontFamily: 'ui-monospace, monospace' }}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis hide width={0} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelStyle={tooltipLabelStyle}
                          itemStyle={tooltipItemStyle}
                          formatter={(v: any) => [v, 'Accounts']}
                        />
                        <Bar
                          dataKey="count"
                          label={{
                            content: (props: any) => {
                              const { x, y, width, value } = props;
                              if (!value || value <= 0) return null;
                              return (
                                <text
                                  x={(x ?? 0) + (width ?? 0) / 2}
                                  y={(y ?? 0) - 6 - 5}
                                  textAnchor="middle"
                                  fontSize={9}
                                  fill={isDark ? '#fde68a' : '#92400e'}
                                  fontFamily="ui-monospace, monospace"
                                >
                                  {value}
                                </text>
                              );
                            }
                          }}
                          shape={(props: any) => {
                            if (!props.value || props.value <= 0) {
                              const stubH = 6;
                              return (
                                <rect
                                  x={props.x} y={props.y - stubH}
                                  width={props.width} height={stubH}
                                  fill={isDark ? '#78350f' : '#fed7aa'}
                                  rx={2}
                                />
                              );
                            }
                            return (
                              <ThreeDBar
                                {...props}
                                fill={isDark ? '#fbbf24' : '#f59e0b'}
                                topColor={isDark ? '#fde68a' : '#fcd34d'}
                                sideColor={isDark ? '#f59e0b' : '#b45309'}
                                depth={6}
                              />
                            );
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
                );
              })()}
            </div>
            )}

            {/* ICP Exclusion & Disqualification Signal Controls — Modal */}
            <Dialog open={isICPExclusionModalOpen} onOpenChange={setIsICPExclusionModalOpen}>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 rounded-2xl font-sans shadow-sm max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader className="space-y-1.5 text-left border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-50 dark:bg-red-950/40 rounded-xl text-red-600 dark:text-red-300 border border-red-100 dark:border-red-800/50 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-sans leading-snug break-words">
                        ICP Exclusion & Automated Disqualification Engine
                      </DialogTitle>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold text-red-700 dark:text-red-300 bg-red-100/80 dark:bg-red-900/40 border border-red-200 dark:border-red-800/60">
                          {priorityOverview.doNotPursue} Account{priorityOverview.doNotPursue === 1 ? '' : 's'} Excluded
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-bold font-mono uppercase bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">Live: Active</span>
                      </div>
                      <DialogDescription className="text-[12px] sm:text-[13px] text-slate-500 dark:text-slate-300 font-medium font-sans mt-1.5">
                        Configure thresholds and signal exclusions to isolate poor-fit, low-priority candidates.
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="pt-4 space-y-6">
                  <div className="space-y-5 text-left">
                        {/* All 4 exclusion sections stack one per row */}
                        <div>
                            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-normal mb-2">1. Company Headcount Exclusions</h4>
                            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl border border-slate-150 dark:border-slate-700 space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-[13px] text-slate-500 dark:text-slate-300 font-semibold">Min Headcount Target:</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">{minSize} employees</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                step="5"
                                value={minSize} 
                                onChange={(e) => setMinSize(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <p className="text-[12px] text-slate-400 italic">Disqualifies residential boutiques and local studios below headcount bounds.</p>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-normal mb-2">2. Geographic Boundaries Exclusions</h4>
                            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl border border-slate-150 dark:border-slate-700 space-y-3">
                              <p className="text-[12px] text-slate-450">Exclude campaigns by country + state, or use quick-add regions for broader blocks:</p>

                              {/* Searchable multi-select country picker */}
                              {(() => {
                                const q = countrySearchQuery.trim().toLowerCase();
                                const filteredCountries = q
                                  ? COUNTRIES.filter(c => c.toLowerCase().includes(q))
                                  : COUNTRIES;
                                const togglePending = (country: string) => {
                                  setPendingCountrySelections(prev => {
                                    const next = prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country];
                                    // state pick is only meaningful when exactly one country is queued — reset otherwise
                                    if (next.length !== 1) setPendingStateSelect('');
                                    return next;
                                  });
                                };
                                const stateEligibleCountry =
                                  pendingCountrySelections.length === 1 && COUNTRY_STATES[pendingCountrySelections[0]]
                                    ? pendingCountrySelections[0]
                                    : '';
                                const commitPending = () => {
                                  // If exactly 1 country + state selected → save as "State, Country" precision entry.
                                  if (stateEligibleCountry && pendingStateSelect) {
                                    const entry = `${pendingStateSelect}, ${stateEligibleCountry}`;
                                    if (excludedGeographies.includes(entry)) {
                                      toast.error(`"${entry}" is already excluded.`);
                                      return;
                                    }
                                    setExcludedGeographies(prev => [...prev, entry]);
                                    setPendingCountrySelections([]);
                                    setPendingStateSelect('');
                                    setCountrySearchQuery('');
                                    toast.success(`Excluded "${entry}". Fit scores updated in real time.`);
                                    return;
                                  }
                                  // Otherwise: bulk country-level exclusion for all pending picks.
                                  const fresh = pendingCountrySelections.filter(c => !excludedGeographies.includes(c));
                                  if (fresh.length === 0) {
                                    toast.error('All selected countries are already excluded.');
                                    return;
                                  }
                                  setExcludedGeographies(prev => [...prev, ...fresh]);
                                  setPendingCountrySelections([]);
                                  setPendingStateSelect('');
                                  setCountrySearchQuery('');
                                  toast.success(`Excluded ${fresh.length} countr${fresh.length === 1 ? 'y' : 'ies'}. Fit scores updated in real time.`);
                                };
                                return (
                                  <div className="space-y-2">
                                    {/* Search */}
                                    <div className="relative">
                                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                      <input
                                        type="text"
                                        value={countrySearchQuery}
                                        onChange={(e) => setCountrySearchQuery(e.target.value)}
                                        placeholder={`Search ${COUNTRIES.length} countries…`}
                                        className={`w-full h-9 pl-8 ${countrySearchQuery ? 'pr-8' : 'pr-2.5'} rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[13px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                                      />
                                      {countrySearchQuery && (
                                        <button
                                          type="button"
                                          onClick={() => setCountrySearchQuery('')}
                                          title="Clear search"
                                          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>

                                    {/* Scrollable checkbox list */}
                                    <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5">
                                      {filteredCountries.length === 0 ? (
                                        <div className="text-center text-[12px] text-slate-400 py-4">No countries match "{countrySearchQuery}"</div>
                                      ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-0.5">
                                          {filteredCountries.map(country => {
                                            const isChecked = pendingCountrySelections.includes(country);
                                            const isAlreadyExcluded = excludedGeographies.includes(country);
                                            return (
                                              <label
                                                key={country}
                                                className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[12px] font-medium transition-colors cursor-pointer select-none ${
                                                  isAlreadyExcluded
                                                    ? 'text-red-500 dark:text-red-400 cursor-not-allowed opacity-70'
                                                    : isChecked
                                                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                                title={isAlreadyExcluded ? 'Already excluded' : ''}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked || isAlreadyExcluded}
                                                  disabled={isAlreadyExcluded}
                                                  onChange={() => togglePending(country)}
                                                  className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                                                />
                                                <span className="truncate">{country}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>

                                    {/* State/region dropdown — activates only when exactly 1 pending country with states */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                      <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:shrink-0">
                                        State / region (optional)
                                      </label>
                                      <select
                                        value={pendingStateSelect}
                                        onChange={(e) => setPendingStateSelect(e.target.value)}
                                        disabled={!stateEligibleCountry}
                                        title={
                                          pendingCountrySelections.length === 0
                                            ? 'Pick one country first'
                                            : pendingCountrySelections.length > 1
                                            ? 'State picker only works with a single country selected'
                                            : !stateEligibleCountry
                                            ? `${pendingCountrySelections[0]} has no state data`
                                            : ''
                                        }
                                        className="flex-1 min-w-0 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[13px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed truncate"
                                      >
                                        <option value="">
                                          {stateEligibleCountry
                                            ? `— Select state / region in ${stateEligibleCountry} —`
                                            : pendingCountrySelections.length === 0
                                            ? '— Pick 1 country to unlock —'
                                            : pendingCountrySelections.length > 1
                                            ? '— Reduce to 1 country to enable —'
                                            : `— ${pendingCountrySelections[0]} has no state data —`}
                                        </option>
                                        {stateEligibleCountry &&
                                          (COUNTRY_STATES[stateEligibleCountry] || []).map(s => (
                                            <option key={s} value={s}>{s}</option>
                                          ))}
                                      </select>
                                    </div>

                                    {/* Action row */}
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {pendingCountrySelections.length === 0
                                          ? `Showing ${filteredCountries.length} of ${COUNTRIES.length}`
                                          : pendingStateSelect
                                          ? <><span className="font-semibold text-indigo-600 dark:text-indigo-300">{pendingStateSelect}, {stateEligibleCountry}</span> ready</>
                                          : <><span className="font-semibold text-indigo-600 dark:text-indigo-300">{pendingCountrySelections.length}</span> selected</>}
                                      </div>
                                      <div className="flex gap-2">
                                        {(pendingCountrySelections.length > 0 || pendingStateSelect) && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => { setPendingCountrySelections([]); setPendingStateSelect(''); }}
                                            className="h-8 px-3 text-[12px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                                          >
                                            Clear selection
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="default"
                                          disabled={pendingCountrySelections.length === 0}
                                          onClick={commitPending}
                                          className="h-8 px-3 gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-bold rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                          {stateEligibleCountry && pendingStateSelect
                                            ? `Add state exclusion`
                                            : `Add ${pendingCountrySelections.length > 0 ? `${pendingCountrySelections.length} ` : ''}exclusion${pendingCountrySelections.length === 1 ? '' : 's'}`}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Unified chip list — active exclusions (custom country/state + preset region) first, then remaining presets */}
                              {(() => {
                                const PRESET_REGIONS = [
                                  'Restricted Eurasia', 'LATAM', 'APAC', 'Eastern Europe',
                                  'Western Europe', 'EMEA', 'Sub-Saharan Africa',
                                ];
                                const customActive = excludedGeographies.filter(g => !PRESET_REGIONS.includes(g));
                                const presetActive = PRESET_REGIONS.filter(g => excludedGeographies.includes(g));
                                const presetInactive = PRESET_REGIONS.filter(g => !excludedGeographies.includes(g));
                                const orderedChips = [...customActive, ...presetActive, ...presetInactive];
                                return (
                                  <div className="pt-1">
                                    <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                                      Regions — {excludedGeographies.length} excluded
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {orderedChips.map((geo) => {
                                        const active = excludedGeographies.includes(geo);
                                        const isCustom = !PRESET_REGIONS.includes(geo);
                                        return (
                                          <button
                                            key={geo}
                                            onClick={() => {
                                              setExcludedGeographies(prev =>
                                                prev.includes(geo) ? prev.filter(g => g !== geo) : [...prev, geo]
                                              );
                                            }}
                                            title={active ? 'Click to remove from exclusions' : 'Click to add to exclusions'}
                                            className={`px-2 py-1 rounded text-[12px] font-bold border transition-colors cursor-pointer ${
                                              active
                                                ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/60'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                          >
                                            {active ? '❌ ' : '+ '}{geo}
                                            {isCustom && <span className="ml-1 text-[9px] font-mono uppercase opacity-70">custom</span>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                        <div>
                            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-normal mb-2">3. Prohibited/Restricted Sectors Exclusions</h4>
                            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl border border-slate-150 dark:border-slate-700 space-y-3">
                              <p className="text-[12px] text-slate-450">Type any industry/sector to exclude (e.g. "Adult Entertainment", "Fossil Fuel Extraction"), or use the quick-add presets:</p>

                              {/* Custom industry input + Add button */}
                              {(() => {
                                const commitIndustry = () => {
                                  const entry = industryInputValue.trim();
                                  if (!entry) return;
                                  if (excludedIndustries.some(i => i.toLowerCase() === entry.toLowerCase())) {
                                    toast.error(`"${entry}" is already excluded.`);
                                    return;
                                  }
                                  setExcludedIndustries(prev => [...prev, entry]);
                                  setIndustryInputValue('');
                                  toast.success(`Excluded "${entry}". All account fit scores updated in real time.`);
                                };
                                return (
                                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-2">
                                    <input
                                      type="text"
                                      value={industryInputValue}
                                      onChange={(e) => setIndustryInputValue(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitIndustry(); } }}
                                      placeholder="e.g. Adult Entertainment, Payday Lending, Firearms"
                                      className="min-w-0 w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[13px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                    <Button
                                      size="sm"
                                      variant="default"
                                      disabled={!industryInputValue.trim()}
                                      onClick={commitIndustry}
                                      className="h-9 px-4 gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-bold rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full lg:w-auto"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Add exclusion
                                    </Button>
                                  </div>
                                );
                              })()}

                              {/* Unified chip list — active exclusions (custom + preset) first, then remaining presets */}
                              {(() => {
                                const PRESET_INDUSTRIES = [
                                  'Military / Combat Systems', 'Cryptocurrency / Web3', 'Gambling',
                                  'Adult Entertainment', 'Payday Lending', 'Firearms', 'Tobacco',
                                  'Fossil Fuel Extraction', 'Local Boutique Design', 'Healthcare Tech', 'Enterprise Software',
                                ];
                                const customActive = excludedIndustries.filter(i => !PRESET_INDUSTRIES.includes(i));
                                const presetActive = PRESET_INDUSTRIES.filter(i => excludedIndustries.includes(i));
                                const presetInactive = PRESET_INDUSTRIES.filter(i => !excludedIndustries.includes(i));
                                const orderedChips = [...customActive, ...presetActive, ...presetInactive];
                                return (
                                  <div className="pt-1">
                                    <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                                      Sectors — {excludedIndustries.length} excluded
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {orderedChips.map((ind) => {
                                        const active = excludedIndustries.includes(ind);
                                        const isCustom = !PRESET_INDUSTRIES.includes(ind);
                                        return (
                                          <button
                                            key={ind}
                                            onClick={() => {
                                              setExcludedIndustries(prev =>
                                                prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
                                              );
                                            }}
                                            title={active ? 'Click to remove from exclusions' : 'Click to add to exclusions'}
                                            className={`px-2 py-1 rounded text-[12px] font-bold border transition-colors cursor-pointer ${
                                              active
                                                ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/60'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                          >
                                            {active ? '❌ ' : '+ '}{ind}
                                            {isCustom && <span className="ml-1 text-[9px] font-mono uppercase opacity-70">custom</span>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-normal mb-2">4. Financial Strains Exclusions</h4>
                            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl border border-slate-150 dark:border-slate-700 space-y-3">
                              <p className="text-[12px] text-slate-450">Type any financial-distress signal to exclude (e.g. "Missed Debt Payments", "Credit Downgrade"), or use the quick-add presets:</p>

                              {/* Custom financial-stress input + Add button */}
                              {(() => {
                                const commitFinancial = () => {
                                  const entry = financialInputValue.trim();
                                  if (!entry) return;
                                  if (excludedFinancialStatuses.some(f => f.toLowerCase() === entry.toLowerCase())) {
                                    toast.error(`"${entry}" is already excluded.`);
                                    return;
                                  }
                                  setExcludedFinancialStatuses(prev => [...prev, entry]);
                                  setFinancialInputValue('');
                                  toast.success(`Excluded "${entry}". All account fit scores updated in real time.`);
                                };
                                return (
                                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-2">
                                    <input
                                      type="text"
                                      value={financialInputValue}
                                      onChange={(e) => setFinancialInputValue(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitFinancial(); } }}
                                      placeholder="e.g. Missed Debt Payments, Credit Downgrade, Restructuring"
                                      className="min-w-0 w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[13px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                    <Button
                                      size="sm"
                                      variant="default"
                                      disabled={!financialInputValue.trim()}
                                      onClick={commitFinancial}
                                      className="h-9 px-4 gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-bold rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full lg:w-auto"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Add exclusion
                                    </Button>
                                  </div>
                                );
                              })()}

                              {/* Unified chip list — active exclusions (custom + preset) first, then remaining presets */}
                              {(() => {
                                const PRESET_FINANCIAL = [
                                  'Layoffs', 'Bankruptcy', 'Cash-Strap Strain',
                                  'Restructuring', 'Credit Downgrade', 'Chapter 11',
                                  'Missed Debt Payments', 'Cost Cuts', 'Hiring Freeze',
                                ];
                                const customActive = excludedFinancialStatuses.filter(f => !PRESET_FINANCIAL.includes(f));
                                const presetActive = PRESET_FINANCIAL.filter(f => excludedFinancialStatuses.includes(f));
                                const presetInactive = PRESET_FINANCIAL.filter(f => !excludedFinancialStatuses.includes(f));
                                const ordered: { label: string; active: boolean; custom: boolean }[] = [
                                  ...customActive.map(l => ({ label: l, active: true, custom: true })),
                                  ...presetActive.map(l => ({ label: l, active: true, custom: false })),
                                  ...presetInactive.map(l => ({ label: l, active: false, custom: false })),
                                ];
                                return (
                                  <div className="flex flex-wrap gap-1.5">
                                    {ordered.map(({ label, active, custom }) => (
                                      <button
                                        key={label}
                                        onClick={() => {
                                          setExcludedFinancialStatuses(prev =>
                                            prev.includes(label) ? prev.filter(f => f !== label) : [...prev, label]
                                          );
                                        }}
                                        className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                                          active
                                            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 shadow-xxs'
                                            : 'bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-105'
                                        }`}
                                      >
                                        {label}
                                        {custom && <span className="ml-1 text-[9px] font-semibold uppercase tracking-wide opacity-70">custom</span>}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
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
                            className="text-slate-500 dark:text-slate-300 h-9 font-bold text-[13px] hover:text-indigo-650 cursor-pointer"
                          >
                            Clear Exclusions
                          </Button>
                        </div>
                        <div className="text-left sm:text-right text-[12px] sm:text-[13px] text-slate-500 dark:text-slate-300 font-medium leading-snug">
                          💡 Exclusions automatically override indices: Forced to <span className="font-bold text-red-650 dark:text-red-300 font-mono">0% fit</span> with priority flagged as <span className="font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 px-1 rounded">Do Not Pursue</span>.
                        </div>
                      </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Scoring & Interpretation Guide — Modal */}
            <Dialog open={isScoringGuideOpen} onOpenChange={setIsScoringGuideOpen}>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 rounded-2xl font-sans shadow-sm max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader className="space-y-1.5 text-left border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                      <BookOpen className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-sans leading-snug">
                        Scoring & Interpretation Guide
                      </DialogTitle>
                      <DialogDescription className="text-[12px] sm:text-[13px] text-slate-500 dark:text-slate-300 font-medium font-sans mt-0.5">
                        How the AI scores each account and what to do with the tiers.
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-6 pt-4 text-left">
                  {/* 1. The two core scores */}
                  <section className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">1. The Two Core Scores</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/10">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          <span className="text-[12px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Fit Score</span>
                        </div>
                        <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                          <strong>Are they the right kind of customer?</strong> Measures how well the account matches your ICP — industry, size, tech stack, budget shape. Static — doesn't change day-to-day.
                        </p>
                      </div>
                      <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/10">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[12px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Timing Score</span>
                        </div>
                        <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                          <strong>Are they ready to buy right now?</strong> Reads recent intent signals — funding rounds, leadership changes, job posts, tech migrations. Dynamic — decays as signals age.
                        </p>
                      </div>
                    </div>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Signals older than <strong>90 days</strong> start losing weight; anything past <strong>180 days</strong> counts as zero and triggers a "re-research" flag.
                    </p>
                  </section>

                  {/* 2. Priority tier ladder */}
                  <section className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">2. Priority Tier Classification</h4>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <table className="w-full text-[13px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/70">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Tier</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Rule</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">What to do</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900">
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2.5 align-top">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">🔴 Immediate</span>
                            </td>
                            <td className="px-3 py-2.5 align-top text-slate-700 dark:text-slate-300"><code className="font-mono text-[11px]">fit ≥ 85</code> AND <code className="font-mono text-[11px]">timing ≥ 80</code> AND recent signal</td>
                            <td className="px-3 py-2.5 align-top text-slate-700 dark:text-slate-300">Reach out within <strong>48 hours</strong></td>
                          </tr>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2.5 align-top">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30">🟢 Warm Track</span>
                            </td>
                            <td className="px-3 py-2.5 align-top text-slate-700 dark:text-slate-300"><code className="font-mono text-[11px]">fit ≥ 80</code> AND <code className="font-mono text-[11px]">timing &lt; 75</code></td>
                            <td className="px-3 py-2.5 align-top text-slate-700 dark:text-slate-300">Stay in touch, warm them up over weeks</td>
                          </tr>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2.5 align-top">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">🟠 Standard</span>
                            </td>
                            <td className="px-3 py-2.5 align-top text-slate-700 dark:text-slate-300">Everything else</td>
                            <td className="px-3 py-2.5 align-top text-slate-700 dark:text-slate-300">Light-touch check-in every few months</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2.5 align-top">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30">⛔ Do Not Pursue</span>
                            </td>
                            <td className="px-3 py-2.5 align-top text-slate-700 dark:text-slate-300">Hits any ICP exclusion rule</td>
                            <td className="px-3 py-2.5 align-top text-slate-700 dark:text-slate-300">Skip — not a fit for your business</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-2 text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-2.5 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span><strong>Guard rule:</strong> An account that qualifies as Immediate but has no signals in the last 90 days gets demoted to Warm Track — we don't fire urgent outreach off stale intel.</span>
                    </div>
                  </section>

                  {/* 3. Timing stage & outreach window */}
                  <section className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">3. What the Timing Score Means in Practice</h4>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <table className="w-full text-[13px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/70">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Timing Score</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Buying stage</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Recommended window</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900">
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">≥ 80</td>
                            <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Urgent Decision</td>
                            <td className="px-3 py-2.5 font-semibold text-rose-600 dark:text-rose-300">Within 48 hours</td>
                          </tr>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">65 – 79</td>
                            <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Active Evaluation</td>
                            <td className="px-3 py-2.5 font-semibold text-amber-600 dark:text-amber-300">This week</td>
                          </tr>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">&lt; 65</td>
                            <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Early Awareness</td>
                            <td className="px-3 py-2.5 font-semibold text-teal-600 dark:text-teal-300">This month</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">All stale</td>
                            <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Re-Research Required</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400">Hold outreach</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* 4. Priority Index */}
                  <section className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">4. Priority Index</h4>
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <div className="text-[13px] font-mono text-indigo-700 dark:text-indigo-300 mb-1">
                        Priority Index = (Fit Score + Timing Score) ÷ 2
                      </div>
                      <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                        The single 0–100 number the dashboard uses to sort accounts. Combines "right customer" and "right time" into one line — top of the list means both are strong.
                      </p>
                    </div>
                  </section>

                  {/* 5. Reading the cards */}
                  <section className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">5. Reading Each Card at a Glance</h4>
                    <ul className="text-[13px] text-slate-700 dark:text-slate-300 space-y-1.5 pl-1">
                      <li className="flex gap-2"><Compass className="w-4 h-4 text-[#1d8ecd] shrink-0 mt-0.5" /><span><strong>Total Pipeline</strong> — donut of tier composition across all active accounts.</span></li>
                      <li className="flex gap-2"><TrendingUp className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" /><span><strong>Immediate Action</strong> — count + fit-score distribution of urgent accounts.</span></li>
                      <li className="flex gap-2"><Clock className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" /><span><strong>Warm Track</strong> — % of pipeline waiting for timing to catch up.</span></li>
                      <li className="flex gap-2"><Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /><span><strong>Standard Follow-up</strong> — horizontal bar chart of fit-score distribution for the long-tail set.</span></li>
                    </ul>
                  </section>

                  {/* Footer note */}
                  <div className="flex gap-2 text-[12px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 p-2.5 rounded-lg">
                    <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Scores are recalibrated live whenever you update ICP exclusions, partner mappings, or outreach outcomes — nothing is hard-coded.</span>
                  </div>
                </div>

                <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsScoringGuideOpen(false)}
                    className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-bold rounded-lg cursor-pointer"
                  >
                    Got it
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md shadow-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search industries, signals, or domains..." 
                  className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-slate-850 dark:text-slate-200"
                />
              </div>
              {/* Intelligent Filter Badges & View Switches & Export */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Grouped filter dropdown — replaces the old chip row */}
                {(() => {
                  const FILTER_OPTIONS: { key: string; label: string; tone?: 'red' }[] = [
                    { key: '70', label: 'Score 70+' },
                    { key: 'Enterprise', label: 'Enterprise' },
                    { key: 'Funding', label: 'Recent Funding' },
                    { key: 'Excludes', label: 'Excludes ✗', tone: 'red' },
                  ];
                  const activeCount = selectedFilters.length;
                  const summary =
                    activeCount === 0
                      ? 'All accounts'
                      : activeCount === 1
                        ? FILTER_OPTIONS.find(o => o.key === selectedFilters[0])?.label ?? 'Filter'
                        : `${activeCount} filters`;
                  return (
                    <div ref={filterMenuRef} className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsFilterMenuOpen(o => !o)}
                        className={`gap-2 h-8 text-xs border rounded-lg px-3 ${activeCount > 0 ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                        <span className="font-semibold">{summary}</span>
                        {activeCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-mono font-bold">
                            {activeCount}
                          </span>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isFilterMenuOpen ? 'rotate-180' : ''}`} />
                      </Button>
                      {isFilterMenuOpen && (
                        <div className="absolute left-0 top-full mt-1.5 z-30 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
                          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filter accounts</span>
                            {activeCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedFilters([])}
                                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                Clear all
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => { setSelectedFilters([]); setIsFilterMenuOpen(false); }}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-left transition-colors ${activeCount === 0 ? 'bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                          >
                            <span className="flex items-center gap-2">
                              <Filter className="w-3.5 h-3.5 text-slate-400" />
                              All accounts
                            </span>
                            {activeCount === 0 && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                          </button>
                          <div className="border-t border-slate-100 dark:border-slate-800" />
                          {FILTER_OPTIONS.map(opt => {
                            const active = selectedFilters.includes(opt.key);
                            const isRed = opt.tone === 'red';
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => handleToggleFilter(opt.key)}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-left transition-colors ${
                                  active
                                    ? isRed
                                      ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-semibold'
                                      : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                    active
                                      ? isRed
                                        ? 'bg-red-600 border-red-600'
                                        : 'bg-indigo-600 border-indigo-600'
                                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                                  }`}>
                                    {active && <CheckCircle2 className="w-3 h-3 text-white" />}
                                  </span>
                                  {opt.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {(activeTab === 'recommendations' || activeTab === 'pipeline') && (
                  <>
                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 hidden sm:block" />

                    {/* Grid/List View switcher */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className={`h-7 px-2.5 rounded-md text-xs gap-1 cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold' : 'text-slate-550 hover:text-slate-850'}`}
                        title="Grid View"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span className="sr-only sm:not-sr-only sm:text-[12px]">Grid</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className={`h-7 px-2.5 rounded-md text-xs gap-1 cursor-pointer transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold' : 'text-slate-550 hover:text-slate-850'}`}
                        title="List View"
                      >
                        <List className="w-3.5 h-3.5" />
                        <span className="sr-only sm:not-sr-only sm:text-[12px]">List</span>
                      </Button>
                    </div>

                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 hidden sm:block" />

                    {/* Export Action */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportData}
                      className="h-8 text-xs font-semibold gap-1.5 px-3 rounded-lg border-slate-250 dark:border-slate-700 hover:bg-indigo-50/50 hover:text-indigo-650 hover:border-indigo-200 cursor-pointer"
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

                    {/* Scoring & Interpretation Guide */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsScoringGuideOpen(true)}
                      className="h-8 text-xs font-semibold gap-1.5 px-3 rounded-lg border-slate-250 dark:border-slate-700 hover:bg-indigo-50/50 hover:text-indigo-650 hover:border-indigo-200 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-indigo-550" />
                      <span>Guide</span>
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isDiscovering && accounts.length === 0 ? (
              <div className="space-y-5">
                {/* Discovery progress banner */}
                <div className="p-4 rounded-2xl border border-orange-200/60 dark:border-orange-500/20 bg-gradient-to-r from-orange-50/80 to-amber-50/30 dark:from-orange-950/30 dark:to-amber-950/10 flex items-start gap-3.5">
                  <div className="relative flex h-2.5 w-2.5 mt-0.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-semibold text-orange-900 dark:text-orange-200">
                      AI is scanning the web for high-intent accounts…
                    </p>
                    <p className="text-[12px] text-orange-700/70 dark:text-orange-300/60">
                      Running live searches · Scoring ICP fit & timing · Building account profiles
                    </p>
                  </div>
                </div>

                {/* Shimmer skeleton cards matching the real AccountCard layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="rounded-2xl border border-slate-100 dark:border-white/[0.05] bg-white dark:bg-[#2A2A2B] shadow-xs overflow-hidden flex min-h-[200px]">
                      <div className="w-36 shrink-0 border-r border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02] flex flex-col items-center px-3 py-4 gap-3">
                        <Skeleton className="h-5 w-20 rounded-md" />
                        <Skeleton className="h-12 w-12 rounded-full mt-2" />
                        <Skeleton className="h-5 w-16 rounded-md mt-auto" />
                      </div>
                      <div className="flex-1 p-4 space-y-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <div className="space-y-1.5 pt-1">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-5/6" />
                          <Skeleton className="h-3 w-4/6" />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                        className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left font-sans"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5 font-sans">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors text-base truncate">
                              {account.name}
                            </h3>
                            <div className="flex items-center text-xs text-slate-450 gap-1 font-mono font-normal">
                              <span>({account.domain})</span>
                            </div>

                            {/* Status identifier badge */}
                            {isEnrolled && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-normal text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 uppercase flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                Enrolled
                              </span>
                            )}
                            {isReviewing && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-normal text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/50 uppercase flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Reviewing
                              </span>
                            )}
                            {isToEngage && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-normal text-slate-650 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 uppercase flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                To Engage
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-505 text-slate-500 dark:text-slate-300 line-clamp-1 mb-2 font-normal leading-normal">
                            {account.description || account.fitReason}
                          </p>

                          <div className="flex flex-wrap gap-1.5">
                            {account.signals?.slice(0, 3).map((sig, sIdx) => (
                              <span key={sIdx} className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 px-2 py-0.5 rounded">
                                {sig}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Weighted score details right-aligned */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-5 sm:self-center shrink-0">
                          <div className="text-left sm:text-right">
                            <div className="text-[12px] text-slate-450 font-mono font-bold uppercase tracking-normal mb-0.5">Weighted Score</div>
                            <div className="text-sm font-semibold text-slate-850 dark:text-slate-200 text-slate-800 font-mono">
                              {info.priorityIndex} <span className="text-[13px] text-slate-400 font-normal">pts</span>
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
                                    className="h-8 text-xs font-semibold px-2.5 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 border-slate-200 dark:border-slate-700 text-slate-605"
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
                    <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 p-6">
                      <p className="text-slate-500 dark:text-slate-300 text-sm font-medium">No accounts in active GTM Pipeline.</p>
                    </div>
                  )}
                </div>
              )
            ) : activeTab === 'clusters' ? (
              /* Account Clusters View */
              <div className="space-y-6">
                {/* Top stats explanation banner */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs border border-slate-800">
                   <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/40 via-transparent to-slate-900 opacity-80" />
                   <div className="relative space-y-2 max-w-2xl text-left">
                     <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[12px] font-bold uppercase tracking-normal border border-indigo-500/30">
                       <Users className="w-3" />
                       <span>Segment Campaign Automation</span>
                     </div>
                     <h3 className="text-xl font-semibold tracking-tight text-white font-sans">Coordinated Pattern Targeting</h3>
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
                       {isClustering ? 'Analyzing Segments...' : 'Recalculate Segments'}
                     </Button>
                   </div>
                </div>

                {isClustering ? (
                  <div className="space-y-6">
                    {[1, 2].map(i => (
                      <div key={i} className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 animate-pulse space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="space-y-2 w-1/3">
                            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                          </div>
                          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                        </div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
                        <div className="flex gap-2">
                          <div className="h-6 bg-slate-150 dark:bg-slate-800 rounded w-20"></div>
                          <div className="h-6 bg-slate-150 dark:bg-slate-800 rounded w-20"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : clusters.length === 0 ? (
                  <div className="text-center py-24 bg-white dark:bg-slate-900 border border-dashed border-slate-205 rounded-3xl p-6">
                    <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-sans">No Target Segments Formed</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-300 max-w-sm mx-auto mt-1 leading-relaxed font-sans font-normal">
                      Segments require active discovered or imported accounts to formulate similarities of scale. Use the "Discovery" tab or upload custom accounts first.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {clusters.map((cluster) => {
                      // Find the actual accounts matching this cluster
                      const matchedAccounts = evaluatedAccounts.filter(a => cluster.accountIds?.includes(a.id));
                      
                      return (
                        <div key={cluster.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-xxs hover:shadow-xs transition-all text-left space-y-6 relative overflow-hidden">
                          {/* Accent left highlight */}
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                          
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 font-sans">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-[17px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">{cluster.clusterName}</h3>
                                <span className="text-[12px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-150 dark:border-indigo-800/50 px-2.5 py-1 rounded-full uppercase tracking-normal">
                                  {cluster.characteristicType}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed font-normal">
                                Formulated based on structural characteristics across <span className="font-semibold text-slate-805 font-mono">{matchedAccounts.length} account{matchedAccounts.length === 1 ? '' : 's'}</span>
                              </p>
                            </div>
                            
                            {/* Copy action */}
                            <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-xs font-semibold gap-1.5 h-8.5 px-3 rounded-lg border-slate-250 dark:border-slate-700 cursor-pointer"
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
                          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 items-center">
                            <span className="text-[12px] font-bold uppercase text-slate-400 tracking-wide mr-2 font-mono">Core Commonalities:</span>
                            {cluster.sharedCharacteristics?.map((char: string, cIdx: number) => (
                              <span key={cIdx} className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg shadow-xxs font-sans">
                                ✨ {char}
                              </span>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                            {/* Attractiveness & Pain Points */}
                            <div className="space-y-5">
                              <div className="space-y-2 text-left">
                                <h4 className="text-[13px] font-semibold uppercase tracking-normal text-slate-400 font-sans flex items-center gap-1.5">
                                  <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                  <span>Collective Attractiveness & ROI Drivers</span>
                                </h4>
                                <p className="text-xs text-slate-650 dark:text-slate-400 leading-relaxed font-sans font-normal bg-emerald-50/10 dark:bg-emerald-950/40 p-3.5 rounded-2xl border border-emerald-100/20 dark:border-emerald-800/50">
                                  {cluster.collectiveAttractiveness}
                                </p>
                              </div>

                              <div className="space-y-2 text-left">
                                <h4 className="text-[13px] font-semibold uppercase tracking-normal text-slate-400 font-sans flex items-center gap-1.5">
                                  <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                                  <span>Shared Common Bottlenecks</span>
                                </h4>
                                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 font-sans">
                                  {cluster.sharedPainPoints?.map((pain: string, pIdx: number) => (
                                    <li key={pIdx} className="flex items-start gap-2.5 bg-rose-50/5 dark:bg-rose-950/40 p-3 rounded-2xl border border-rose-100/10 dark:border-rose-800/50">
                                      <span className="text-rose-500 dark:text-rose-400 shrink-0 select-none text-base leading-none">▪</span>
                                      <span className="leading-relaxed font-normal">{pain}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {/* Campaign Pattern & Target Cards */}
                            <div className="space-y-5">
                              <div className="space-y-2 text-left bg-gradient-to-br from-indigo-50/10 via-slate-50/10 to-transparent p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <h4 className="text-[13px] font-semibold uppercase tracking-normal text-indigo-950 font-sans flex items-center gap-1.5 mb-2">
                                  <Zap className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                  <span>Unified Outreach Pitch Template</span>
                                </h4>
                                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 italic leading-relaxed font-medium shadow-xxs">
                                  "{cluster.unifiedValueMessage}"
                                </div>
                                <div className="pt-3 px-1 text-[13px] text-slate-500 dark:text-slate-300 leading-relaxed font-sans">
                                  <strong className="font-semibold uppercase text-[12px] text-indigo-650 dark:text-indigo-300 block mb-0.5 tracking-normal font-mono">Coordinated Outreach Angle:</strong>
                                  <span className="font-normal">{cluster.coordinatedOutreachAngle}</span>
                                </div>
                              </div>

                              <div className="space-y-2 text-left">
                                <h4 className="text-[13px] font-semibold uppercase tracking-normal text-slate-400 font-sans flex items-center gap-1.5">
                                  <Users className="w-4 h-4 text-slate-400" />
                                  <span>Mapped Accounts in Segment ({matchedAccounts.length})</span>
                                </h4>
                                {matchedAccounts.length === 0 ? (
                                  <p className="text-[13px] text-slate-400 italic py-2 font-normal">No active accounts matched with exclusion rules applied.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {matchedAccounts.map((acc) => (
                                      <div
                                        key={acc.id}
                                        onClick={() => {
                                          onAnalyzeAccount(acc.id);
                                          setSelectedAccountId(acc.id);
                                        }}
                                        className="relative flex items-center justify-between p-3 pl-4 rounded-xl border border-indigo-200/70 dark:border-indigo-500/30 bg-gradient-to-br from-white to-indigo-50/40 dark:from-slate-800/70 dark:to-indigo-950/30 shadow-xs hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-400 hover:-translate-y-0.5 transition-all cursor-pointer text-left group overflow-hidden"
                                      >
                                        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500" />
                                        <div className="space-y-0.5 min-w-0 pr-2">
                                          <div className="font-bold text-[13px] text-slate-900 dark:text-slate-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 truncate transition-colors">{acc.name}</div>
                                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">{acc.domain}</div>
                                        </div>
                                        <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-mono font-bold shadow-xxs group-hover:bg-indigo-500 transition-colors">
                                          {acc.fitScore}%
                                          <ChevronRight className="w-3 h-3 -mr-0.5 transition-transform group-hover:translate-x-0.5" />
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
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs border border-slate-800">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-transparent to-transparent opacity-60" />
                  <div className="relative space-y-2 max-w-2xl">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/25 text-indigo-300 text-[12px] font-bold uppercase tracking-normal border border-indigo-500/30">
                      <Network className="w-3" />
                      <span>Warm Referral & Alliance Intelligence</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-white font-sans">Dynamic Partner Pathways</h3>
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
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
                    <div className="text-[12px] font-bold text-slate-400 uppercase tracking-normal font-sans">Warm Pathways Found</div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-300 font-sans">
                        {filteredAccounts.map(a => getAccountPriorityInfo(a)).filter(p => (p.pathway?.warmIntroductionPaths?.length ?? 0) > 0).length}
                      </span>
                      <span className="text-xs font-bold text-slate-405 text-slate-500 dark:text-slate-300">
                        ({Math.round((filteredAccounts.map(a => getAccountPriorityInfo(a)).filter(p => (p.pathway?.warmIntroductionPaths?.length ?? 0) > 0).length / (filteredAccounts.length || 1)) * 100)}%)
                      </span>
                    </div>
                    <div className="text-[12px] text-slate-400 mt-2 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active warm intro doors open
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
                    <div className="text-[12px] font-bold text-slate-400 uppercase tracking-normal font-sans">Direct Cold Approach</div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-bold text-slate-700 dark:text-slate-300 font-sans font-sans">
                        {filteredAccounts.map(a => getAccountPriorityInfo(a)).filter(p => (p.pathway?.warmIntroductionPaths?.length ?? 0) === 0).length}
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-300">
                        ({Math.round((filteredAccounts.map(a => getAccountPriorityInfo(a)).filter(p => (p.pathway?.warmIntroductionPaths?.length ?? 0) === 0).length / (filteredAccounts.length || 1)) * 100)}%)
                      </span>
                    </div>
                    <div className="text-[12px] text-slate-400 mt-2 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-405 bg-slate-400" /> Cold outreach default index
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
                    <div className="text-[12px] font-bold text-slate-400 uppercase tracking-normal font-sans">Avg. Conversion Likelihood</div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-300 font-sans font-sans">
                        {Math.round(
                          filteredAccounts.map(a => getAccountPriorityInfo(a)).reduce((sum, curr) => sum + (curr.pathway?.channelScore || 32), 0) / (filteredAccounts.length || 1)
                        )}%
                      </span>
                      <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400">
                        ▲ Lifted
                      </span>
                    </div>
                    <div className="text-[12px] text-slate-400 mt-2 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-505 bg-emerald-500 animate-pulse" /> Assisted vs cold conversion lift
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
                    <div className="text-[12px] font-bold text-slate-400 uppercase tracking-normal font-sans">Defined Networks</div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-bold text-indigo-900 dark:text-indigo-200 font-sans">
                        {channelPartners.length}
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-300">Alliances</span>
                    </div>
                    <div className="text-[12px] text-slate-400 mt-2 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Live scanning active
                    </div>
                  </div>
                </div>

                {/* Main splitting columns for Desktop */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                  {/* Left list: Account assessments */}
                  <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden">
                      <div className="px-6 py-5 border-b border-slate-150 dark:border-slate-700 flex items-center justify-between">
                        <div className="text-left space-y-0.5">
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 font-sans">Dynamic Account Pathway Matrix</h4>
                          <p className="text-[13px] text-slate-500 dark:text-slate-300">
                            Scanned accounts mapped in order of warm conversion capability.
                          </p>
                        </div>
                        <Badge variant="outline" className="text-slate-550 border-slate-200 dark:border-slate-700 text-[12px]">
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
                                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{acc.name}</span>
                                      <span className="text-[12px] font-mono text-slate-400">({acc.domain})</span>
                                      
                                      {/* Approach Type Tag */}
                                      {pathway?.approachType === 'Direct' ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase tracking-normal font-mono">
                                          Direct Outreach
                                        </span>
                                      ) : pathway?.approachType === 'Channel Partner' ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800/50 uppercase tracking-normal font-mono">
                                          Channel Partner Pathway
                                        </span>
                                      ) : pathway?.approachType === 'Integration Partner' ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50 uppercase tracking-normal font-mono">
                                          Integration Partner Pathway
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-100 dark:border-emerald-800/50 uppercase tracking-normal font-mono">
                                          Mutual Warm Referral
                                        </span>
                                      )}
                                    </div>
                                    
                                    <p className="text-xs text-slate-500 dark:text-slate-300 line-clamp-2 leading-relaxed font-normal">
                                      {acc.description || "No company overview provided."}
                                    </p>

                                    {/* Mapped warm introduction pathways detail tags */}
                                    {wsFound && pathway && (
                                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                        <span className="text-[12px] text-slate-400 font-bold uppercase tracking-normal font-mono">Paths Tracked:</span>
                                        {pathway.warmIntroductionPaths.map((p, pIdx) => {
                                          let colorCode = 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                                          if (p.type === 'vendor') colorCode = 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-100 dark:border-sky-800/50';
                                          if (p.type === 'ecosystem') colorCode = 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800/50';
                                          if (p.type === 'investment') colorCode = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-800/50';
                                          if (p.type === 'association') colorCode = 'bg-amber-50 dark:bg-amber-950/40 text-amber-705 text-amber-850 dark:text-amber-200 border-amber-150 dark:border-amber-800/50';
                                          if (p.type === 'defined_network') colorCode = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-150 dark:border-emerald-800/50 font-bold';

                                          return (
                                            <Badge key={pIdx} variant="outline" className={`text-[11px] py-0.5 px-2 rounded-lg font-sans ${colorCode}`} title={p.description}>
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
                                      <div className="text-[11px] text-slate-400 uppercase font-bold font-mono tracking-normal">Likelihood Score</div>
                                      <div className="flex items-baseline gap-1 mt-0.5">
                                        <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-sans">{(pathway?.channelScore ?? 32)}%</span>
                                        <span className="text-[11px] text-slate-450 font-mono">Assisted</span>
                                      </div>
                                      <div className="text-[11px] font-mono text-slate-400">
                                        Direct Fit: {acc.fitScore}%
                                      </div>
                                    </div>
                                    
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedPathwayStrategyAccount(acc)}
                                      className="border-indigo-150 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 hover:text-indigo-805 hover:bg-indigo-50/40 text-xs font-bold rounded-xl h-9 px-3.5 cursor-pointer shadow-3xs"
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
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-left space-y-0.5">
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 font-sans">Active Partners Grid</h4>
                          <p className="text-[12px] text-slate-400 leading-normal">
                            Configure networks scanned by the matching engine.
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={handleStartAddPartner}
                          className="h-8 w-8 text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 hover:bg-slate-50 border border-slate-100 dark:border-slate-800 rounded-lg cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="space-y-3 max-h-[850px] overflow-y-auto pr-1">
                        {channelPartners.map((partner) => (
                          <div key={partner.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2 text-left relative group/opt">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate pr-5">{partner.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  partner.strength === 'High' ? 'bg-emerald-500' :
                                  partner.strength === 'Medium' ? 'bg-amber-400' : 'bg-slate-400'
                                }`} title={`Relationship: ${partner.strength}`}/>
                                <Badge variant="outline" className="text-[10px] uppercase px-1 rounded bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shrink-0 font-mono text-slate-500 dark:text-slate-300 tracking-normal">
                                  {partner.type}
                                </Badge>
                              </div>
                            </div>

                            <p className="text-[13px] text-slate-500 dark:text-slate-300 leading-relaxed font-normal line-clamp-2">
                              {partner.description}
                            </p>

                            <div className="flex flex-wrap gap-1">
                              {partner.keywords.map((kw, kwIdx) => (
                                <span key={kwIdx} className="text-[11px] font-mono bg-white dark:bg-slate-900 text-slate-450 border border-slate-200 dark:border-slate-700/50 px-1.5 py-0.2 rounded font-medium">
                                  #{kw}
                                </span>
                              ))}
                            </div>

                            {partner.warmContact && (
                              <div className="text-[12px] text-slate-400 flex items-center gap-1 mt-1 font-sans">
                                <span className="font-bold text-slate-500 dark:text-slate-300">Contact:</span>
                                <span>{partner.warmContact}</span>
                              </div>
                            )}

                            {/* Hover Options */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/opt:opacity-100 transition-opacity bg-slate-50 dark:bg-slate-800/50 pl-2 rounded">
                              <button 
                                onClick={() => handleStartEditPartner(partner)}
                                className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-indigo-600 hover:bg-slate-50 cursor-pointer shadow-3xs"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                              <button 
                                onClick={() => handleDeletePartner(partner.id)}
                                className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-red-600 hover:bg-slate-50 cursor-pointer shadow-3xs"
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

                {/* Modal to add/edit channel partner dynamically */}
                <Dialog open={isPartnerFormOpen} onOpenChange={setIsPartnerFormOpen}>
                  <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 rounded-2xl font-sans shadow-sm max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="space-y-1.5 text-left border-b border-slate-100 dark:border-slate-800 pb-3">
                      <DialogTitle className="font-medium text-sm text-slate-900 dark:text-slate-100 font-sans">
                        {partnerFormType === 'add' ? 'Define New Referral Partner or Network' : 'Edit Alliance Network Configuration'}
                      </DialogTitle>
                      <DialogDescription className="text-[12px] text-slate-500 dark:text-slate-400 font-sans">
                        Configure how this partner surfaces on the partner pathway assessments.
                      </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleAddOrEditPartnerSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {/* Name */}
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-bold text-slate-400 uppercase tracking-normal font-sans">Partner Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Autodesk Systems Alliance, Gensler Partners"
                          value={newPartnerName}
                          onChange={(e) => setNewPartnerName(e.target.value)}
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/50 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      {/* Connection Type */}
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-bold text-slate-400 uppercase tracking-normal font-sans">Connection Type</label>
                        <select
                          value={newPartnerType}
                          onChange={(e: any) => setNewPartnerType(e.target.value)}
                          className="w-full text-xs h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/50 focus:ring-1 focus:ring-indigo-500 outline-none"
                        >
                          <option value="channel">Channel Partner / Distributor</option>
                          <option value="integration">Integration Partner / ISV Alliance</option>
                          <option value="referral">Mutual Connection / Referral Network</option>
                          <option value="investor">Accelerator / Investor Syndicate</option>
                        </select>
                      </div>

                      {/* Strength */}
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-bold text-slate-400 uppercase tracking-normal font-sans">Alliance Strength</label>
                        <select
                          value={newPartnerStrength}
                          onChange={(e: any) => setNewPartnerStrength(e.target.value)}
                          className="w-full text-xs h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/50 focus:ring-1 focus:ring-indigo-500 outline-none"
                        >
                          <option value="High">High (Direct trusted referral pipeline)</option>
                          <option value="Medium">Medium (Loose association / shared board portfolio)</option>
                          <option value="Low">Low (Passive vendor alignment only)</option>
                        </select>
                      </div>

                      {/* Warm Contact */}
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-bold text-slate-400 uppercase tracking-normal font-sans">Key Warm Contact Name/Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Sarah Jenkins (VP Global Alliances)"
                          value={newPartnerWarmContact}
                          onChange={(e) => setNewPartnerWarmContact(e.target.value)}
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/50 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      {/* Keywords */}
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[12px] font-bold text-slate-400 uppercase tracking-normal font-sans">Keyword Match Tags (comma separated) *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. autodesk, revit, bim, drafting, series a"
                          value={newPartnerKeywords}
                          onChange={(e) => setNewPartnerKeywords(e.target.value)}
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/50 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                        <p className="text-[11px] text-slate-400 leading-normal">
                          Keywords are matched against target account description, industry, funding signals, and tech stack tags.
                        </p>
                      </div>

                      {/* Description */}
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[12px] font-bold text-slate-400 uppercase tracking-normal font-sans">Strategic Partner Footprint</label>
                        <textarea
                          rows={2}
                          placeholder="Brief description of the alliance scope, shared workflows, or reference portfolios..."
                          value={newPartnerDescription}
                          onChange={(e) => setNewPartnerDescription(e.target.value)}
                          className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/50 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                        />
                      </div>

                      <DialogFooter className="md:col-span-2 pt-2 gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsPartnerFormOpen(false)}
                          className="text-slate-500 dark:text-slate-300 hover:text-slate-700 h-10 px-4 cursor-pointer"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold h-10 px-6 rounded-xl shadow-xs border-0 text-xs cursor-pointer"
                        >
                          {partnerFormType === 'add' ? 'Save New Partner' : 'Apply Configuration'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            ) : viewMode === 'grid' ? (
              /* Standard Pulse/Discovery Grid View */
              <motion.div 
                layout
                className="grid grid-cols-1 xl:grid-cols-2 gap-5 animate-fadeIn"
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
                  <div className="col-span-full py-16 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 p-6">
                    <p className="text-slate-500 dark:text-slate-300 text-sm font-medium">No results match your search or filter configuration.</p>
                    <Button 
                      variant="link" 
                      onClick={() => { setSearchQuery(''); setSelectedFilters([]); }} 
                      className="text-indigo-600 dark:text-indigo-300 mt-2 h-auto p-0"
                    >
                      Clear search filters
                    </Button>
                  </div>
                )}
              </motion.div>
            ) : (
              /* Standard Pulse/Discovery Compact List View — slim horizontal split */
              <div className="flex flex-col gap-2.5 animate-fadeIn">
                {sortedFilteredAccounts.map((account) => {
                  const info = getAccountPriorityInfo(account);

                  const fitTone = account.isDisqualified ? 'text-red-600 dark:text-red-300'
                    : info.fitScore >= 80 ? 'text-emerald-600 dark:text-emerald-300'
                    : info.fitScore >= 60 ? 'text-amber-600 dark:text-amber-300'
                    : 'text-slate-500 dark:text-zinc-400';
                  const timingTone = account.isDisqualified ? 'text-red-600 dark:text-red-300'
                    : info.timingScore >= 80 ? 'text-rose-600 dark:text-rose-300'
                    : info.timingScore >= 60 ? 'text-amber-600 dark:text-amber-300'
                    : 'text-purple-600 dark:text-purple-300';

                  let tierBorder = 'border-amber-400 dark:border-amber-700/60 hover:border-amber-500 dark:hover:border-amber-600/70';
                  let railBg = 'bg-amber-50/70 dark:bg-amber-500/10';
                  let chipClass = 'bg-amber-100 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300';
                  let scoreText = 'text-amber-700 dark:text-amber-300';
                  let chipLabel = 'Standard';
                  let showDot = false;
                  if (account.isDisqualified) {
                    tierBorder = 'border-red-200/70 dark:border-red-900/50 border-dashed';
                    railBg = 'bg-red-50/40 dark:bg-red-500/5';
                    chipClass = 'bg-red-100/70 dark:bg-red-500/15 border-red-200 dark:border-red-500/25 text-red-700 dark:text-red-300';
                    scoreText = 'text-red-500 dark:text-red-400';
                    chipLabel = 'Excluded';
                  } else if (info.reResearchRecommended) {
                    tierBorder = 'border-amber-300/70 dark:border-amber-800/50 border-dashed';
                    railBg = 'bg-amber-50/40 dark:bg-amber-500/5';
                    chipClass = 'bg-amber-100/70 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-300';
                    scoreText = 'text-amber-600 dark:text-amber-300';
                    chipLabel = 'Re-research';
                  } else if (info.priorityFlag === 'Immediate Action Required') {
                    tierBorder = 'border-rose-300/70 dark:border-rose-800/50 hover:border-rose-400 dark:hover:border-rose-700/60';
                    railBg = 'bg-rose-50/40 dark:bg-rose-500/5';
                    chipClass = 'bg-rose-100/70 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300';
                    scoreText = 'text-rose-700 dark:text-rose-300';
                    chipLabel = 'Immediate';
                    showDot = true;
                  } else if (info.priorityFlag === 'Warm Track') {
                    tierBorder = 'border-teal-300/70 dark:border-teal-800/50 hover:border-teal-400 dark:hover:border-teal-700/60';
                    railBg = 'bg-teal-50/40 dark:bg-teal-500/5';
                    chipClass = 'bg-teal-100/70 dark:bg-teal-500/15 border-teal-200 dark:border-teal-500/25 text-teal-700 dark:text-teal-300';
                    scoreText = 'text-teal-700 dark:text-teal-300';
                    chipLabel = 'Warm Track';
                  }

                  return (
                    <motion.div
                      layout
                      key={account.id}
                      whileHover={{ x: 2 }}
                      onClick={() => {
                        onAnalyzeAccount(account.id);
                        setSelectedAccountId(account.id);
                      }}
                      className={`rounded-xl bg-white dark:bg-[#2A2A2B] border transition-all cursor-pointer group flex flex-col sm:flex-row overflow-hidden shadow-xs hover:shadow-sm ${tierBorder}`}
                    >
                      {/* LEFT RAIL: chip + big score */}
                      <div className={`w-full sm:w-28 shrink-0 flex sm:flex-col items-center justify-between sm:justify-center gap-2 sm:gap-1 px-3 py-2 sm:py-3 sm:border-r border-b sm:border-b-0 border-slate-100 dark:border-white/[0.05] ${railBg}`}>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-normal border ${chipClass}`}>
                          {showDot && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                            </span>
                          )}
                          {chipLabel}
                        </span>
                        <div className={`text-2xl font-semibold font-mono leading-none ${scoreText}`} style={{ letterSpacing: '-0.03em' }}>
                          {account.isDisqualified ? '—' : info.priorityIndex}
                        </div>
                      </div>

                      {/* RIGHT BODY: identity + stats + description + signals + actions */}
                      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3.5">
                        {/* Identity + description + signals */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate" style={{ letterSpacing: '-0.015em' }}>
                              {account.name}
                            </h3>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 truncate">
                              {account.domain}
                            </span>
                          </div>
                          <p className="text-[12px] text-slate-600 dark:text-zinc-300 line-clamp-1 mb-1.5 leading-relaxed">
                            {account.description || account.fitReason}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(account.signals || []).slice(0, 3).map((sig, i) => (
                              <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-zinc-300 border border-slate-150 dark:border-white/[0.05] leading-snug">
                                {sig}
                              </span>
                            ))}
                            {(account.signals || []).length > 3 && (
                              <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                                +{(account.signals || []).length - 3}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Compact stats + CTA */}
                        <div className="flex items-center gap-4 sm:gap-5 shrink-0 sm:border-l border-slate-100 dark:border-white/[0.05] sm:pl-4">
                          <div className="text-center">
                            <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">Fit</div>
                            <div className={`text-sm font-semibold font-mono ${fitTone}`}>{info.fitScore}%</div>
                          </div>
                          <div className="text-center">
                            <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">Timing</div>
                            <div className={`text-sm font-semibold font-mono ${timingTone}`}>{info.timingScore}%</div>
                          </div>
                          <div className="flex flex-col items-end gap-1 min-w-[110px]">
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{info.outreachWindow}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 px-2 h-7 text-[12px] font-semibold gap-1 cursor-pointer"
                            >
                              View Intel <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {sortedFilteredAccounts.length === 0 && accounts.length > 0 && (
                  <div className="py-16 text-center border border-dashed border-slate-205 rounded-2xl bg-white dark:bg-slate-900 p-6">
                    <p className="text-slate-500 dark:text-slate-300 text-sm font-medium">No results match your search or filter configuration.</p>
                    <Button 
                      variant="link" 
                      onClick={() => { setSearchQuery(''); setSelectedFilters([]); }} 
                      className="text-indigo-600 dark:text-indigo-300 mt-2 h-auto p-0"
                    >
                      Clear search filters
                    </Button>
                  </div>
                )}
              </div>
            )}

            {accounts.length === 0 && !isDiscovering && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center justify-center py-24 text-center space-y-5"
              >
                <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 border border-orange-100 dark:border-orange-900/30 text-orange-400 dark:text-orange-400">
                  <Radar className="w-10 h-10" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-zinc-100 text-lg tracking-tight">No accounts discovered yet</h3>
                  <p className="text-zinc-400 max-w-xs text-[13px] leading-relaxed">Run an autonomous scan to surface high-intent accounts that match your ICP.</p>
                </div>
                <Button
                  onClick={onRefreshDiscovery}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold shadow-[0_1px_2px_rgba(245,130,32,0.35)] border-0 gap-2"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Start Discovery
                </Button>
              </motion.div>
            )}
          </div>
        </motion.section>
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
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-205 p-6 rounded-2xl shadow-sm z-50">
          {crmConnected !== 'none' ? (
            /* Connected Content */
            <div className="text-center py-4 px-2 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-300 mx-auto">
                <CheckCircle2 className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Secure Sync Connection Active</h3>
                <p className="text-[13px] text-slate-500 dark:text-slate-300 leading-normal max-w-xs mx-auto">
                  Your workspace is dynamically syncing CAD Design intent signals and buyer personas with **{getCrmName(crmConnected).toUpperCase()}**.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-left border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-[12px] text-slate-500 dark:text-slate-300">
                  <span>Last Automated Sync</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Just now (100% complete)</span>
                </div>
                <div className="flex justify-between items-center text-[12px] text-slate-500 dark:text-slate-300">
                  <span>Synced Accounts</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{accounts.length} organizations matched</span>
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
                  className="text-xs text-red-500 dark:text-red-400 hover:text-red-655 hover:bg-red-50 h-9"
                >
                  Disconnect API
                </Button>
              </div>
            </div>
          ) : crmStep === 1 ? (
            /* Select CRM Step 1 */
            <>
              <DialogHeader>
                <DialogTitle className="text-slate-900 dark:text-slate-100 font-semibold text-base">Connect CRM System</DialogTitle>
                <DialogDescription className="text-slate-500 dark:text-slate-300 text-xs text-left leading-normal">
                  Synchronize qualified target accounts, key buyer personas, and CAD CAD operational triggers seamlessly with your CRM pipeline.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 gap-2.5 px-1 py-2">
                <button 
                  onClick={() => setSelectedCrmType('hubspot')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${selectedCrmType === 'hubspot' ? 'border-orange-500 bg-orange-50/20 dark:bg-orange-950/40 shadow-xs' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center font-bold text-orange-600 dark:text-orange-300 shrink-0 text-xs select-none">HS</div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">HubSpot Integration</div>
                    <div className="text-[13px] text-slate-500 dark:text-slate-300 mt-0.5 leading-normal">Sync companies, contact records, and custom intent signals in real time.</div>
                  </div>
                </button>
                <button 
                  onClick={() => setSelectedCrmType('salesforce')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${selectedCrmType === 'salesforce' ? 'border-sky-505 bg-sky-50/20 dark:bg-sky-950/40 shadow-xs' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-102 flex items-center justify-center font-bold text-sky-600 dark:text-sky-300 shrink-0 text-xs select-none">SF</div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Salesforce Integration</div>
                    <div className="text-[13px] text-slate-500 dark:text-slate-300 mt-0.5 leading-normal">Map overall ICP fit score and prioritized buyers to active prospect lists.</div>
                  </div>
                </button>
                <button 
                  onClick={() => setSelectedCrmType('pipedrive')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${selectedCrmType === 'pipedrive' ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/40 shadow-xs' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-300 shrink-0 text-xs select-none">PD</div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Pipedrive Integration</div>
                    <div className="text-[13px] text-slate-500 dark:text-slate-300 mt-0.5 leading-normal">Convert discovered profiles into active leads directly inside visual deals.</div>
                  </div>
                </button>
                <button 
                  onClick={() => setSelectedCrmType('prospectaccel')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${selectedCrmType === 'prospectaccel' ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/40 shadow-xs' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center font-bold text-indigo-605 shrink-0 text-xs select-none">PA</div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Prospect Accel Integration</div>
                    <div className="text-[13px] text-slate-500 dark:text-slate-300 mt-0.5 leading-normal">Synchronize high-converting targeted matches and real-time triggers seamlessly.</div>
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
                <DialogTitle className="text-slate-900 dark:text-slate-100 font-semibold text-base">Configure CRM Access</DialogTitle>
                <DialogDescription className="text-slate-500 dark:text-slate-300 text-xs text-left leading-normal">
                  Please provide access credentials to authorize synchronization with **{getCrmName(selectedCrmType).toUpperCase()}**.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 px-1 py-1">
                <div className="flex items-center gap-2">
                  <button onClick={() => setCrmStep(1)} className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline">← Platform Choices</button>
                  <span className="text-slate-200 text-xs">|</span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-300">Integrating secure systems</span>
                </div>

                {selectedCrmType === 'salesforce' && (
                  <div className="space-y-1">
                    <label className="text-[13px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Salesforce Instance URL</label>
                    <input 
                      type="text" 
                      value={crmUrl} 
                      onChange={(e) => setCrmUrl(e.target.value)} 
                      placeholder="https://yourcompany.my.salesforce.com" 
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[13px] font-bold text-slate-655 uppercase tracking-wide">API Personal Token / secrets</label>
                  <input 
                    type="password" 
                    value={crmApiKey} 
                    onChange={(e) => setCrmApiKey(e.target.value)} 
                    placeholder={selectedCrmType === 'hubspot' ? 'pat-na1-xxxx-xxxx-xxxx-xxxx' : selectedCrmType === 'prospectaccel' ? 'pa-live-xxxx-xxxx-xxxx' : 'Enter access token...'} 
                    className="w-full h-9 px-3 text-xs rounded-lg border border-slate-205 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-3 text-[12px] text-slate-500 dark:text-slate-300 leading-normal flex items-start gap-2">
                  <CloudLightning className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>Your credentials are encrypted inside standard secure client-side storage sessions and sent over TLS.</span>
                </div>
              </div>

              <DialogFooter className="mt-4 gap-2 flex flex-row">
                <Button 
                  variant="outline" 
                  onClick={() => setCrmStep(1)}
                  className="flex-1 text-slate-500 dark:text-slate-300 text-xs h-9 border-slate-200 dark:border-slate-700"
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-6 z-50 space-y-5 text-left font-sans"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-tight">Save Market Scope View</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Lock in your current calibrated targets, fit filters, and pipeline stages.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Report / Outreach Name</label>
                <input
                  type="text"
                  value={reportNameInput}
                  onChange={(e) => setReportNameInput(e.target.value)}
                  placeholder="e.g. Outreach - APAC Market Expansion"
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="flex gap-2.5 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="flex-1 text-slate-500 dark:text-slate-300 hover:text-slate-800 hover:bg-slate-50 h-10 text-xs font-bold cursor-pointer"
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-6 z-50 text-left font-sans space-y-6"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-1.5">
                      <span>Edit Market Strategy Blueprint</span>
                      <span className="text-[12px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/50 uppercase">Interactive</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-300">Recalibrate target buyer details, fit signals, and core definitions.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Seller Business Name</label>
                  <input
                    type="text"
                    value={editBusinessName}
                    onChange={(e) => setEditBusinessName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Target Industries (comma-separated)</label>
                  <input
                    type="text"
                    value={editTargetIndustries}
                    onChange={(e) => setEditTargetIndustries(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Product/Business Overview Summary</label>
                  <textarea
                    rows={2}
                    value={editOverview}
                    onChange={(e) => setEditOverview(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 dark:text-slate-200 text-xs"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Core Enterprise Value Proposition</label>
                  <textarea
                    rows={2}
                    value={editValueProp}
                    onChange={(e) => setEditValueProp(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 dark:text-slate-200 text-xs"
                  />
                </div>

                <div className="space-y-2 md:col-span-2 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-4">
                  <h4 className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide border-b border-indigo-100 dark:border-indigo-800/50 pb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /> Key Ideal Customer Persona (ICP) Controls
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">ICP Profile Name</label>
                      <input
                        type="text"
                        value={editIcpTitle}
                        onChange={(e) => setEditIcpTitle(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Target Buyer Titles (comma-separated)</label>
                      <input
                        type="text"
                        value={editTargetRoles}
                        onChange={(e) => setEditTargetRoles(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Intent Signals / Buying Actions (comma-separated)</label>
                    <input
                      type="text"
                      value={editBuyingSignals}
                      onChange={(e) => setEditBuyingSignals(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">ICP Audience Strategy & Scope Details</label>
                    <textarea
                      rows={2}
                      value={editIcpDescription}
                      onChange={(e) => setEditIcpDescription(e.target.value)}
                      className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditReportOpen(false)}
                  className="flex-1 text-slate-500 dark:text-slate-300 hover:text-slate-800 hover:bg-slate-50 h-10 text-xs font-bold cursor-pointer"
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-6 z-50 text-left font-sans space-y-5"
            >
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-tight">Append Target Organization</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">Add a hand-crafted prospect company directly into this outreach report view.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Spaceworks"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 dark:text-slate-200 font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Website Domain *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. acme.space"
                    value={newAccDomain}
                    onChange={(e) => setNewAccDomain(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 dark:text-slate-200 font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">ICP Fit Score (1 - 100)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={newAccFitScore}
                      onChange={(e) => setNewAccFitScore(Number(e.target.value))}
                      className="flex-1 accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none"
                    />
                    <span className="w-12 h-9 border border-slate-200 dark:border-slate-700 rounded-lg md:text-sm font-bold font-mono text-center flex items-center justify-center bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 select-none">
                      {newAccFitScore}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Observed Intent Timing (1 - 100)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={newAccTimingScore}
                      onChange={(e) => setNewAccTimingScore(Number(e.target.value))}
                      className="flex-1 accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none"
                    />
                    <span className="w-12 h-9 border border-slate-200 dark:border-slate-700 rounded-lg md:text-sm font-bold font-mono text-center flex items-center justify-center bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 select-none">
                      {newAccTimingScore}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Specific Observed Signals (comma-separated tags)</label>
                  <input
                    type="text"
                    value={newAccSignals}
                    onChange={(e) => setNewAccSignals(e.target.value)}
                    placeholder="e.g. Cloud scaling, recent product expansion, job openings"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Company Overview / Outreach Strategy Description</label>
                  <textarea
                    rows={2}
                    value={newAccOverview}
                    placeholder="Highlight specific reasons and technical needs that make Acme Spaceworks a fantastic prospect..."
                    onChange={(e) => setNewAccOverview(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddAccountOpen(false)}
                  className="flex-1 text-slate-500 dark:text-slate-300 hover:text-slate-800 hover:bg-slate-50 h-10 text-xs font-bold cursor-pointer"
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
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 rounded-2xl font-sans select-none shadow-sm">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-slate-900 dark:text-slate-100 font-semibold text-base flex items-center gap-2">
              <Pencil className="w-4 h-4 text-indigo-605" />
              <span>Rename Current Plan</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-300">
              Change the display title of the loaded outbound strategy blueprint.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-left">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-normal">Plan Name</label>
              <input
                type="text"
                value={newReportName}
                onChange={(e) => setNewReportName(e.target.value)}
                placeholder="e.g. outreach wave standard..."
                className="w-full h-10 px-3.5 rounded-lg border border-slate-205 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <DialogFooter className="flex sm:justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRenameReportOpen(false)}
              className="text-slate-500 dark:text-slate-300 hover:text-slate-800 text-xs font-bold h-9 bg-white dark:bg-slate-900 border border-transparent shadow-none"
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
        <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 rounded-2xl font-sans text-left shadow-sm max-h-[90vh] overflow-y-auto">
          {selectedPathwayStrategyAccount && (() => {
            const acc = selectedPathwayStrategyAccount;
            const info = getAccountPriorityInfo(acc);
            const pathway = info.pathway;
            const wsFound = (pathway?.warmIntroductionPaths?.length ?? 0) > 0;
            
            return (
              <>
                <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-300">
                      <Network className="w-4 h-4" />
                    </div>
                    <DialogTitle className="text-slate-900 dark:text-slate-100 font-medium text-base">
                      Referral Routing Plan: {acc.name}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="text-xs text-slate-500 dark:text-slate-300 text-left">
                    Calculated pathway leveraging mutual ecosystems, shared vendor stacks, or active partner referral grids.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-3 text-left">
                  {/* Stats Row */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="space-y-0.5">
                      <span className="text-[12px] font-bold text-slate-400 uppercase tracking-normal font-mono">Conversion Likelihood</span>
                      <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-300 font-sans">
                        {pathway?.channelScore ?? 32}%
                        <span className="text-xs text-slate-400 font-normal ml-1">(assisted list)</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[12px] font-bold text-slate-400 uppercase tracking-normal font-mono">Cold Fit Rating</span>
                      <div className="text-xl font-semibold text-slate-700 dark:text-slate-300 font-sans">
                        {acc.fitScore ?? 75}%
                        <span className="text-xs text-slate-400 font-normal ml-1">(traditional index)</span>
                      </div>
                    </div>
                  </div>

                  {/* Approach Type */}
                  <div className="space-y-1 font-sans">
                    <h5 className="text-[12px] font-semibold text-slate-400 uppercase tracking-normal font-mono">Assessed Approach Pathway</h5>
                    <div className="flex items-center gap-2 mt-1">
                      {pathway?.approachType === 'Direct' ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-105 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Direct Outreach (Default fallback due to lack of overlapping warm nodes)
                        </span>
                      ) : pathway?.approachType === 'Channel Partner' ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-150 dark:border-amber-800/50">
                          Channel Partner Assisted: Approaches should be co-routed through physical distribution partners
                        </span>
                      ) : pathway?.approachType === 'Integration Partner' ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border border-blue-150 dark:border-blue-800/50">
                          Integration Partner Shared Hub: Leverage synchronized product and tech alliances
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-150 dark:border-emerald-800/50">
                          Mutual Connection Introduction: Highly warm relationship thread identified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Warm Intro Connections List */}
                  {wsFound && (
                    <div className="space-y-2">
                      <h5 className="text-[12px] font-semibold text-slate-400 uppercase tracking-normal font-mono">Identified Introducer Nodes</h5>
                      <div className="space-y-2">
                        {pathway?.warmIntroductionPaths.map((p, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 font-sans">{p.name}</span>
                              <Badge variant="outline" className="text-[11px] uppercase font-bold shrink-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                                {p.type === 'defined_network' ? 'Your Referral Network' : p.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                              {p.description}
                            </p>
                            {p.introducedBy && (
                              <div className="text-[12px] text-slate-500 dark:text-slate-300 font-medium font-sans">
                                Introducer Concept: <strong className="text-indigo-650 dark:text-indigo-300">{p.introducedBy}</strong>
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
                        <h5 className="text-[12px] font-semibold text-slate-400 uppercase tracking-normal font-mono">Personalized Pathway Outreach Sequence</h5>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const text = `Subject: ${pathway.distinctOutreachStrategy?.headline}\n\n${pathway.distinctOutreachStrategy?.introHook}\n\nSequence:\n${pathway.distinctOutreachStrategy?.sequenceSteps.join('\n')}`;
                            navigator.clipboard.writeText(text);
                            toast.success("Outreach copy strategy copied to clipboard!");
                          }}
                          className="h-7 text-[12px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-indigo-700 dark:text-indigo-300 font-bold px-2.5 rounded-lg cursor-pointer flex items-center gap-1"
                        >
                          Copy Strategy Draft
                        </Button>
                      </div>

                      <div className="space-y-2.5 font-sans">
                        <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50 bg-indigo-50/20 dark:bg-indigo-950/40 text-xs font-mono space-y-2 max-h-[160px] overflow-y-auto leading-relaxed">
                          <div className="font-bold text-slate-900 dark:text-slate-100 border-b border-indigo-50 pb-1">
                            Subject: {pathway.distinctOutreachStrategy.headline}
                          </div>
                          <div className="text-slate-705 text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {pathway.distinctOutreachStrategy.introHook}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-normal font-mono font-sans">Sequenced Multitouch Campaign</label>
                          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                            {pathway.distinctOutreachStrategy.sequenceSteps.map((step, sIdx) => (
                              <div key={sIdx} className="bg-slate-55 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex items-start gap-2.5 leading-relaxed">
                                <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
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

                <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-3">
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
    <div className="bg-slate-100 dark:bg-slate-800/70 p-4 rounded-2xl flex flex-col h-[calc(100vh-250px)] min-h-[480px] border border-slate-200 dark:border-slate-700/50 shadow-inner">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
            <span>{title}</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-xs">{count}</span>
          </h3>
        </div>
        <p className="text-[13px] text-slate-500 dark:text-slate-300 leading-tight">{description}</p>
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
            <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 py-14 text-center text-slate-400 text-xs bg-slate-50/50 dark:bg-slate-800/50">
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
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all cursor-pointer ${
        active
        ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
      }`}
      style={{ letterSpacing: '-0.005em' }}
    >
      {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4' })}
      {label}
    </button>
  );
}

function MetricItem({ label, value, color = 'text-slate-900 dark:text-slate-100' }: { label: string, value: string, color?: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1">
      <span className="text-xs text-slate-500 dark:text-slate-300 font-medium">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}
