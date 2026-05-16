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
  RefreshCw,
  AlertCircle,
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

interface SessionData {
  id: string;
  contacts: ContactInfo[];
  count: number;
  createdAt: string;
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

// ─── Main View Component ────────────────────────────────

export default function ContactViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState('');
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedContact, setSelectedContact] = useState<ContactInfo | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showVcardAll, setShowVcardAll] = useState(false);

  // Get session ID from URL params
  useEffect(() => {
    params.then(p => setSessionId(p.id));
  }, [params]);

  // Save session to history
  const saveToHistory = useCallback((data: SessionData) => {
    try {
      const stored = localStorage.getItem('contact_sessions');
      const sessions = stored ? JSON.parse(stored) : [];
      // Check if already saved
      if (!sessions.find((s: any) => s.id === data.id)) {
        sessions.unshift({
          id: data.id,
          count: data.count,
          createdAt: data.createdAt,
        });
        localStorage.setItem('contact_sessions', JSON.stringify(sessions));
      }
    } catch {}
  }, []);

  // Fetch contacts from API
  useEffect(() => {
    if (!sessionId) return;

    const fetchContacts = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/contacts/view/${sessionId}`);
        if (!res.ok) {
          setError('Contact session not found or expired');
          setLoading(false);
          return;
        }
        const data: SessionData = await res.json();
        setContacts(data.contacts);
        saveToHistory(data);
      } catch {
        setError('Failed to load contacts');
      }
      setLoading(false);
    };

    fetchContacts();
  }, [sessionId, saveToHistory]);

  // Filtered contacts
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

  // Copy handlers
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

  // Download handler
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

  // Share handler
  const shareVCard = useCallback(async (contact: ContactInfo) => {
    const vcard = generateVCard(contact);
    if (navigator.share) {
      try { await navigator.share({ title: `${contact.name} - Contact`, text: vcard }); } catch { /* cancelled */ }
    } else {
      await copyVCard(contact);
    }
  }, [copyVCard]);

  // ─── Loading ───────────────────────────────────────
  if (loading) {
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
          <p className="text-white/60 text-sm text-center">Fetching your contact data</p>
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
            <Users className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg">Contact Collector</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2 text-center">Not Found</h3>
          <p className="text-white/60 text-sm text-center mb-8 max-w-xs">{error}</p>
          <a href="/">
            <Button className="bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold h-12 rounded-xl px-8">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Go Home
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
        <a href="/" className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </a>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold text-base">Contact Collector</h1>
          <p className="text-white/70 text-xs">{contacts.length} contacts</p>
        </div>
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
