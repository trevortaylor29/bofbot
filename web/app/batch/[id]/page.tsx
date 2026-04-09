import { Suspense } from "react";

import { BatchDetail } from "./batch-detail";

export default async function BatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <BatchDetail batchId={id} />
      </Suspense>
    </div>
  );
}
