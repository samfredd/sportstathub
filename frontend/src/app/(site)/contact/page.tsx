"use client";

import { useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function ContactPage() {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast]     = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch(`${BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Failed to send message");
      }
      showToast("Message sent! We'll get back to you soon.");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="px-4 lg:px-6 py-16 font-sans">
      <div className="flex flex-col md:flex-row gap-16">

        {/* Contact Info */}
        <div className="flex-1 space-y-10">
          <div>
            <h1 className="text-5xl md:text-6xl font-black text-foreground mb-6 tracking-tighter leading-none">Get in Touch</h1>
            <p className="text-xl text-muted font-medium max-w-lg leading-relaxed">
              Have a question about our predictions? Want to collaborate or share field data? Our team is always ready to talk.
            </p>
          </div>

          <div className="space-y-8 pt-4">
            <ContactInfoItem
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>}
              label="Email Us"
              value="support@sportintelligence.com"
              link="mailto:support@sportintelligence.com"
            />
            <ContactInfoItem
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path></svg>}
              label="Telegram Community"
              value="@SportIntelligence"
              link="https://t.me/SportIntelligence"
            />
          </div>
        </div>

        {/* Contact Form */}
        <div className="flex-1 glass rounded-[3rem] p-10 md:p-12 shadow-glass border-border/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -mr-10 -mt-10"></div>

          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-muted uppercase tracking-[0.2em] px-2">Your Name</label>
              <input
                type="text"
                required
                placeholder="Lionel Messi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full glass bg-surface/50 border-border/40 rounded-2xl p-4 text-foreground font-bold focus:outline-none focus:border-accent focus:bg-surface transition-all placeholder:text-muted/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-muted uppercase tracking-[0.2em] px-2">Email Address</label>
              <input
                type="email"
                required
                placeholder="leo@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full glass bg-surface/50 border-border/40 rounded-2xl p-4 text-foreground font-bold focus:outline-none focus:border-accent focus:bg-surface transition-all placeholder:text-muted/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-muted uppercase tracking-[0.2em] px-2">Message</label>
              <textarea
                rows={5}
                required
                minLength={10}
                placeholder="How can we help you today?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full glass bg-surface/50 border-border/40 rounded-2xl p-4 text-foreground font-bold focus:outline-none focus:border-accent focus:bg-surface resize-none transition-all placeholder:text-muted/40"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={sending || !name || !email || !message}
              className="w-full bg-accent hover:bg-accent-hover text-white font-black py-5 px-8 rounded-2xl shadow-sm transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {sending ? "Sending…" : "SEND MESSAGE"}
              {!sending && (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              )}
            </button>
          </form>
        </div>

      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold animate-in slide-in-from-bottom duration-300 ${
          toast.type === "error" ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function ContactInfoItem({ icon, label, value, link }) {
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-6 group cursor-pointer">
      <div className="w-14 h-14 glass rounded-2xl flex items-center justify-center text-accent shadow-sm group-hover:bg-accent group-hover:text-white transition-all transform group-hover:rotate-6">
        {icon}
      </div>
      <div>
        <span className="text-[11px] font-black text-muted uppercase tracking-[0.2em] block mb-1">{label}</span>
        <span className="text-xl font-bold text-foreground group-hover:text-accent transition-colors tracking-tight">{value}</span>
      </div>
    </a>
  );
}
