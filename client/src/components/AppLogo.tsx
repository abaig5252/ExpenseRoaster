interface AppLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  showText?: boolean;
}

const NEON = "#7FFF00";

const SIZES = {
  xs: { box: 40,  stroke: 1.8, radius: 11, blur: 12, spread: 20, textCls: "text-[10px] tracking-[0.2em]",  gap: "gap-2"   },
  sm: { box: 54,  stroke: 2.2, radius: 14, blur: 16, spread: 28, textCls: "text-[12px] tracking-[0.2em]",  gap: "gap-2.5" },
  md: { box: 76,  stroke: 2.8, radius: 20, blur: 22, spread: 38, textCls: "text-sm tracking-[0.2em]",      gap: "gap-3"   },
  lg: { box: 100, stroke: 3.2, radius: 26, blur: 28, spread: 50, textCls: "text-base tracking-[0.2em]",    gap: "gap-3.5" },
};

/*
  Flame SVG paths — viewBox "0 0 60 74"

  Outer flame (double-peaked, clockwise from left peak):
    - Left peak tip: (18, 3) ← taller
    - Valley between peaks: (28, 20)
    - Right peak: (34, 5) ← shorter/rounder
    - Wide body below, rounded base center ~(30, 71)

  Inner flame (smaller double-peaked, centered inside body):
    - Left inner bump: (25, 29)
    - Right inner bump: (35, 34)
    - Inner base: (30, 62)
*/

function FlameSVG({ stroke }: { stroke: number }) {
  const s = stroke;
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 60 74"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* ── Outer flame ── */}
      <path
        d={`
          M 18 3
          C 14 9 9 18 9 28
          C 9 38 11 49 16 58
          C 20 64 25 70 30 71
          C 35 70 40 64 44 58
          C 49 49 51 38 51 28
          C 51 18 46 9 40 8
          C 38 4 35 4 33 8
          C 32 12 30 17 28 20
          C 26 16 23 9 18 3
          Z
        `}
        stroke={NEON}
        strokeWidth={s}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Inner flame ── */}
      <path
        d={`
          M 25 30
          C 24 34 22 39 22 45
          C 22 52 25 58 30 62
          C 35 58 38 52 38 45
          C 38 39 36 34 38 30
          C 36 26 33 25 31 28
          C 30 26 28 26 25 30
          Z
        `}
        stroke={NEON}
        strokeWidth={s * 0.8}
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
      {/*
        App-icon square:
        - Very dark background (near-black, slight warm tint)
        - Thick neon-green glowing border
        - Glow spreads outward via multi-layer box-shadow
      */}
      <div
        style={{
          width: cfg.box,
          height: cfg.box,
          borderRadius: cfg.radius,
          background: "linear-gradient(145deg, #111210 0%, #0a0b09 60%, #0d0e0c 100%)",
          border: `${Math.round(cfg.stroke)}px solid ${NEON}`,
          boxShadow: `
            0 0 ${cfg.blur * 0.6}px ${NEON},
            0 0 ${cfg.blur}px ${NEON},
            0 0 ${cfg.spread}px ${NEON}99,
            0 0 ${cfg.spread * 1.6}px ${NEON}44,
            inset 0 0 ${cfg.blur * 0.3}px ${NEON}18
          `,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `${Math.round(cfg.box * 0.13)}px`,
          flexShrink: 0,
        }}
      >
        <FlameSVG stroke={cfg.stroke} />
      </div>

      {/* "EXPENSE ROASTER" — white bold uppercase, centered below box */}
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
