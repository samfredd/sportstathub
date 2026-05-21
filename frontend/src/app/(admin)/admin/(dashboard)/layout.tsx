"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { clearAdminSession, getStoredUser } from "@/lib/adminApi";

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export default function AdminDashboardLayout({ children }) {
  const router = useRouter();
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const u = getStoredUser();
      if (!u || u.role !== "admin") {
        router.replace("/admin/login");
        return;
      }
      if (u.exp && u.exp * 1000 < Date.now()) {
        clearAdminSession();
        router.replace("/admin/login?session=expired");
        return;
      }
      setUser(u);
      setLoading(false);
    });
  }, [router]);

  function handleLogout() {
    clearAdminSession();
    router.replace("/admin/login");
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
      <AdminSidebar
        user={user}
        onLogout={handleLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Admin Header */}
        <header className="h-14 lg:h-16 shrink-0 border-b border-border/40 flex items-center justify-between px-4 lg:px-8 bg-background/50 backdrop-blur-md z-10 gap-3">
          {/* Left: hamburger (mobile) + title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
              aria-label="Open menu"
            >
              <HamburgerIcon />
            </button>
            <h1 className="text-xs sm:text-sm font-black text-foreground uppercase tracking-widest truncate">
              <span className="hidden sm:inline">SportStatHubligence </span>System
            </h1>
          </div>

          {/* Right: live badge + theme */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-black text-accent uppercase tracking-wider">Live</span>
            </div>
            {/* Mini live dot on mobile */}
            <span className="sm:hidden w-2 h-2 rounded-full bg-accent animate-pulse" />
            <ThemeToggle />
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 no-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
