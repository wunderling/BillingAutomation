"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type PostResult = {
    sessionId: string;
    student: string;
    title: string;
    duration: number;
    success: boolean;
    message: string;
    customerId?: string;
};

export default function PostPage() {
    const [results, setResults] = useState<PostResult[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'dry' | 'real' | null>(null);

    async function runJob(dryRun: boolean) {
        setLoading(true);
        setMode(dryRun ? 'dry' : 'real');
        try {
            const res = await fetch(`/api/post-approved?dryRun=${dryRun}`, { method: 'POST' });
            const data = await res.json();
            setResults(data.results || []);
        } catch (e) {
            alert("Error running job");
        }
        setLoading(false);
    }

    return (
        <div className="max-w-4xl mx-auto px-6 py-12">
            <h1 className="text-3xl font-bold mb-8">Post to QuickBooks</h1>

            <div className="glass p-8 rounded-2xl border border-white/5 text-center space-y-6 mb-8">
                <h2 className="text-xl font-semibold">Ready to Sync?</h2>
                <p className="text-gray-400 max-w-lg mx-auto">
                    This will find all <span className="text-green-400 font-medium">Approved</span> sessions that haven't been posted yet, resolve their Customer in QBO, and create Delayed Charges.
                </p>

                <div className="flex justify-center gap-4 pt-4">
                    <button
                        onClick={() => runJob(true)}
                        disabled={loading}
                        className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors text-white disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && mode === 'dry' && <Loader2 className="animate-spin w-4 h-4" />}
                        Run Dry Run
                    </button>
                    <button
                        onClick={() => { if (confirm("This will write to QBO. Continue?")) runJob(false); }}
                        disabled={loading}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors text-white disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && mode === 'real' && <Loader2 className="animate-spin w-4 h-4" />}
                        Post Now
                    </button>
                </div>
            </div>

            {results && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Results ({mode === 'dry' ? 'Dry Run' : 'Live'})</h3>
                    <div className="glass rounded-xl overflow-hidden border border-white/5">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/5 text-gray-500 font-medium">
                                <tr>
                                    <th className="p-4">Student</th>
                                    <th className="p-4">Duration</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Message</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {results.map((r, i) => (
                                    <tr key={i} className="hover:bg-white/5">
                                        <td className="p-4 text-white font-medium">{r.student}</td>
                                        <td className="p-4 text-gray-400">{formatDuration(r.duration)}</td>
                                        <td className="p-4">
                                            {r.success ? (
                                                <span className="text-green-400">Success</span>
                                            ) : (
                                                <span className="text-red-400">Failed</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-gray-400">{r.message}</td>
                                    </tr>
                                ))}
                                {results.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-500">No sessions to process.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
