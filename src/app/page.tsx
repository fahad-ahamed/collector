'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
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
  RefreshCw,
  LogOut,
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

type View = 'welcome' | 'loading' | 'list' | 'detail' | 'error';

export default function ContactCollector() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [view, setView] = useState<View>('welcome');
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showVcardAll, setShowVcardAll] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ─── Fetch contacts from Google People API ───────────

  const fetchContacts = useCallback(async () => {
    setView('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contacts', {
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.details || data.error || 'Failed to fetch contacts');
        setView('error');
        return;
      }

      setContacts(data.contacts || []);
      setView('list');
      toast({ title: 'Contacts loaded!', description: `${data.total} contacts found` });
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong');
      setView('error');
    }
  }, [session, toast]);

  // ─── Auto-fetch when session is ready ────────────────

  React.useEffect(() => {
    if (status === 'authenticated' && session && view === 'welcome') {
      fetchContacts();
    }
  }, [status, session, view, fetchContacts]);

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

  // ─── Handle Google Sign-In ──────────────────────────

  const handleAllowAccess = useCallback(() => {
    signIn('google', { callbackUrl: '/' });
  }, []);

  // ═══════════════════════════════════════════════════════
  //  RENDERS
  // ═══════════════════════════════════════════════════════

  // ─── Welcome / Permission Screen ────────────────────

  if (view === 'welcome' && status !== 'authenticated') {
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
            All your contacts in vCard format
          </p>
          <p className="text-white/50 text-center mb-10 text-sm max-w-xs">
            Sign in with Google &amp; allow contact access — all contacts will load automatically!
          </p>

          <div className="w-full max-w-sm">
            {/* Main CTA - Google Sign In */}
            <Button
              onClick={handleAllowAccess}
              disabled={status === 'loading'}
              className="w-full bg-white hover:bg-gray-50 text-gray-800 font-bold h-14 rounded-2xl text-lg shadow-lg"
            >
              <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {status === 'loading' ? 'Connecting...' : 'Allow Contact Access'}
            </Button>

            <p className="text-white/40 text-center text-xs mt-4 leading-relaxed">
              Sign in with Google → Allow contact permission → All contacts auto load. <br/>
              No manual selection needed!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading Screen ─────────────────────────────────

  if (view === 'loading' || status === 'loading') {
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
          <h3 className="text-white font-semibold text-lg mb-2">Loading Contacts...</h3>
          <p className="text-white/60 text-sm text-center">Fetching all your contacts automatically</p>
        </div>
      </div>
    );
  }

  // ─── Error Screen ───────────────────────────────────

  if (view === 'error') {
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
            <X className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2 text-center">Something went wrong</h3>
          <p className="text-white/60 text-sm text-center mb-8 max-w-xs">{errorMsg}</p>
          <Button
            onClick={fetchContacts}
            className="bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold h-12 rounded-xl px-8 mb-3"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Try Again
          </Button>
          <Button
            onClick={() => signOut({ callbackUrl: '/' })}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 h-10 rounded-xl px-6"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
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
          <Users className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold text-base">Contact Collector</h1>
          <p className="text-white/70 text-xs">{contacts.length} contacts</p>
        </div>
        <button onClick={fetchContacts} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors" title="Refresh">
          <RefreshCw className="w-4 h-4 text-white/80" />
        </button>
        <button onClick={() => signOut({ callbackUrl: '/' })} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors" title="Sign out">
          <LogOut className="w-4 h-4 text-white/80" />
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{contact.name}</h3>
                      {contact.organization && (
                        <span className="text-[10px] text-[#075E54] bg-[#075E54]/10 px-1.5 py-0.5 rounded-full truncate max-w-[100px]">
                          {contact.organization}
                        </span>
                      )}
                    </div>
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
