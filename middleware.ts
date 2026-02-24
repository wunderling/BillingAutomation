import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: "",
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value: "",
                        ...options,
                    });
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // If accessing API routes (except ingest which handles its own auth or public auth routes)
    // or dashboard pages, enforce Login.
    const path = request.nextUrl.pathname;

    // Public paths
    if (path === "/login" || path.startsWith("/api/ingest") || path.startsWith("/api/auth")) {
        // If user is already logged in and authorized, redirect to dashboard
        if (path === "/login" && user) {
            const adminEmail = process.env.ADMIN_EMAIL;
            if (!adminEmail || user.email === adminEmail) {
                return NextResponse.redirect(new URL("/dashboard", request.url));
            }
        }
        return response;
    }

    // Helper to return 401 for API, or redirect for Pages
    const handleUnauthorized = (reason: string) => {
        if (path.startsWith("/api/")) {
            return NextResponse.json({ error: reason }, { status: 401 });
        }
        return NextResponse.redirect(new URL("/login" + (reason ? `?error=${reason}` : ""), request.url));
    };

    if (!user) {
        return handleUnauthorized("unauthenticated");
    }

    // Check Admin Email
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && user.email !== adminEmail) {
        return handleUnauthorized("unauthorized");
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
