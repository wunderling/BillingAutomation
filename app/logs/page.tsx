"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LogsPage() {
    const supabase = createClient();
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRuns = async () => {
            const { data } = await supabase.from('runs').select('*').order('started_at', { ascending: false }).limit(20);
            if (data) setRuns(data);
            setLoading(false);
        };
        fetchRuns();
    }, []);

    if (loading) return <div className="p-12 text-center">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto px-6 py-12">
            <h1 className="text-3xl font-bold mb-8">Run Logs</h1>
            <div className="glass rounded-xl overflow-hidden border border-white/5">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-gray-500 font-medium">
                        <tr>
                            <th className="p-4">Date</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {runs.map(r => (
                            <tr key={r.id}>
                                <td className="p-4 text-gray-400">{new Date(r.started_at).toLocaleString()}</td>
                                <td className="p-4 uppercase text-xs font-bold tracking-wider">{r.type}</td>
                                <td className="p-4">{r.status}</td>
                                <td className="p-4 font-mono text-xs text-gray-500 truncate max-w-xs">{JSON.stringify(r.details)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
