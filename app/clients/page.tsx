"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Search, ExternalLink, Link as LinkIcon, Mail, DollarSign } from "lucide-react";

type BillingProfile = {
    id: string;
    student_name: string;
    qbo_customer_id: string | null;
    qbo_customer_name: string | null;
    base_rate_cents: number;
    travel_fee_cents: number;
    billing_emails: string[] | null;
};

export default function ClientsPage() {
    const supabase = createClient();
    const [profiles, setProfiles] = useState<BillingProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProfiles();
    }, []);

    async function fetchProfiles() {
        setLoading(true);
        const { data } = await supabase.from('billing_profiles').select('*').order('student_name');
        if (data) setProfiles(data);
        setLoading(false);
    }

    async function handleUpdate(id: string, updates: Partial<BillingProfile>) {
        setSaving(true);
        const { error } = await supabase.from('billing_profiles').update(updates).eq('id', id);
        if (error) alert(error.message);
        else {
            setProfiles(profiles.map(p => p.id === id ? { ...p, ...updates } : p));
            setEditingId(null);
        }
        setSaving(false);
    }

    const filtered = profiles.filter(p =>
        p.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.qbo_customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const missingQBO = profiles.filter(p => !p.qbo_customer_id).length;

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Client Billing Profiles</h1>
                    <p className="text-gray-400">Manage rates, emails, and QuickBooks mapping for each student.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search students..."
                            className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-64"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {missingQBO > 0 && (
                <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                        <LinkIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-amber-400">{missingQBO} Clients Not Linked to QBO</h3>
                        <p className="text-sm text-gray-400">These students won't be included in invoices until they are mapped to a QuickBooks Customer.</p>
                    </div>
                </div>
            )}

            <div className="glass rounded-2xl overflow-hidden border border-white/5">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-gray-400 font-medium text-xs uppercase tracking-wider">
                        <tr>
                            <th className="p-4">Student Name</th>
                            <th className="p-4">QBO Mapping</th>
                            <th className="p-4 text-center">Base Rate</th>
                            <th className="p-4 text-center">Travel Fee</th>
                            <th className="p-4">Billing Emails</th>
                            <th className="p-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="p-20 text-center text-gray-500">
                                    <Loader2 className="animate-spin w-8 h-8 mx-auto mb-4" />
                                    Loading profiles...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-20 text-center text-gray-500">
                                    No profiles found matching your search.
                                </td>
                            </tr>
                        ) : filtered.map(profile => (
                            <tr key={profile.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="p-4">
                                    <div className="font-semibold text-gray-400">{profile.student_name}</div>
                                </td>
                                <td className="p-4">
                                    {editingId === profile.id ? (
                                        <div className="space-y-2">
                                            <input
                                                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs"
                                                placeholder="QBO Customer ID"
                                                defaultValue={profile.qbo_customer_id || ""}
                                                onBlur={e => handleUpdate(profile.id, { qbo_customer_id: e.target.value })}
                                            />
                                            <input
                                                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs"
                                                placeholder="QBO Customer Name"
                                                defaultValue={profile.qbo_customer_name || ""}
                                                onBlur={e => handleUpdate(profile.id, { qbo_customer_name: e.target.value })}
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            {profile.qbo_customer_id ? (
                                                <div className="flex flex-col">
                                                    <span className="text-blue-400 text-sm">{profile.qbo_customer_name}</span>
                                                    <span className="text-[10px] text-gray-500">ID: {profile.qbo_customer_id}</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setEditingId(profile.id)}
                                                    className="text-xs flex items-center gap-1.5 text-gray-500 hover:text-white"
                                                >
                                                    <LinkIcon className="w-3 h-3" />
                                                    Link to QBO
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-1 text-sm text-green-400 font-medium">
                                        <DollarSign className="w-3 h-3" />
                                        {profile.base_rate_cents / 100}
                                    </div>
                                    <div className="text-[10px] text-gray-500">per 50m</div>
                                </td>
                                <td className="p-4 text-center text-sm font-medium">
                                    {profile.travel_fee_cents > 0 ? (
                                        <div className="text-purple-400 flex items-center justify-center gap-1">
                                            <DollarSign className="w-3 h-3" />
                                            {profile.travel_fee_cents / 100}
                                        </div>
                                    ) : (
                                        <span className="text-gray-600">—</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-1">
                                        {profile.billing_emails?.map((email, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                                                <Mail className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate max-w-[150px]">{email}</span>
                                            </div>
                                        ))}
                                        {(!profile.billing_emails || profile.billing_emails.length === 0) && (
                                            <span className="text-gray-600 text-xs italic">No emails set</span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => setEditingId(editingId === profile.id ? null : profile.id)}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
