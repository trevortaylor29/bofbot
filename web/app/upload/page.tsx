import Link from "next/link";

import { UploadFlow } from "./upload-flow";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-xl font-medium text-zinc-100">Upload videos</h1>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          Dashboard
        </Link>
      </div>
      <UploadFlow />
    </div>
  );
}
