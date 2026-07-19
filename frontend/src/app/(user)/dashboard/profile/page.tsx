"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { communityApi } from "@/lib/communityApi";

interface Profile {
  id: number; username: string; email: string; role: string;
  avatar_url: string | null; bio: string | null; display_name: string | null;
  is_verified: boolean; created_at: string;
  subscription_plan: string | null; subscription_status: string | null;
}

function initials(name: string) { return name.slice(0, 1).toUpperCase(); }

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm]       = useState({ display_name: "", bio: "", avatar_url: "" });
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    communityApi.getMe().then((p: Profile) => {
      setProfile(p);
      setForm({ display_name: p.display_name ?? "", bio: p.bio ?? "", avatar_url: p.avatar_url ?? "" });
    }).catch(() => {});
  }, []);

  function field(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await communityApi.updateProfile({
        display_name: form.display_name || undefined,
        bio:          form.bio          || undefined,
        avatar_url:   form.avatar_url   || undefined,
      }) as Profile;
      setProfile(updated);
      setToast({ msg: "Profile saved", ok: true });
    } catch (err: any) {
      setToast({ msg: err.message || "Failed to save", ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  const memberDate  = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "—";
  const displayName = form.display_name || profile?.username || "User";

  return (
    <div className="space-y-6 h-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Profile</h2>
        <p className="text-muted text-sm font-medium mt-1">Manage your public-facing profile</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left — Account overview */}
        <div className="flex flex-col gap-6">

          {/* Avatar + identity card */}
          <div className="glass rounded-2xl p-6 border border-border/30 flex-1">
            <p className="text-[11px] font-black text-muted uppercase tracking-widest mb-5">Account Details</p>

            <div className="flex items-center gap-5 mb-6">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-accent/10 border-2 border-accent/20 flex items-center justify-center overflow-hidden">
                  {form.avatar_url
                    ? <img src={form.avatar_url} alt="avatar" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
                    : <span className="text-3xl font-black text-accent">{initials(displayName)}</span>
                  }
                </div>
                {profile?.is_verified && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-success border-2 border-background flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-black text-foreground truncate">{displayName}</p>
                <p className="text-sm text-muted truncate mt-0.5">{profile?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <RoleBadge role={profile?.role || "user"} />
                  {profile?.subscription_plan && profile.subscription_plan !== "free" && (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20 uppercase tracking-wider">{profile.subscription_plan}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Username",     value: profile?.username ?? "—" },
                { label: "Email",        value: profile?.email ?? "—" },
                { label: "Role",         value: (profile?.role ?? "user").toUpperCase() },
                { label: "Member Since", value: memberDate },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface/60 rounded-xl px-4 py-3 border border-border/20">
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-sm font-bold text-foreground truncate">{value}</p>
                </div>
              ))}
            </div>

            {/* Creator page link */}
            {profile?.role === "creator" && profile?.id && (
              <div className="flex items-center gap-3 p-3 bg-accent/5 border border-accent/15 rounded-xl mt-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">Your public creator page</p>
                  <p className="text-[11px] text-muted truncate">/creators/{profile.id}</p>
                </div>
                <Link href={`/creators/${profile.id}`} className="text-sm font-bold text-accent hover:underline shrink-0">View ↗</Link>
              </div>
            )}
          </div>

          {/* Profile completion */}
          {profile && (
            <div className="glass rounded-2xl p-6 border border-border/30">
              <p className="text-[11px] font-black text-muted uppercase tracking-widest mb-4">Profile Completion</p>
              {(() => {
                const items = [
                  { label: "Avatar",       done: !!profile.avatar_url },
                  { label: "Display name", done: !!profile.display_name },
                  { label: "Bio",          done: !!profile.bio },
                  { label: "Verified",     done: !!profile.is_verified },
                ];
                const pct = Math.round((items.filter((i) => i.done).length / items.length) * 100);
                return (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-black text-foreground">{pct}%</span>
                      {pct === 100 && <span className="text-[11px] font-black text-success">Complete ✓</span>}
                    </div>
                    <div className="w-full h-2 bg-surface rounded-full overflow-hidden mb-4">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--accent-gradient)" }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((item) => (
                        <div key={item.label} className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border ${item.done ? "text-success bg-success/5 border-success/20" : "text-muted/60 border-border/30"}`}>
                          <span>{item.done ? "✓" : "○"}</span> {item.label}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Right — Edit form */}
        <div>
          <form onSubmit={handleSave} className="glass rounded-2xl p-6 border border-border/30 h-full flex flex-col gap-5">
            <p className="text-[11px] font-black text-muted uppercase tracking-widest">Edit Public Profile</p>

            {/* Avatar URL + preview */}
            <div>
              <label className="block text-[11px] font-black text-muted uppercase tracking-wider mb-2">Avatar URL</label>
              <input
                type="url"
                value={form.avatar_url}
                onChange={(e) => field("avatar_url", e.target.value)}
                placeholder="https://approved-image-host.example/avatar.jpg"
                className="w-full glass px-4 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
              />
              <p className="text-[10px] text-muted mt-1.5">Use HTTPS on an approved image host. Shown in the forum and on your creator page.</p>
            </div>

            {/* Display name */}
            <div>
              <label className="block text-[11px] font-black text-muted uppercase tracking-wider mb-2">
                Display Name <span className="normal-case font-medium text-muted/50">(shown publicly)</span>
              </label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => field("display_name", e.target.value)}
                placeholder={profile?.username ?? "Your name"}
                maxLength={100}
                className="w-full glass px-4 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
              />
            </div>

            {/* Bio */}
            <div className="flex-1 flex flex-col">
              <label className="block text-[11px] font-black text-muted uppercase tracking-wider mb-2">
                Bio <span className="normal-case font-medium text-muted/50">(max 500 chars)</span>
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => field("bio", e.target.value)}
                placeholder="Tell the community about yourself — your betting style, favourite leagues, or predictions approach…"
                maxLength={500}
                className="flex-1 min-h-[140px] w-full glass px-4 py-3 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all resize-none"
              />
              <p className="text-[10px] text-muted text-right mt-1">{form.bio.length}/500</p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-black text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 mt-auto"
              style={{ background: "var(--accent-gradient)" }}
            >
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </form>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold ${toast.ok ? "bg-success" : "bg-danger"} text-white`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
    creator: "bg-accent-gold/10 text-accent-gold border-accent-gold/20",
    user:    "bg-surface text-muted border-border/40",
  };
  return (
    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${styles[role] ?? styles.user}`}>
      {role}
    </span>
  );
}
