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
      className="flame-logo"
      aria-hidden="true"
    >
      {/* Rounded square border */}
      <rect x="10" y="10" width="100" height="100" rx="22"
        stroke="#7CFF4D" strokeWidth="5" fill="none" />

      {/* Outer flame — flickering stroke with sharp flicks */}
      <path
        className="flame-outer"
        d="M60 22C60 22 52 38 45 50C38 60 35 72 35 82C35 92 46 98 60 98C74 98 85 92 85 82C85 70 75 55 68 45C72 50 78 60 78 70C78 70 82 38 60 22Z"
        fill="none"
        stroke="#7CFF4D"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />

      {/* Inner flame — pulsing solid core */}
      <path
        className="flame-inner"
        d="M60 55C60 55 52 65 52 75C52 80 55 84 60 84C65 84 68 80 68 75C68 68 60 55 60 55Z"
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
