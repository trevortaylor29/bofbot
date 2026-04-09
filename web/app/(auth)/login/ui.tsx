"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const inputClass =
  "mt-1.5 block w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#F43F5E]/45 focus:outline-none focus:ring-1 focus:ring-[#F43F5E]/35";

const primaryBtn =
  "mt-2 w-full rounded-full bg-[#F43F5E] py-3 text-sm font-semibold text-white shadow-lg shadow-[#F43F5E]/25 ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.01] hover:shadow-[0_0_24px_rgba(244,63,94,0.35)] disabled:opacity-50";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const signupHref = `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setPending(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    if (res?.url) {
      router.push(res.url);
      router.refresh();
    }
  }

  return (
    <div>
      <p className="mb-6 text-sm text-zinc-500">
        New here?{" "}
        <Link
          href={signupHref}
          className="font-medium text-[#F43F5E] transition hover:text-[#fb7185]"
        >
          Create an account
        </Link>
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
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
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
