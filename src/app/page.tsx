'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Phone,
  Download,
  Copy,
  Check,
  User,
  Users,
  ChevronRight,
  Shield,
  AlertCircle,
  ArrowLeft,
  Search,
  X,
  FileText,
  Share2,
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

// ─── Demo Contacts (for desktop / unsupported browsers) ─

const DEMO_CONTACTS: ContactInfo[] = [
  { id: '1', name: 'Rahim Uddin', phone: '+880 1711-234567', email: 'rahim@email.com', organization: 'ABC Corp' },
  { id: '2', name: 'Karim Hasan', phone: '+880 1812-345678', email: 'karim@email.com', organization: 'XYZ Ltd' },
  { id: '3', name: 'Fatima Begum', phone: '+880 1913-456789', organization: 'Tech Solutions' },
  { id: '4', name: 'Nasir Ahmed', phone: '+880 1614-567890', email: 'nasir@email.com' },
  { id: '5', name: 'Aisha Khan', phone: '+880 1515-678901', organization: 'Digital Ltd' },
  { id: '6', name: 'Imran Hossain', phone: '+880 1716-789012', email: 'imran@email.com', organization: 'SoftDev' },
  { id: '7', name: 'Salma Akter', phone: '+880 1817-890123', organization: 'Creative Hub' },
  { id: '8', name: 'Jamil Rahman', phone: '+880 1918-901234', email: 'jamil@email.com' },
  { id: '9', name: 'Nusrat Jahan', phone: '+880 1619-012345', organization: 'DataSys' },
  { id: '10', name: 'Tariq Mahmud', phone: '+880 1520-123456', email: 'tariq@email.com', organization: 'CloudNet' },
  { id: '11', name: 'Zainab Islam', phone: '+880 1721-234567', organization: 'MedTech' },
  { id: '12', name: 'Habib Molla', phone: '+880 1822-345678', email: 'habib@email.com' },
  { id: '13', name: 'Rashida Sultana', phone: '+880 1923-456789', organization: 'EduCare' },
  { id: '14', name: 'Shafiqul Islam', phone: '+880 1624-567890', email: 'shafiq@email.com', organization: 'GreenTech' },
  { id: '15', name: 'Momena Khatun', phone: '+880 1525-678901', organization: 'HealthPlus' },
];

// ─── Color Utilities ────────────────────────────────────

const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-teal-600',
  'bg-cyan-600',
  'bg-green-700',
  'bg-lime-700',
  'bg-emerald-700',
  'bg-teal-700',
  'bg-cyan-700',
  'bg-green-600',
  'bg-lime-600',
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

type View = 'welcome' | 'loading' | 'list' | 'detail';

export default function ContactCollector() {
  const { toast } = useToast();
  const [view, setView] = useState<View>('welcome');
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check Contact Picker API support
  const checkSupport = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      setIsSupported(true);
      return true;
    }
    setIsSupported(false);
    return false;
  }, []);

  // Request contacts permission and fetch contacts
  const requestContacts = useCallback(async () => {
    setView('loading');
    setError(null);

    const supported = checkSupport();

    if (supported) {
      try {
        const props = ['name', 'tel', 'email'] as unknown as ContactProperty[];
        const selectedContacts = await (navigator as any).contacts.select(props, { multiple: true });
        const mapped: ContactInfo[] = selectedContacts.map((c: any, i: number) => ({
          id: String(i + 1),
          name: c.name?.[0] || 'Unknown',
          phone: c.tel?.[0] || 'No number',
          email: c.email?.[0] || undefined,
          organization: undefined,
        }));
        setContacts(mapped);
        setView('list');
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setError('Permission denied. Please allow contact access to use this app.');
        } else {
          setError('Could not access contacts. Using demo data instead.');
        }
        setContacts(DEMO_CONTACTS);
        setView('list');
      }
    } else {
      // Fallback: use demo data with a short loading animation
      await new Promise((r) => setTimeout(r, 1200));
      setContacts(DEMO_CONTACTS);
      setView('list');
    }
  }, [checkSupport]);

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
      toast({ title: 'Copied!', description: `${contact.name}'s vCard copied to clipboard` });
      setTimeout(() => setCopiedId(null), 2000);
    },
    [toast]
  );

  const copyAllVCard = useCallback(async () => {
    const vcard = generateAllVCard(contacts);
    await navigator.clipboard.writeText(vcard);
    setCopiedAll(true);
    toast({ title: 'All Copied!', description: `${contacts.length} contacts vCard copied to clipboard` });
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
    toast({ title: 'Downloaded!', description: `all_contacts.vcf with ${contacts.length} contacts saved` });
  }, [contacts, toast]);

  // ─── Share handler ──────────────────────────────────

  const shareVCard = useCallback(async (contact: ContactInfo) => {
    const vcard = generateVCard(contact);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${contact.name} - Contact`,
          text: vcard,
        });
      } catch {
        // User cancelled share
      }
    } else {
      await copyVCard(contact);
    }
  }, [copyVCard]);

  // ═══════════════════════════════════════════════════════
  //  RENDERS
  // ═══════════════════════════════════════════════════════

  // ─── Welcome / Permission Screen ────────────────────

  if (view === 'welcome') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#075E54] to-[#054D44]">
        {/* Header */}
        <div className="px-4 py-3 bg-[#075E54] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg">Contact Collector</h1>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
          {/* Icon circle */}
          <div className="w-28 h-28 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mb-8 shadow-lg">
            <div className="w-20 h-20 rounded-full bg-[#25D366] flex items-center justify-center">
              <Phone className="w-10 h-10 text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3 text-center">Contact Collector</h2>
          <p className="text-white/80 text-center mb-2 text-base">
            Collect &amp; manage your contacts in vCard format
          </p>
          <p className="text-white/60 text-center mb-10 text-sm max-w-xs">
            Allow contact permission to view, copy &amp; download all your phone contacts
          </p>

          {/* Permission card */}
          <div className="w-full max-w-sm bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-[#25D366]/30 flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="w-5 h-5 text-[#25D366]" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm mb-1">Contact Access Permission</h3>
                <p className="text-white/60 text-xs leading-relaxed">
                  This app needs permission to read your contacts. Your data stays on your device and is never uploaded anywhere.
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              {['View contacts in vCard format', 'Copy & download contacts', 'Share contact details'].map(
                (feature, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#25D366]" />
                    <span className="text-white/80 text-sm">{feature}</span>
                  </div>
                )
              )}
            </div>

            <Button
              onClick={requestContacts}
              className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold h-12 rounded-xl text-base"
            >
              <Phone className="w-5 h-5 mr-2" />
              Allow Contact Access
            </Button>
          </div>

          {/* Demo button */}
          <button
            onClick={() => {
              setContacts(DEMO_CONTACTS);
              setView('list');
            }}
            className="text-white/50 hover:text-white/80 text-sm underline underline-offset-2 transition-colors"
          >
            Skip — Try with demo contacts
          </button>
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
          <h3 className="text-white font-semibold text-lg mb-2">Accessing Contacts...</h3>
          <p className="text-white/60 text-sm text-center">Please allow contact permission if prompted</p>
          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 flex items-start gap-2 max-w-xs">
              <AlertCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
              <p className="text-red-200 text-xs">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Contact Detail View ────────────────────────────

  if (view === 'detail' && selectedContact) {
    const vcard = generateVCard(selectedContact);

    return (
      <div className="min-h-screen flex flex-col bg-[#ECE5DD]">
        {/* Detail header */}
        <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 shadow-md">
          <button
            onClick={() => {
              setView('list');
              setSelectedContact(null);
            }}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
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

        {/* Contact info card */}
        <div className="flex-1 px-4 py-6 space-y-4">
          {/* Avatar & name */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col items-center mb-5">
              <Avatar className="w-20 h-20 mb-3">
                <AvatarFallback className={`${getAvatarColor(selectedContact.name)} text-white font-bold text-2xl`}>
                  {getInitials(selectedContact.name)}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-lg font-bold text-gray-900">{selectedContact.name}</h3>
              {selectedContact.organization && (
                <p className="text-sm text-gray-500">{selectedContact.organization}</p>
              )}
            </div>

            <Separator className="my-4" />

            {/* Phone */}
            <div className="flex items-center gap-3 py-2">
              <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-[#25D366]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                <p className="text-sm font-medium text-gray-900 truncate">{selectedContact.phone}</p>
              </div>
            </div>

            {/* Email */}
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

            {/* Organization */}
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

          {/* vCard preview */}
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

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              onClick={() => copyVCard(selectedContact)}
              className="bg-[#075E54] hover:bg-[#064E46] text-white h-14 rounded-xl flex-col gap-1 text-xs"
            >
              {copiedId === selectedContact.id ? (
                <Check className="w-5 h-5" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
              {copiedId === selectedContact.id ? 'Copied' : 'Copy'}
            </Button>
            <Button
              onClick={() => downloadVCard(selectedContact)}
              className="bg-[#25D366] hover:bg-[#20BD5A] text-white h-14 rounded-xl flex-col gap-1 text-xs"
            >
              <Download className="w-5 h-5" />
              Download
            </Button>
            <Button
              onClick={() => shareVCard(selectedContact)}
              variant="outline"
              className="border-[#075E54] text-[#075E54] hover:bg-[#075E54]/10 h-14 rounded-xl flex-col gap-1 text-xs"
            >
              <Share2 className="w-5 h-5" />
              Share
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Contact List View ──────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-[#ECE5DD]">
      {/* WhatsApp-style header */}
      <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 shadow-md z-10">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <Users className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold text-base">Contact Collector</h1>
          <p className="text-white/70 text-xs">{contacts.length} contacts</p>
        </div>
        <Badge className="bg-[#25D366] text-white border-0 text-xs px-2.5 py-0.5">
          {contacts.length}
        </Badge>
      </div>

      {/* Search bar */}
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
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* "My Contacted Numbers" section header */}
      <div className="px-4 py-2.5 bg-[#ECE5DD]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-5 rounded-full bg-[#25D366]" />
          <h2 className="text-sm font-semibold text-[#075E54]">My Contacted Numbers</h2>
          <span className="text-xs text-gray-500 ml-auto">{filteredContacts.length} found</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 py-2 bg-[#ECE5DD] flex gap-2">
        <Button
          onClick={copyAllVCard}
          variant="outline"
          size="sm"
          className="flex-1 border-[#075E54]/30 text-[#075E54] hover:bg-[#075E54]/10 rounded-xl h-9 text-xs"
        >
          {copiedAll ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
          {copiedAll ? 'Copied All' : 'Copy All vCard'}
        </Button>
        <Button
          onClick={downloadAllVCard}
          size="sm"
          className="flex-1 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl h-9 text-xs"
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          Download All
        </Button>
      </div>

      {/* Contact list */}
      <ScrollArea className="flex-1">
        <div className="bg-white mx-3 rounded-2xl shadow-sm overflow-hidden mb-4">
          {filteredContacts.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No contacts found</p>
              <p className="text-gray-400 text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            filteredContacts.map((contact, index) => (
              <React.Fragment key={contact.id}>
                <button
                  onClick={() => {
                    setSelectedContact(contact);
                    setView('detail');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F0F0] transition-colors active:bg-[#E8E8E8]"
                >
                  <Avatar className="w-11 h-11 shrink-0">
                    <AvatarFallback
                      className={`${getAvatarColor(contact.name)} text-white font-semibold text-sm`}
                    >
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

      {/* Bottom bar */}
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <p className="text-center text-xs text-gray-400">
          Contact Collector &bull; {contacts.length} contacts &bull; vCard 3.0
        </p>
      </div>
    </div>
  );
}
