import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TutorBilling | Automated",
  description: "Automated tutoring billing staging",
};

function Navbar() {
  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/sessions", label: "Sessions" },
    { href: "/post", label: "Post to QBO" },
    { href: "/settings", label: "Settings" },
    { href: "/logs", label: "Logs" },
  ];

  return (
    <nav className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-xl font-bold tracking-tighter text-white">
            TutorBilling
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500" />
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check if we are on login page? Layout wraps everything.
  // We can condition rendering Navbar.
  // But for now, let's just render it. Login page can rely on it or hide it via route groups if we wanted.

  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Navbar />
        <main className="min-h-screen pb-20">
          {children}
        </main>
      </body>
    </html>
  );
}
