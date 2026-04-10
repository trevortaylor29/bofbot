import Image from "next/image";

type Props = {
  className?: string;
};

/** Logo from `/icon.png` — safe to import from server or client components. */
export function BrandLogoMark({
  className = "h-9 w-9 shrink-0 rounded-xl object-cover shadow-lg shadow-[#F43F5E]/30",
}: Props) {
  return (
    <Image
      src="/icon.png"
      alt="BofBot"
      width={36}
      height={36}
      className={className}
      priority
    />
  );
}
