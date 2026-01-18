"use client";

import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
// import { useRouter } from "next/navigation"; // Not needed if simple redirect

export default function LoginPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const [loading, setLoading] = useState(false);
    const searchParams = useSearchParams();
    const errorMsg = searchParams.get("error");
    const [message, setMessage] = useState(errorMsg ? `Error: ${errorMsg}` : "");

    const handleGoogleLogin = async () => {
        setLoading(true);
        const supabase = createClient();

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/api/auth/callback`,
                queryParams: {
                    access_type: 'offline', // optional, for refresh tokens
                    prompt: 'consent', // optional
                },
            },
        });

        if (error) {
            setMessage("Error: " + error.message);
            setLoading(false);
        }
        // Redirect happens automatically
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
            <div className="w-full max-w-xl p-8 glass rounded-2xl text-center">
                <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent leading-tight">
                    <span className="whitespace-nowrap">Wunderling Learning Center</span><br />
                    Billing Automation
                </h1>

                {/* 
                  TODO: Ideally use a proper Google Button SVG or Icon. 
                  For now, a styled button.
                */}
                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-white text-[#1f1f1f] font-medium py-3 px-4 rounded-full border border-[#747775] hover:bg-[#F2F2F2] hover:border-[#1f1f1f] hover:shadow-sm transition-all flex items-center justify-center gap-3 disabled:opacity-70 relative overflow-hidden group"
                >
                    {loading ? (
                        <span>Connecting...</span>
                    ) : (
                        <>
                            <div className="flex-shrink-0">
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                            </div>
                            <span className="text-sm font-medium tracking-wide">Sign in with Google</span>
                        </>
                    )}
                </button>

                {message && (
                    <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                        {message}
                    </div>
                )}

                <div className="mt-8 text-xs text-gray-500 text-center">
                    Authorized access only.
                </div>
            </div>
        </div>
    );
}
