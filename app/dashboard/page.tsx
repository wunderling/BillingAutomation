import { createClient } from "@/lib/supabase/client"; // NOTE: Should use server client for RSC
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export const dynamic = 'force-dynamic';

async function getStats() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    // Server component can't set cookies usually, ignore for read
                }
            }
        }
    )

    // Parallel fetch
    const [
        { count: pendingCount },
        { count: approvedCount },
        { count: needsReviewCount },
        { count: unmatchedCount },
        { count: postedCount }
    ] = await Promise.all([
        supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
        supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'needs_review_duration'),
        supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'unmatched_customer'),
        supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'posted_to_qbo'),
    ]);

    return { pendingCount, approvedCount, needsReviewCount, unmatchedCount, postedCount };
}

export default async function DashboardPage() {
    const stats = await getStats();

    const statCards = [
        { label: "Pending Review", value: stats.pendingCount || 0, color: "text-blue-400", href: "/sessions?status=pending_review" },
        { label: "Ready to Post", value: stats.approvedCount || 0, color: "text-green-400", href: "/sessions?status=approved" },
        { label: "Needs Info", value: (stats.needsReviewCount || 0) + (stats.unmatchedCount || 0), color: "text-yellow-400", href: "/sessions?status=needs_review_duration" },
        { label: "Posted (All Time)", value: stats.postedCount || 0, color: "text-purple-400", href: "/sessions?status=posted_to_qbo" },
    ];

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat) => (
                    <Link key={stat.label} href={stat.href} className="block group">
                        <div className="glass p-6 rounded-2xl border border-white/5 hover:border-white/20 transition-all">
                            <p className="text-sm text-gray-400 mb-2">{stat.label}</p>
                            <p className={`text-4xl font-bold ${stat.color} group-hover:scale-105 transition-transform`}>
                                {stat.value}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="mt-12">
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="flex gap-4">
                    <Link href="/sessions" className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                        Review Sessions
                    </Link>
                    <Link href="/post" className="px-6 py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/50 rounded-xl transition-colors">
                        Run Post Job
                    </Link>
                </div>
            </div>
        </div>
    );
}
