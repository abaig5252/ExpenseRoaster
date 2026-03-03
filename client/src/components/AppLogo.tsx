interface AppLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  showText?: boolean;
}

const PX   = { xs: 46, sm: 62, md: 86, lg: 112 };
const TEXT = {
  xs: { size: "text-[9px]",  leading: "leading-[1.1]", tracking: "tracking-[0.15em]" },
  sm: { size: "text-[11px]", leading: "leading-[1.1]", tracking: "tracking-[0.15em]" },
  md: { size: "text-[13px]", leading: "leading-[1.1]", tracking: "tracking-[0.15em]" },
  lg: { size: "text-[16px]", leading: "leading-[1.1]", tracking: "tracking-[0.15em]" },
};
const GAP  = { xs: "gap-2", sm: "gap-2.5", md: "gap-3", lg: "gap-3.5" };

function FlameSVG({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="logo-glow"
      aria-hidden="true"
    >
      {/* Rounded square border — stroke only, transparent fill */}
      <rect x="10" y="10" width="100" height="100" rx="22"
        stroke="#7CFF4D" strokeWidth="5" fill="none" />

      {/* Outer flame — stroke outline */}
      <path
        d="M60 28C60 28 42 52 42 72C42 81.94 50.06 90 60 90C69.94 90 78 81.94 78 72C78 52 60 28 60 28Z"
        stroke="#7CFF4D" strokeWidth="4.5" fill="none" strokeLinejoin="round"
      />

      {/* Inner flame — solid filled teardrop */}
      <path
        d="M60 58C60 58 52 68 52 74C52 78.42 55.58 82 60 82C64.42 82 68 78.42 68 74C68 68 60 58 60 58Z"
        fill="#7CFF4D"
      />
    </svg>
  );
}

export function AppLogo({ size = "sm", showText = true }: AppLogoProps) {
  const px  = PX[size];
  const txt = TEXT[size];

  return (
    <div className={`flex flex-col items-center ${GAP[size]} select-none`}>
      <FlameSVG px={px} />

      {showText && (
        <p
          className={`font-black uppercase text-white text-center m-0 ${txt.size} ${txt.leading} ${txt.tracking}`}
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          EXPENSE<br />ROASTER
        </p>
      )}
    </div>
  );
}
