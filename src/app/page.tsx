'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Phone,
  Download,
  Copy,
  Check,
  Users,
  ChevronRight,
  AlertCircle,
  ArrowLeft,
  Search,
  X,
  FileText,
  Share2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────

interface ContactInfo {
  id: string;
  name: string;
  phone: string;
  email?: string;
  organization?: string;
}

// ─── WebView Detector ───────────────────────────────────

function detectWebView(): { isWebView: boolean; platform: string } {
  if (typeof window === 'undefined') return { isWebView: false, platform: '' };

  const ua = navigator.userAgent || '';
  const uaLower = ua.toLowerCase();

  // Detect WebView / in-app browsers
  const isWebView =
    // Facebook in-app browser
    /fbav/i.test(ua) ||
    /fban/i.test(ua) ||
    // WhatsApp in-app browser
    /whatsapp/i.test(ua) ||
    // TikTok in-app browser
    /tiktok/i.test(ua) ||
    // Instagram in-app browser
    /instagram/i.test(ua) ||
    // Twitter/X in-app browser
    /twitter/i.test(ua) ||
    // LINE in-app browser
    /line/i.test(ua) ||
    // Snapchat in-app browser
    /snapchat/i.test(ua) ||
    // Telegram in-app browser
    /telegram/i.test(ua) ||
    // Generic Android WebView (not Chrome)
    (/wv/i.test(ua) && /android/i.test(ua)) ||
    // iOS WKWebView (not Safari)
    (/(iphone|ipad|ipod)/i.test(ua) && !/safari/i.test(ua) && /applewebkit/i.test(ua));

  let platform = 'Unknown App';
  if (/whatsapp/i.test(ua)) platform = 'WhatsApp';
  else if (/fbav/i.test(ua) || /fban/i.test(ua)) platform = 'Facebook';
  else if (/instagram/i.test(ua)) platform = 'Instagram';
  else if (/tiktok/i.test(ua)) platform = 'TikTok';
  else if (/telegram/i.test(ua)) platform = 'Telegram';
  else if (/twitter/i.test(ua)) platform = 'X (Twitter)';
  else if (/line/i.test(ua)) platform = 'LINE';
  else if (/snapchat/i.test(ua)) platform = 'Snapchat';
  else if (/wv/i.test(ua) && /android/i.test(ua)) platform = 'In-App Browser';
  else if (/(iphone|ipad|ipod)/i.test(ua)) platform = 'In-App Browser';

  return { isWebView, platform };
}

// ─── vCard Generator ────────────────────────────────────

function generateVCard(contact: ContactInfo): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contact.name}`,
    `N:${contact.name};;;;`,
    `TEL;TYPE=CELL:${contact.phone}`,
  ];
  if (contact.email) lines.push(`EMAIL;TYPE=HOME:${contact.email}`);
  if (contact.organization) lines.push(`ORG:${contact.organization}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

function generateAllVCard(contacts: ContactInfo[]): string {
  return contacts.map(generateVCard).join('\n\n');
}

// ─── Color Utilities ────────────────────────────────────

const AVATAR_COLORS = [
  'bg-emerald-600', 'bg-teal-600', 'bg-cyan-600', 'bg-green-700',
  'bg-lime-700', 'bg-emerald-700', 'bg-teal-700', 'bg-cyan-700',
  'bg-green-600', 'bg-lime-600',
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

// ─── Main App Component ─────────────────────────────────

type View = 'webview' | 'permission' | 'loading' | 'list' | 'detail' | 'denied';

export default function ContactCollector() {
  const { toast } = useToast();
  const [view, setView] = useState<View>('permission');
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showVcardAll, setShowVcardAll] = useState(false);

  // ─── Detect WebView (sync, runs once at mount) ─────
  const [webViewInfo] = useState<{ isWebView: boolean; platform: string }>(() => detectWebView());

  // ─── If in WebView, show the open-in-chrome screen ──
  const initialView: View = webViewInfo.isWebView ? 'webview' : 'permission';
  const [view, setView] = useState<View>(initialView);

  // ─── Open in Chrome ─────────────────────────────────
  const openInChrome = useCallback(() => {
    const url = window.location.href;
    // Try intent:// for Android
    const intentUrl = `intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;package=com.android.chrome;end`;
    // Fallback: just open in new tab
    try {
      window.location.href = intentUrl;
    } catch {
      window.open(url, '_blank');
    }
  }, []);

  // ─── Request contacts from phone ────────────────────

  const requestContacts = useCallback(async () => {
    setView('loading');

    try {
      const props = ['name', 'tel', 'email'] as unknown as ContactProperty[];
      const selected = await (navigator as any).contacts.select(props, { multiple: true });

      const mapped: ContactInfo[] = selected.map((c: any, i: number) => ({
        id: `c-${i + 1}-${Date.now()}`,
        name: c.name?.[0] || 'Unknown',
        phone: c.tel?.[0] || 'No number',
        email: c.email?.[0] || undefined,
        organization: undefined,
      }));

      setContacts(mapped);
      setView('list');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setView('denied');
      } else {
        setView('denied');
      }
    }
  }, []);

  // ─── Filtered contacts ──────────────────────────────

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [contacts, searchQuery]);

  // ─── Copy handlers ──────────────────────────────────

  const copyVCard = useCallback(
    async (contact: ContactInfo) => {
      const vcard = generateVCard(contact);
      await navigator.clipboard.writeText(vcard);
      setCopiedId(contact.id);
      toast({ title: 'Copied!', description: `${contact.name}'s vCard copied` });
      setTimeout(() => setCopiedId(null), 2000);
    },
    [toast]
  );

  const copyAllVCard = useCallback(async () => {
    const vcard = generateAllVCard(contacts);
    await navigator.clipboard.writeText(vcard);
    setCopiedAll(true);
    toast({ title: 'All Copied!', description: `${contacts.length} contacts vCard copied` });
    setTimeout(() => setCopiedAll(false), 2000);
  }, [contacts, toast]);

  // ─── Download handler ───────────────────────────────

  const downloadVCard = useCallback((contact: ContactInfo) => {
    const vcard = generateVCard(contact);
    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contact.name.replace(/\s+/g, '_')}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded!', description: `${contact.name}.vcf saved` });
  }, [toast]);

  const downloadAllVCard = useCallback(() => {
    const vcard = generateAllVCard(contacts);
    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all_contacts.vcf';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded!', description: `${contacts.length} contacts saved` });
  }, [contacts, toast]);

  // ─── Share handler ──────────────────────────────────

  const shareVCard = useCallback(async (contact: ContactInfo) => {
    const vcard = generateVCard(contact);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${contact.name} - Contact`, text: vcard });
      } catch { /* cancelled */ }
    } else {
      await copyVCard(contact);
    }
  }, [copyVCard]);

  // ═══════════════════════════════════════════════════════
  //  RENDERS
  // ═══════════════════════════════════════════════════════

  // ─── WebView Detection Screen ───────────────────────

  if (view === 'webview') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#075E54] to-[#054D44]">
        <div className="px-4 py-3 bg-[#075E54] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg">Contact Collector</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
          <div className="w-24 h-24 rounded-full bg-yellow-500/20 flex items-center justify-center mb-6">
            <ExternalLink className="w-12 h-12 text-yellow-400" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2 text-center">Open in Chrome</h2>
          <p className="text-white/70 text-center mb-2 text-sm">
            You are opening this from <span className="text-yellow-300 font-semibold">{webViewInfo.platform}</span>
          </p>
          <p className="text-white/50 text-center mb-8 text-sm max-w-xs leading-relaxed">
            Contact access only works in Chrome browser. Tap below to open this page in Chrome.
          </p>

          {/* Open in Chrome button */}
          <Button
            onClick={openInChrome}
            className="w-full max-w-sm bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold h-14 rounded-2xl text-lg shadow-lg shadow-[#25D366]/30 mb-4"
          >
            <ExternalLink className="w-6 h-6 mr-3" />
            Open in Chrome
          </Button>

          {/* Copy link option */}
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.href);
              toast({ title: 'Link Copied!', description: 'Open Chrome and paste the link' });
            }}
            variant="outline"
            className="w-full max-w-sm border-white/20 text-white hover:bg-white/10 h-12 rounded-xl"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Link Instead
          </Button>

          {/* Manual instructions */}
          <div className="w-full max-w-sm mt-8 bg-white/10 backdrop-blur-sm rounded-2xl p-5">
            <h3 className="text-white font-semibold text-sm mb-3">How to open in Chrome:</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center shrink-0 text-white text-xs font-bold">1</div>
                <p className="text-white/60 text-xs leading-relaxed">Tap the <span className="text-white font-medium">3-dot menu</span> (top-right) in this browser</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center shrink-0 text-white text-xs font-bold">2</div>
                <p className="text-white/60 text-xs leading-relaxed">Select <span className="text-white font-medium">&quot;Open in Chrome&quot;</span> or <span className="text-white font-medium">&quot;Open in external browser&quot;</span></p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center shrink-0 text-white text-xs font-bold">3</div>
                <p className="text-white/60 text-xs leading-relaxed">Allow contact permission when prompted</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Permission Prompt ──────────────────────────────

  if (view === 'permission') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#075E54] to-[#054D44]">
        <div className="px-4 py-3 bg-[#075E54] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg">Contact Collector</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
          <div className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center mb-8 shadow-lg">
            <div className="w-20 h-20 rounded-full bg-[#25D366] flex items-center justify-center animate-pulse">
              <Phone className="w-10 h-10 text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3 text-center">Contact Collector</h2>
          <p className="text-white/70 text-center mb-2 text-base">
            Your contacts in vCard format
          </p>
          <p className="text-white/50 text-center mb-10 text-sm max-w-xs">
            Tap below to allow contact access and view all your phone contacts
          </p>

          <div className="w-full max-w-sm">
            <Button
              onClick={requestContacts}
              className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold h-14 rounded-2xl text-lg shadow-lg shadow-[#25D366]/30"
            >
              <Phone className="w-6 h-6 mr-3" />
              Allow Contact Access
            </Button>

            <p className="text-white/40 text-center text-xs mt-4">
              Your data stays on your device. Nothing is uploaded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading Screen ─────────────────────────────────

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#075E54] to-[#054D44]">
        <div className="px-4 py-3 bg-[#075E54] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg">Contact Collector</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-[#25D366] animate-spin mb-6" />
          <h3 className="text-white font-semibold text-lg mb-2">Reading Contacts...</h3>
          <p className="text-white/60 text-sm text-center">Please allow contact permission if prompted</p>
        </div>
      </div>
    );
  }

  // ─── Permission Denied Screen ───────────────────────

  if (view === 'denied') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#075E54] to-[#054D44]">
        <div className="px-4 py-3 bg-[#075E54] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg">Contact Collector</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2 text-center">Permission Denied</h3>
          <p className="text-white/60 text-sm text-center mb-8 max-w-xs">
            Contact access was denied. Please allow permission to view your contacts.
          </p>
          <Button
            onClick={requestContacts}
            className="bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold h-12 rounded-xl px-8"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // ─── Contact Detail View ────────────────────────────

  if (view === 'detail' && selectedContact) {
    const vcard = generateVCard(selectedContact);

    return (
      <div className="min-h-screen flex flex-col bg-[#ECE5DD]">
        <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 shadow-md">
          <button
            onClick={() => { setView('list'); setSelectedContact(null); }}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
          >
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
              <pre className="text-xs text-gray-700 bg-gray-50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {vcard}
              </pre>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pb-2">
            <Button onClick={() => copyVCard(selectedContact)} className="bg-[#075E54] hover:bg-[#064E46] text-white h-14 rounded-xl flex-col gap-1 text-xs">
              {copiedId === selectedContact.id ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copiedId === selectedContact.id ? 'Copied' : 'Copy'}
            </Button>
            <Button onClick={() => downloadVCard(selectedContact)} className="bg-[#25D366] hover:bg-[#20BD5A] text-white h-14 rounded-xl flex-col gap-1 text-xs">
              <Download className="w-5 h-5" />
              Download
            </Button>
            <Button onClick={() => shareVCard(selectedContact)} variant="outline" className="border-[#075E54] text-[#075E54] hover:bg-[#075E54]/10 h-14 rounded-xl flex-col gap-1 text-xs">
              <Share2 className="w-5 h-5" />
              Share
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Contact List View (MAIN) ───────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-[#ECE5DD]">
      <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 shadow-md z-10">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <Users className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold text-base">Contact Collector</h1>
          <p className="text-white/70 text-xs">{contacts.length} contacts</p>
        </div>
        <button
          onClick={requestContacts}
          className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
          title="Refresh contacts"
        >
          <RefreshCw className="w-4 h-4 text-white/80" />
        </button>
      </div>

      <div className="px-3 py-2 bg-[#ECE5DD]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 h-10 bg-white rounded-xl border-0 shadow-sm text-sm placeholder:text-gray-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2 bg-[#ECE5DD]">
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
          <Badge className="bg-[#25D366] text-white border-0 text-sm px-2.5 py-1 font-bold">
            {contacts.length}
          </Badge>
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
              <Button
                onClick={copyAllVCard}
                variant="outline"
                size="sm"
                className="flex-1 border-[#075E54]/30 text-[#075E54] hover:bg-[#075E54]/10 rounded-xl h-10 text-xs"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copiedAll ? 'Copied All' : 'Copy All vCard'}
              </Button>
              <Button
                onClick={downloadAllVCard}
                size="sm"
                className="flex-1 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl h-10 text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Download All .vcf
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
                {index < filteredContacts.length - 1 && (
                  <div className="ml-[68px] border-b border-gray-100" />
                )}
              </React.Fragment>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <p className="text-center text-xs text-gray-400">
          Contact Collector &bull; {contacts.length} contacts &bull; vCard 3.0
        </p>
      </div>
    </div>
  );
}
