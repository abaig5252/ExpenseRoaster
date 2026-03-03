interface AppLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  showText?: boolean;
}

const SIZES = {
  xs: { box: 36, stroke: 1.6, radius: 9,  blur: 10, textCls: "text-[9px] tracking-[0.18em]",  gap: "gap-1.5" },
  sm: { box: 48, stroke: 2,   radius: 12, blur: 14, textCls: "text-[11px] tracking-[0.18em]", gap: "gap-2"   },
  md: { box: 68, stroke: 2.5, radius: 17, blur: 18, textCls: "text-sm tracking-[0.18em]",     gap: "gap-2.5" },
  lg: { box: 96, stroke: 3,   radius: 24, blur: 26, textCls: "text-lg tracking-[0.18em]",     gap: "gap-3"   },
};

function FlameStroke({ size, stroke }: { size: number; stroke: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer flame body — wide classic fire shape */}
      <path
        d="M 20 3
           C 16 9 10 16 9 24
           C 9 30 10 35 14 39
           C 12 41 11 44 13 46
           C 15 48 18 48 20 48
           C 22 48 25 48 27 46
           C 29 44 28 41 26 39
           C 30 35 31 30 31 24
           C 31 16 24 9 20 3 Z"
        stroke="hsl(var(--primary))"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner flame — sits in the middle, creates the "candle flame" detail */}
      <path
        d="M 20 19
           C 18 23 16 27 16 32
           C 16 37 18 41 20 43
           C 22 41 24 37 24 32
           C 24 27 22 23 20 19 Z"
        stroke="hsl(var(--primary))"
        strokeWidth={stroke * 0.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppLogo({ size = "sm", showText = true }: AppLogoProps) {
  const cfg = SIZES[size];

  return (
    <div className={`flex flex-col items-center ${cfg.gap} select-none`}>
      {/* App-icon box: dark bg + glowing primary-color border */}
      <div
        style={{
          width: cfg.box,
          height: cfg.box,
          borderRadius: cfg.radius,
          background: "rgba(8, 8, 10, 0.92)",
          border: `${Math.max(1.5, cfg.stroke * 0.8)}px solid hsl(var(--primary))`,
          boxShadow: `
            0 0 ${cfg.blur}px hsl(var(--primary)),
            0 0 ${cfg.blur * 2}px hsl(var(--primary) / 0.45),
            inset 0 0 ${cfg.blur * 0.5}px hsl(var(--primary) / 0.08)
          `,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <FlameStroke size={cfg.box * 0.62} stroke={cfg.stroke} />
      </div>

      {/* Text below */}
      {showText && (
        <span
          className={`font-black uppercase text-white ${cfg.textCls}`}
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Expense Roaster
        </span>
      )}
    </div>
  );
}
