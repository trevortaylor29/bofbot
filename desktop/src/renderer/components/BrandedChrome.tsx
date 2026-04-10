import type { ReactNode } from "react";

import { NOISE_DATA_URI } from "../brand";

type Props = {
  children: ReactNode;
  /** Extra bottom padding for scroll areas */
  className?: string;
};

/**
 * Site-aligned shell: #0a0a0a, fractal noise, soft radial accents (marketing-style).
 */
export function BrandedChrome({ children, className = "" }: Props) {
  return (
    <div className={`branded-root ${className}`.trim()}>
      <div className="branded-glow branded-glow--hero" aria-hidden />
      <div className="branded-glow branded-glow--soft" aria-hidden />
      <div
        className="branded-noise"
        aria-hidden
        style={{
          backgroundImage: `url("${NOISE_DATA_URI}")`,
        }}
      />
      <div className="branded-content">{children}</div>
    </div>
  );
}
