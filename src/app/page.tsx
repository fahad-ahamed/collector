'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
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
  Upload,
  Contact,
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

// ─── vCard Parser ───────────────────────────────────────

function parseVCardFile(text: string): ContactInfo[] {
  const contacts: ContactInfo[] = [];
  const vcardBlocks = text.split(/BEGIN:VCARD/i);

  for (const block of vcardBlocks) {
    if (!block.trim()) continue;
    const nameMatch = block.match(/FN:(.*)/i);
    const telMatch = block.match(/TEL[^:]*:(.*)/i);
    const emailMatch = block.match(/EMAIL[^:]*:(.*)/i);
    const orgMatch = block.match(/ORG:(.*)/i);

    const name = nameMatch?.[1]?.trim() || '';
    const phone = telMatch?.[1]?.trim() || '';
    const email = emailMatch?.[1]?.trim() || undefined;
    const organization = orgMatch?.[1]?.trim()?.replace(/^;+/, '') || undefined;

    if (name || phone) {
      contacts.push({
        id: `vc-${contacts.length + 1}-${Date.now()}`,
        name: name || 'Unknown',
        phone: phone || 'No number',
        email,
        organization,
      });
    }
  }
  return contacts;
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

// ─── Detect Contact Picker API support ─────────────────

function isContactPickerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
}

// ─── Main App Component ─────────────────────────────────

type View = 'welcome' | 'loading' | 'list' | 'detail' | 'denied';

export default function ContactCollector() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>('welcome');
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showVcardAll, setShowVcardAll] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const apiSupported = typeof window !== 'undefined' ? isContactPickerSupported() : false;

  // ─── Request contacts from phone (Contact Picker) ──

  const requestPhoneContacts = useCallback(async () => {
    setView('loading');

    try {
      const props = ['name', 'tel', 'email'] as unknown as ContactProperty[];
      const selected = await (navigator as any).contacts.select(props, { multiple: true });

      const mapped: ContactInfo[] = selected.map((c: any, i: number) => ({
        id: `p-${i + 1}-${Date.now()}`,
        name: c.name?.[0] || 'Unknown',
        phone: c.tel?.[0] || 'No number',
        email: c.email?.[0] || undefined,
        organization: undefined,
      }));

      setContacts(mapped);
      setView('list');
      toast({ title: 'Contacts loaded!', description: `${mapped.length} contacts from phone` });
    } catch (err: any) {
      setView('denied');
    }
  }, [toast]);

  // ─── vCard file upload handler ──────────────────────

  const handleFileUpload = useCallback(
    (file: File) => {
      setView('loading');

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = parseVCardFile(text);

        if (parsed.length === 0) {
          toast({ title: 'No contacts found', description: 'Make sure it is a valid .vcf file', variant: 'destructive' });
          setView('welcome');
          return;
        }

        setContacts(parsed);
        setView('list');
        toast({ title: 'Import successful!', description: `${parsed.length} contacts loaded` });
      };
      reader.onerror = () => {
        toast({ title: 'Failed to read file', description: 'Please try again', variant: 'destructive' });
        setView('welcome');
      };
      reader.readAsText(file);
    },
    [toast]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
      e.target.value = '';
    },
    [handleFileUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  // ─── Filtered contacts ──────────────────────────────

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.organization && c.organization.toLowerCase().includes(q))
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
      try { await navigator.share({ title: `${contact.name} - Contact`, text: vcard }); } catch { /* cancelled */ }
    } else {
      await copyVCard(contact);
    }
  }, [copyVCard]);

  // ═══════════════════════════════════════════════════════
  //  RENDERS
  // ═══════════════════════════════════════════════════════

  // ─── Welcome Screen ─────────────────────────────────

  if (view === 'welcome') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#075E54] to-[#054D44]">
        <div className="px-4 py-3 bg-[#075E54] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Contact className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg">Contact Collector</h1>
        </div>

        <div className="flex-1 flex flex-col items-center px-5 pt-8 pb-12 overflow-y-auto">
          {/* Hero */}
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-6 shadow-lg">
            <div className="w-16 h-16 rounded-full bg-[#25D366] flex items-center justify-center">
              <Phone className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Contact Collector</h2>
          <p className="text-white/60 text-center mb-8 text-sm max-w-xs">
            Import all your phone contacts in vCard format. View, copy &amp; download instantly.
          </p>

          {/* ── Method 1: Import vCard File (PRIMARY) ── */}
          <div className="w-full max-w-sm bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#25D366]/30 flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-[#25D366]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-bold text-sm">Import All Contacts</h3>
                  <Badge className="bg-[#25D366] text-white border-0 text-[10px] px-1.5 py-0">BEST</Badge>
                </div>
                <p className="text-white/50 text-xs leading-relaxed">
                  Upload .vcf file from your phone — ALL contacts auto import, no selection needed!
                </p>
              </div>
            </div>

            {/* Upload zone */}
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                dragOver ? 'border-[#25D366] bg-[#25D366]/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-[#25D366]/20 flex items-center justify-center mb-3">
                <Upload className="w-7 h-7 text-[#25D366]" />
              </div>
              <p className="text-white font-semibold text-sm mb-1">
                {dragOver ? 'Drop your .vcf file here' : 'Tap to Upload .vcf File'}
              </p>
              <p className="text-white/40 text-xs">All contacts will auto-import</p>
            </div>

            <input ref={fileInputRef} type="file" accept=".vcf,.vcard" onChange={onFileChange} className="hidden" />

            {/* How to export guide */}
            <div className="mt-4 bg-white/5 rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs font-semibold mb-2">How to export .vcf from phone:</p>
              <div className="space-y-1.5">
                {[
                  'Open your Phone Contacts app',
                  'Tap Settings (gear icon)',
                  'Tap "Export contacts" or "Import/Export"',
                  'Select "Export to storage" → Save .vcf',
                  'Come back here & upload that file',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#25D366]/30 text-[#25D366] text-[9px] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      {i + 1}
                    </span>
                    <p className="text-white/50 text-[11px] leading-tight">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── OR divider ── */}
          <div className="w-full max-w-sm flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* ── Method 2: Phone Contact Picker (secondary) ── */}
          <div className="w-full max-w-sm bg-white/5 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-white/60" />
              </div>
              <div className="flex-1">
                <h3 className="text-white/70 text-sm font-medium">Pick from Phone</h3>
                <p className="text-white/40 text-[10px]">Android Chrome only — requires manual selection</p>
              </div>
            </div>
            <Button
              onClick={requestPhoneContacts}
              disabled={!apiSupported}
              className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white/80 font-medium h-10 rounded-xl text-sm"
            >
              <Phone className="w-4 h-4 mr-2" />
              {apiSupported ? 'Select Contacts from Phone' : 'Not Available'}
            </Button>
          </div>

          <p className="text-white/30 text-xs text-center">
            Your data stays on your device. Nothing is uploaded.
          </p>
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
            <Contact className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg">Contact Collector</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-[#25D366] animate-spin mb-6" />
          <h3 className="text-white font-semibold text-lg mb-2">Loading Contacts...</h3>
          <p className="text-white/60 text-sm text-center">Importing all contacts automatically</p>
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
            <Contact className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg">Contact Collector</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2 text-center">Permission Denied</h3>
          <p className="text-white/60 text-sm text-center mb-4 max-w-xs">
            Contact access was denied. Try again or use the vCard file upload method instead.
          </p>
          <Button
            onClick={requestPhoneContacts}
            className="bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold h-12 rounded-xl px-8 mb-3"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Try Again
          </Button>
          <Button
            onClick={() => setView('welcome')}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 h-10 rounded-xl px-6"
          >
            Upload .vcf Instead
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

            {selectedContact.organization && (
              <div className="flex items-center gap-3 py-2">
                <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-[#25D366]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Organization</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{selectedContact.organization}</p>
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
          <Contact className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold text-base">Contact Collector</h1>
          <p className="text-white/70 text-xs">{contacts.length} contacts</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors" title="Import more">
          <Upload className="w-4 h-4 text-white/80" />
        </button>
        <button onClick={() => { setContacts([]); setView('welcome'); }} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors" title="Start over">
          <RefreshCw className="w-4 h-4 text-white/80" />
        </button>
        <input ref={fileInputRef} type="file" accept=".vcf,.vcard" onChange={onFileChange} className="hidden" />
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
              <Button onClick={copyAllVCard} variant="outline" size="sm" className="flex-1 border-[#075E54]/30 text-[#075E54] hover:bg-[#075E54]/10 rounded-xl h-10 text-xs">
                {copiedAll ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copiedAll ? 'Copied All' : 'Copy All vCard'}
              </Button>
              <Button onClick={downloadAllVCard} size="sm" className="flex-1 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl h-10 text-xs">
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
