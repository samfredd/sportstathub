"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UserSidebar from "@/components/user/UserSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { getSessionUser, logout as sessionLogout } from "@/lib/session";
import { communityApi } from "@/lib/communityApi";

export default function UserDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = getSessionUser();
    if (!stored) { router.replace("/auth/login"); return; }
    // Render immediately from the stored descriptor, then confirm the cookie is
    // still valid against the server (expired/invalid cookie → back to login).
    setUser(stored);
    setLoading(false);
    communityApi.getMe()
      .then((me: any) => setUser(me))
      .catch(() => { sessionLogout().finally(() => router.replace("/auth/login?session=expired")); });
  }, [router]);

  function handleLogout() {
    void sessionLogout().finally(() => router.push("/"));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto lg:translate-x-0 transition-transform duration-300 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <UserSidebar user={user} onLogout={handleLogout} />
      </div>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 shrink-0 border-b border-border/40 flex items-center justify-between px-6 bg-background/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              className="lg:hidden p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface-hover transition-all"
            >
              <MenuIcon />
            </button>
            <h1 className="text-sm font-black text-foreground uppercase tracking-widest">SportStatHubligence System</h1>
          </div>
          <div className="flex items-center gap-3">
            <RolePill role={user?.role} />
            <ThemeToggle />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 no-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}

function RolePill({ role }: { role?: string }) {
  const styles: Record<string, string> = {
    creator: "bg-accent-gold/10 border-accent-gold/20 text-accent-gold",
    admin:   "bg-danger/10      border-danger/20      text-danger",
    user:    "bg-accent/10      border-accent/20      text-accent",
  };
  const s = styles[role ?? "user"] ?? styles.user;
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${s}`}>
      <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
      <span className="text-[10px] font-black uppercase tracking-wider">{role ?? "user"}</span>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
