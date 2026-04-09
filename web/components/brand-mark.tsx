/** Logo tile — safe to import from server components. */
export function BrandLogoMark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F43F5E] text-sm font-bold text-white shadow-lg shadow-[#F43F5E]/30 ${className}`}
    >
      B
    </div>
  );
}
