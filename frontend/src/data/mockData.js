export const navigationItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'findings', label: 'Findings' },
  { id: 'companies', label: 'Companies' },
  { id: 'sources', label: 'Sources' },
  { id: 'visualizations', label: 'Visualizations' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
]

export const findings = [
  {
    id: 1,
    company: 'TechNova GmbH',
    type: 'Credential Leak',
    severity: 'Critical',
    riskScore: 92,
    status: 'New',
    detectedAt: '2026-05-04 10:15',
    source: 'Paste Site',
    affected: 'Email: admin@technova.de',
    region: 'Germany',
    flag: 'DE',
  },
  {
    id: 2,
    company: 'CloudBridge SE',
    type: 'Password Dump',
    severity: 'High',
    riskScore: 88,
    status: 'New',
    detectedAt: '2026-05-03 12:05',
    source: 'Leak Database',
    affected: 'Affected: 1,245 accounts',
    region: 'Sweden',
    flag: 'SE',
  },
  {
    id: 3,
    company: 'DataStream Corp',
    type: 'Email Exposure',
    severity: 'Medium',
    riskScore: 75,
    status: 'Reviewing',
    detectedAt: '2026-05-03 09:45',
    source: 'Dark Web Forum',
    affected: 'Affected: 532 emails',
    region: 'United States',
    flag: 'US',
  },
  {
    id: 4,
    company: 'SecureNet Ltd',
    type: 'Database Leak',
    severity: 'Critical',
    riskScore: 95,
    status: 'Escalated',
    detectedAt: '2026-05-02 16:30',
    source: 'Breach Archive',
    affected: 'Affected: 3.1M records',
    region: 'United Kingdom',
    flag: 'UK',
  },
  {
    id: 5,
    company: 'Alpha Solutions',
    type: 'API Key Exposure',
    severity: 'Low',
    riskScore: 45,
    status: 'Reviewed',
    detectedAt: '2026-05-02 11:20',
    source: 'Git Mirror',
    affected: 'Token: production service key',
    region: 'Netherlands',
    flag: 'NL',
  },
  {
    id: 6,
    company: 'NordStack Labs',
    type: 'Slack Export Leak',
    severity: 'High',
    riskScore: 83,
    status: 'Reviewing',
    detectedAt: '2026-05-01 18:05',
    source: 'Forum Thread',
    affected: 'Affected: internal chat export',
    region: 'Norway',
    flag: 'NO',
  },
]

export const liveFeed = [
  {
    id: 1,
    tone: 'bg-rose-400',
    title: 'New credential leak detected',
    company: 'TechNova GmbH',
    time: '10:15:32',
  },
  {
    id: 2,
    tone: 'bg-orange-400',
    title: 'Password dump added to database',
    company: 'CloudBridge SE',
    time: '10:12:41',
  },
  {
    id: 3,
    tone: 'bg-amber-400',
    title: 'Email exposure detected',
    company: 'DataStream Corp',
    time: '10:09:17',
  },
  {
    id: 4,
    tone: 'bg-sky-400',
    title: 'New source connected',
    company: 'Dark Web Forum',
    time: '10:07:55',
  },
  {
    id: 5,
    tone: 'bg-emerald-400',
    title: 'API key exposure detected',
    company: 'Alpha Solutions',
    time: '10:05:21',
  },
]

export const timelineData = [
  { date: 'Apr 28', findings: 0.6 },
  { date: 'Apr 29', findings: 1.6 },
  { date: 'Apr 30', findings: 1.1 },
  { date: 'May 1', findings: 1.7 },
  { date: 'May 2', findings: 2.4 },
  { date: 'May 3', findings: 1.6 },
  { date: 'May 4', findings: 4.0 },
]

export const dataSources = [
  { id: 1, label: 'Dark Web Forums', value: '2,847' },
  { id: 2, label: 'Paste Sites', value: '1,234' },
  { id: 3, label: 'Leak Databases', value: '567' },
  { id: 4, label: 'Social Media', value: '3,421' },
  { id: 5, label: 'Breach Archives', value: '1,890' },
]

export const sidebarStatusCards = [
  {
    id: 'system-status',
    title: 'System Status',
    rows: [
      { label: 'Live Monitoring', value: 'Online', tone: 'text-emerald-300' },
      { label: 'Health', value: 'All systems operational' },
    ],
  },
  {
    id: 'detection-engine',
    title: 'Detection Engine',
    rows: [
      { label: 'AI Model', value: 'Active', tone: 'text-emerald-300' },
      { label: 'Data Sources', value: '12' },
      { label: 'Success Rate', value: '98.7%' },
      { label: 'Last Scan', value: '1 min ago' },
    ],
  },
]

export const reportingCards = [
  {
    title: 'Operational Reports',
    eyebrow: 'Reports',
    text: 'Automated executive exports compile daily findings, affected entities, and remediation recommendations for security leadership.',
  },
  {
    title: 'Platform Settings Snapshot',
    eyebrow: 'Settings',
    text: 'Alert thresholds, data retention policy, and escalation routing are synchronized across the monitoring stack.',
  },
]
