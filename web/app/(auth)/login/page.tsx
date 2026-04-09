import { Suspense } from "react";

import { LoginForm } from "./ui";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-5.25rem)] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Log <span className="text-[#F43F5E]">in</span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Welcome back. Use the same email as your BofBot account.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
