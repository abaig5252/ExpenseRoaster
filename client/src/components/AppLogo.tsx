interface AppLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  showText?: boolean;
}

const PX = { xs: 44, sm: 60, md: 84, lg: 110 };

const TEXT = {
  xs: "text-[10px] tracking-[0.2em]",
  sm: "text-[12px] tracking-[0.2em]",
  md: "text-sm tracking-[0.2em]",
  lg: "text-base tracking-[0.2em]",
};

const GAP = { xs: "gap-2", sm: "gap-2.5", md: "gap-3", lg: "gap-3.5" };

function FlameSVG({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="logo-glow"
      aria-hidden="true"
    >
      <rect width="100" height="100" rx="20" fill="#121212" stroke="#7CFF4D" strokeWidth="3" />

      <path
        d="M50 20C50 20 35 45 35 65C35 73.2843 41.7157 80 50 80C58.2843 80 65 73.2843 65 65C65 55 58 45 50 20Z"
        stroke="#7CFF4D"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      <path
        d="M50 45C50 45 43 55 43 65C43 68.866 46.134 72 50 72C53.866 72 57 68.866 57 65C57 60 54 55 50 45Z"
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
          className={`font-black uppercase text-white ${TEXT[size]}`}
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Expense Roaster
        </span>
      )}
    </div>
  );
}
