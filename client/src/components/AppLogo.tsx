interface AppLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

function FlameIcon({ px }: { px: number }) {
  const id = `fg-${px}`;
  return (
    <svg
      width={px}
      height={Math.round(px * 1.3)}
      viewBox="0 0 20 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="10" y1="0" x2="10" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(var(--secondary))" />
          <stop offset="100%" stopColor="hsl(var(--primary))" />
        </linearGradient>
      </defs>
      {/*
        Double-peaked flame:
        - Left peak at (6, 0) — taller
        - Right peak at (14, 4) — shorter
        - Valley between peaks at (10, 9)
        - Wide rounded base
      */}
      <path
        d="
          M 6 0
          C 5 3 3 7 4 11
          C 2 13 1 15 1 18
          C 1 22 5 26 10 26
          C 15 26 19 22 19 18
          C 19 15 18 13 16 11
          C 17 7 15 3 14 4
          C 13 6 12 8 10 9
          C 8 8 7 5 6 0
          Z
        "
        fill={`url(#${id})`}
      />
    </svg>
  );
}

export function AppLogo({ size = "md", showText = true }: AppLogoProps) {
  const config = {
    sm: { px: 20, textClass: "text-base tracking-[0.12em]", gap: "gap-2" },
    md: { px: 26, textClass: "text-xl tracking-[0.12em]", gap: "gap-2.5" },
    lg: { px: 38, textClass: "text-3xl tracking-[0.12em]", gap: "gap-3" },
  }[size];

  return (
    <div className={`flex items-center ${config.gap} select-none`}>
      <FlameIcon px={config.px} />
      {showText && (
        <span
          className={`font-black uppercase text-white ${config.textClass}`}
          style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.08em" }}
        >
          Expense Roaster
        </span>
      )}
    </div>
  );
}
