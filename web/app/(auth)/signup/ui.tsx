"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const inputClass =
  "mt-1.5 block w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#F43F5E]/45 focus:outline-none focus:ring-1 focus:ring-[#F43F5E]/35";

const primaryBtn =
  "mt-2 w-full rounded-full bg-[#F43F5E] py-3 text-sm font-semibold text-white shadow-lg shadow-[#F43F5E]/25 ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.01] hover:shadow-[0_0_24px_rgba(244,63,94,0.35)] disabled:opacity-50";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const loginHref = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setPending(false);
      setError(data.error ?? "Could not create account.");
      return;
    }
    const sign = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setPending(false);
    if (sign?.error) {
      router.push(loginHref);
      return;
    }
    if (sign?.url) {
      router.push(sign.url);
      router.refresh();
    }
  }

  return (
    <div>
      <p className="mb-6 text-sm text-zinc-500">
        Already have an account?{" "}
        <Link
          href={loginHref}
          className="font-medium text-[#F43F5E] transition hover:text-[#fb7185]"
        >
          Log in
        </Link>
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <label className="block text-sm font-medium text-zinc-400">
          Name <span className="font-normal text-zinc-600">(optional)</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-zinc-400">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-zinc-400">
          Password{" "}
          <span className="font-normal text-zinc-600">(min 8 characters)</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-xs text-zinc-600">
          By signing up you agree to our{" "}
          <Link href="/" className="text-zinc-400 underline hover:text-white">
            terms
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
