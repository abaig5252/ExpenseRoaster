interface AppLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  showText?: boolean;
}

const PX  = { xs: 60, sm: 80, md: 104, lg: 150 };
const GAP = { xs: "gap-2", sm: "gap-2.5", md: "gap-3", lg: "gap-4" };
const TXT = {
  xs: "text-[10px] tracking-[0.15em]",
  sm: "text-[12px] tracking-[0.15em]",
  md: "text-[15px] tracking-[0.15em]",
  lg: "text-[20px] tracking-[0.1em]",
};

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
      {/* Dark background so the box is visible */}
      <rect x="10" y="10" width="100" height="100" rx="20" fill="#0D0D0D" />

      {/* Glowing border */}
      <rect x="10" y="10" width="100" height="100" rx="20"
        stroke="#7CFF4D" strokeWidth="6" fill="none" />

      {/* All flame paths inside one group — glow filter applied here */}
      <g className="burning-flame">
        {/* Main flame body */}
        <path
          d="M60 20 L75 50 C85 65 85 85 60 95 C35 85 35 65 45 50 L60 20Z"
          stroke="#7CFF4D" strokeWidth="4.5" fill="none" strokeLinejoin="miter"
        />

        {/* Left flick */}
        <path
          d="M48 55 L38 40 L45 65"
          stroke="#7CFF4D" strokeWidth="4" fill="none" strokeLinecap="square"
        />

        {/* Right flick */}
        <path
          d="M72 55 L82 35 L75 60"
          stroke="#7CFF4D" strokeWidth="4" fill="none" strokeLinecap="square"
        />

        {/* Solid inner core */}
        <path
          className="core"
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
    <div className={`flex flex-col items-center ${GAP[size]} select-none`}>
      <FlameSVG px={px} />
      {showText && (
        <h1
          className={`font-black uppercase text-white text-center m-0 leading-[1] ${TXT[size]}`}
          style={{ fontFamily: "'Inter', 'DM Sans', sans-serif", letterSpacing: "2px" }}
        >
          EXPENSE<br />ROASTER
        </h1>
      )}
    </div>
  );
}
