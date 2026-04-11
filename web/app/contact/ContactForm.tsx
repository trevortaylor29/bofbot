"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subject, message }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };
      if (!r.ok) {
        setErr(data.error || "Something went wrong.");
        setBusy(false);
        return;
      }
      setSent(true);
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div
        className="rounded-xl border border-[#F43F5E]/25 bg-[#F43F5E]/[0.06] px-5 py-6 text-center"
        role="status"
      >
        <p className="font-display text-lg font-semibold text-white">
          Message sent
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Thanks — we&apos;ll get back to you soon.
        </p>
        <button
          type="button"
          className="mt-6 text-sm font-medium text-[#F43F5E] underline-offset-2 hover:text-[#fb7185] hover:underline"
          onClick={() => setSent(false)}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="contact-email"
          className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500"
        >
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className="w-full rounded-xl border border-white/[0.1] bg-[#111] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-[#F43F5E]/40 focus:ring-1 focus:ring-[#F43F5E]/25 disabled:opacity-50"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label
          htmlFor="contact-subject"
          className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500"
        >
          Subject
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          required
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={busy}
          className="w-full rounded-xl border border-white/[0.1] bg-[#111] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-[#F43F5E]/40 focus:ring-1 focus:ring-[#F43F5E]/25 disabled:opacity-50"
          placeholder="What’s this about?"
        />
      </div>
      <div>
        <label
          htmlFor="contact-message"
          className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          maxLength={20000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={busy}
          className="min-h-[140px] w-full resize-y rounded-xl border border-white/[0.1] bg-[#111] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-[#F43F5E]/40 focus:ring-1 focus:ring-[#F43F5E]/25 disabled:opacity-50"
          placeholder="Your message…"
        />
      </div>
      {err ? (
        <p className="text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-gradient-to-r from-[#F43F5E] to-[#fb7185] py-3.5 text-sm font-semibold text-white shadow-[0_0_32px_-8px_rgba(244,63,94,0.45)] ring-1 ring-white/15 transition hover:opacity-95 disabled:opacity-50 sm:w-auto sm:min-w-[180px] sm:px-10"
      >
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
