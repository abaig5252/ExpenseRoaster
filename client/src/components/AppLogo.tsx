interface AppLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  showText?: boolean;
}

const PX = { xs: 60, sm: 80, md: 104, lg: 132 };

const TEXT = {
  xs: "text-[10px] tracking-[0.18em]",
  sm: "text-[12px] tracking-[0.18em]",
  md: "text-[15px] tracking-[0.18em]",
  lg: "text-[18px] tracking-[0.18em]",
};

const GAP = { xs: "gap-2", sm: "gap-2.5", md: "gap-3", lg: "gap-3.5" };

function FlameSVG({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flame-logo"
      aria-hidden="true"
    >
      {/* Dark background fill so the box is visible */}
      <rect x="10" y="10" width="100" height="100" rx="22" fill="#0D0D0D" />
      {/* Glowing green border */}
      <rect x="10" y="10" width="100" height="100" rx="22"
        stroke="#7CFF4D" strokeWidth="5" fill="none" />

      {/* Outer flame — sharp jagged flicks, exact path preserved */}
      <path
        className="flame-outer"
        d="M60 20 C60 20 50 35 45 45 C35 55 30 70 30 82 C30 95 43 100 60 100 C77 100 90 95 90 82 C90 70 82 55 75 45 L82 55 C82 55 85 35 60 20 Z"
        fill="none"
        stroke="#7CFF4D"
        strokeWidth="4.5"
        strokeLinejoin="miter"
      />

      {/* Inner flame — solid flickering core */}
      <path
        className="flame-inner"
        d="M60 50 L52 70 C52 70 50 85 60 85 C70 85 68 70 68 70 L60 50 Z"
        fill="#7CFF4D"
      />
    </svg>
  );
}

export function AppLogo({ size = "sm", showText = true }: AppLogoProps) {
  const px = PX[size];

  return (
    <div className={`flex flex-col items-center ${GAP[size]} select-none`}>
      <FlameSVG px={px} />
      {showText && (
        <span
          className={`font-black uppercase text-white text-center whitespace-nowrap ${TEXT[size]}`}
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          EXPENSE ROASTER
        </span>
      )}
    </div>
  );
}
