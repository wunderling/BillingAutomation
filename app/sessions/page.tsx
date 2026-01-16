"use client";

import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/supabase";
import Link from "next/link";
import { formatDuration } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";

export default function SessionsPage() {
    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading filters...</div>}>
                <SessionsContent />
            </Suspense>
        </div>
    );
}

function SessionsContent() {
    const supabase = createClient();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [sessions, setSessions] = useState<Database['public']['Tables']['sessions']['Row'][]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "all");
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchSessions();
    }, [filterStatus]);

    async function fetchSessions() {
        setLoading(true);
        let query = supabase.from('sessions').select('*').order('start_time', { ascending: false });

        if (filterStatus !== 'all') {
            if (filterStatus === 'needs_attention') {
                query = query.in('status', ['needs_review_duration', 'unmatched_customer', 'error']);
            } else {
                query = query.eq('status', filterStatus);
            }
        }

        const { data, error } = await query;
        if (data) setSessions(data);
        setLoading(false);
    }

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };

    const toggleAll = () => {
        if (selected.size === sessions.length) setSelected(new Set());
        else setSelected(new Set(sessions.map(s => s.id)));
    }

    const bulkAction = async (action: 'approve' | 'reject') => {
        if (!confirm(`Are you sure you want to ${action} ${selected.size} items?`)) return;

        // Parallel requests
        const promises = Array.from(selected).map(id =>
            fetch(`/api/sessions/${id}/${action}`, { method: 'POST' })
        );

        await Promise.all(promises);

        setSelected(new Set());
        fetchSessions();
    };

    // Grouping Logic
    const groupedSessions = sessions.reduce((acc, session) => {
        const date = new Date(session.start_time);
        // Get start of week (Sunday)
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day; // adjust when day is sunday
        const weekStart = new Date(d.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);

        const key = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

        if (!acc[key]) acc[key] = [];
        acc[key].push(session);
        return acc;
    }, {} as Record<string, typeof sessions>);

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Sessions</h1>
                <div className="flex gap-2">
                    {selected.size > 0 && (
                        <>
                            <button onClick={() => bulkAction('approve')} className="px-4 py-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30">
                                Approve ({selected.size})
                            </button>
                            <button onClick={() => bulkAction('reject')} className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30">
                                Reject ({selected.size})
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
                {[
                    { id: 'all', label: 'All' },
                    { id: 'pending_review', label: 'Pending' },
                    { id: 'approved', label: 'Approved' },
                    { id: 'needs_attention', label: 'Needs Attention' },
                    { id: 'posted_to_qbo', label: 'Posted' },
                ].map(opt => (
                    <button
                        key={opt.id}
                        onClick={() => { setFilterStatus(opt.id); router.push(`/sessions?status=${opt.id}`); }}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === opt.id
                                ? "bg-white text-black"
                                : "bg-white/5 text-gray-400 hover:bg-white/10"
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {loading && <div className="text-center p-12 text-gray-500">Loading sessions...</div>}

            {!loading && Object.entries(groupedSessions).map(([week, groupSessions]) => (
                <div key={week} className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-400 mb-3 px-1">Week of {week}</h3>
                    <div className="glass rounded-2xl overflow-hidden border border-white/5">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-sm uppercase text-gray-500 font-medium">
                                <tr>
                                    <th className="p-4 w-12 text-center">
                                        {/* Simple check all for this group? Or global? Keeping global for now implies complexity. Let's make toggleAll select ALL not just group. */}
                                    </th>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Title / Student</th>
                                    <th className="p-4">Duration</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {groupSessions.map(s => (
                                    <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 text-center">
                                            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="bg-transparent border-gray-600 rounded" />
                                        </td>
                                        <td className="p-4 text-sm text-gray-400 whitespace-nowrap">
                                            {new Date(s.start_time).toLocaleDateString()}
                                            <br />
                                            <span className="text-xs">{new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-white">{s.student_name || <span className="text-yellow-500 italic">Unknown</span>}</div>
                                            <div className="text-xs text-gray-500 line-clamp-1">{s.title_raw}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className={`font-mono ${s.duration_minutes_normalized ? 'text-white' : 'text-red-400'}`}>
                                                    {s.duration_minutes_normalized ? formatDuration(s.duration_minutes_normalized) : '---'}
                                                </span>
                                                <span className="text-xs text-gray-500">Raw: {s.duration_minutes_raw}m</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge status={s.status} />
                                        </td>
                                        <td className="p-4 text-right">
                                            <Link href={`/session/${s.id}`} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors text-white">
                                                Details
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            {!loading && sessions.length === 0 && (
                <div className="p-12 text-center text-gray-500 glass rounded-2xl">
                    No sessions found.
                </div>
            )}
        </>
    );
}

function Badge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        pending_review: "bg-blue-500/20 text-blue-400",
        approved: "bg-green-500/20 text-green-400",
        rejected: "bg-red-500/20 text-red-400",
        posted_to_qbo: "bg-purple-500/20 text-purple-400",
        needs_review_duration: "bg-yellow-500/20 text-yellow-400",
        unmatched_customer: "bg-orange-500/20 text-orange-400",
        error: "bg-red-500/20 text-red-500",
    };
    return (
        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${colors[status] || "bg-gray-500/20 text-gray-400"}`}>
            {status.replace(/_/g, " ")}
        </span>
    );
}
