import { Suspense } from "react";

import { SignupForm } from "./ui";

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-5.25rem)] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
        <span className="text-[#F43F5E]">Sign up</span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Create your account, then continue to checkout or your dashboard.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
