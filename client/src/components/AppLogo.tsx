interface AppLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  showText?: boolean;
}

const PX  = { xs: 60, sm: 80, md: 104, lg: 150 };
const GAP = { xs: "gap-2", sm: "gap-2.5", md: "gap-3", lg: "gap-4" };
const TXT = {
  xs: "text-[11px]",
  sm: "text-[14px]",
  md: "text-[16px]",
  lg: "text-[20px]",
};

function FlameSVG({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flame-icon"
      aria-hidden="true"
    >
      <rect x="10" y="10" width="100" height="100" rx="18" fill="#0D0D0D" />
      <rect x="10" y="10" width="100" height="100" rx="18"
        stroke="#7CFF4D" strokeWidth="6" fill="none" />

      <g className="flame-group">
        <path
          className="flame-main"
          d="M60 25 L70 45 L82 65 C82 85 75 92 60 92 C45 92 38 85 38 65 L50 45 L60 25Z"
          stroke="#7CFF4D" strokeWidth="4.5" fill="none" strokeLinejoin="miter"
        />
        <path
          className="flame-flick-right"
          d="M72 48 L88 32 L78 60"
          stroke="#7CFF4D" strokeWidth="4" fill="none" strokeLinecap="round"
        />
        <path
          className="flame-flick-left"
          d="M48 50 L35 35 L42 62"
          stroke="#7CFF4D" strokeWidth="4" fill="none" strokeLinecap="round"
        />
        <path
          className="flame-core"
          d="M60 55 L52 75 C52 82 68 82 68 75 L60 55Z"
          fill="#7CFF4D"
        />
      </g>
    </svg>
  );
}

export function AppLogo({ size = "sm", showText = true }: AppLogoProps) {
  const px = PX[size];

  return (
    <div className={`brand-container ${GAP[size]} select-none`}>
      <FlameSVG px={px} />
      {showText && (
        <div className={`brand-text ${TXT[size]}`}>
          <span>EXPENSE</span>
          <span>ROASTER</span>
        </div>
      )}
    </div>
  );
}
