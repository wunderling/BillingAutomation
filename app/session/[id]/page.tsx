"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/supabase";
import Link from "next/link";
import { formatDuration } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function SessionDetailPage() {
    const { id } = useParams() as { id: string };
    const supabase = createClient();
    const router = useRouter();

    const [session, setSession] = useState<Database['public']['Tables']['sessions']['Row'] | null>(null);
    const [loading, setLoading] = useState(true);

    // Edit state
    const [studentName, setStudentName] = useState("");
    const [notes, setNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!id) return;
        loadSession();
    }, [id]);

    async function loadSession() {
        setLoading(true);
        const { data, error } = await supabase.from('sessions').select('*').eq('id', id).single();
        if (data) {
            setSession(data);
            setStudentName(data.student_name || "");
            setNotes(data.notes || "");
        }
        setLoading(false);
    }

    async function handleSave() {
        setIsSaving(true);
        const res = await fetch(`/api/sessions/${id}/update`, {
            method: 'POST',
            body: JSON.stringify({ student_name: studentName, notes }),
        });
        setIsSaving(false);
        if (res.ok) {
            alert("Saved!");
            loadSession();
        } else {
            alert("Error saving");
        }
    }

    async function handleStatusChange(newStatus: 'approved' | 'rejected') {
        if (!confirm(`Mark as ${newStatus}?`)) return;
        const res = await fetch(`/api/sessions/${id}/${newStatus}`, { method: 'POST' });
        if (res.ok) {
            loadSession();
            router.refresh();
        } else {
            const j = await res.json();
            alert(j.error);
        }
    }

    // Helper to create alias
    async function createAlias() {
        if (!session || !studentName) return;
        const alias = studentName.trim();
        // Since we don't have a way to search QBO here easily without server route...
        // Maybe we just assume we want to map current studentName to a KNOWN QBO ID?
        // Ah, the user might want to SAY: "This student name maps to THIS QBO Customer".
        // Use case: we have "John Doe" but QBO has "Jonathan Doe".
        // We need to input the QBO ID or Name.
        // For MVP, simplistic prompt?

        const qboName = prompt("Enter exact QBO Customer Display Name for this student:");
        if (!qboName) return;

        // In a real app we would validate against QBO.
        // Here we just insert into aliases table assuming the QBO Sync job will validate later or fail.
        // Wait, table needs ID too. The user prob doesn't know the ID.
        // We'll trust the sync job to find by Name if we store Name in aliases?
        // Schema: alias, qbo_customer_id, qbo_customer_name.
        // If we only have name, we can't fully fill this.
        // Let's Skip this for 1-day MVP unless critical. Rely on "Unmatched" workflow -> Fix in QBO or Rename in App.
        alert("To create an alias, ensure the Student Name in this form matches the QBO Display Name exactly, or rename the student here.");
    }

    if (loading) return <div className="p-12 text-center">Loading...</div>;
    if (!session) return <div className="p-12 text-center">Not found</div>;

    const isPosted = session.status === 'posted_to_qbo';

    return (
        <div className="max-w-4xl mx-auto px-6 py-12">
            <Link href="/sessions" className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sessions
            </Link>

            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Session Details</h1>
                    <p className="text-gray-400 font-mono text-sm">{session.google_event_id}</p>
                </div>
                <div className="flex gap-3">
                    {!isPosted && (
                        <>
                            {session.status !== 'approved' && (
                                <button onClick={() => handleStatusChange('approved')} className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors text-white">
                                    Approve
                                </button>
                            )}
                            {session.status !== 'rejected' && (
                                <button onClick={() => handleStatusChange('rejected')} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors text-white">
                                    Reject
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Form */}
                <div className="md:col-span-2 space-y-6">
                    <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Student Name (for QBO Matching)</label>
                            <input
                                type="text"
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                value={studentName}
                                onChange={e => setStudentName(e.target.value)}
                                disabled={isPosted}
                            />
                            <p className="text-xs text-gray-500 mt-1">Must match QBO Customer Display Name or Alias.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Internal Notes</label>
                            <textarea
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500/50 outline-none h-32"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                disabled={isPosted}
                            />
                        </div>

                        {!isPosted && (
                            <div className="flex justify-end pt-4">
                                <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors text-white">
                                    {isSaving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2">MetaData</h3>

                        <div>
                            <span className="text-xs text-gray-500 block uppercase">Status</span>
                            <span className="text-sm font-medium capitalize text-white">{session.status.replace(/_/g, ' ')}</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 block uppercase">Date</span>
                            <span className="text-sm text-white">{new Date(session.start_time).toLocaleString()}</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 block uppercase">Duration</span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-white">{formatDuration(session.duration_minutes_normalized || 0)}</span>
                                <span className="text-xs text-gray-500">(Raw: {session.duration_minutes_raw}m)</span>
                            </div>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 block uppercase">Title</span>
                            <span className="text-sm text-white">{session.title_raw}</span>
                        </div>
                    </div>

                    {isPosted && (
                        <div className="glass p-6 rounded-2xl border border-green-500/20 bg-green-500/5 text-green-400 space-y-2">
                            <h3 className="font-semibold">Sync Status</h3>
                            <p className="text-sm">Posted to QBO successfully.</p>
                            <p className="text-xs font-mono">ID: {session.qbo_delayed_charge_id}</p>
                            <p className="text-xs font-mono">Customer: {session.qbo_customer_name}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
