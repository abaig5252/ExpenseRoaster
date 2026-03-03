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
