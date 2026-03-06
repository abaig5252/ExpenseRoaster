interface AppLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  showText?: boolean;
}

const PX = { xs: 48, sm: 60, md: 80, lg: 104 };

export function AppLogo({ size = "sm", showText = false }: AppLogoProps) {
  const px = PX[size];

  return (
    <div className="flex flex-col items-center select-none" style={{ position: "relative", width: px, height: px }}>
      {/* Outer layer — border rect + flame outline, pulses opacity */}
      <div className="logo-outer" style={{ position: "absolute", inset: 0 }}>
        <svg width={px} height={px} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
          {/* Rounded square */}
          <rect
            x="10" y="10" width="100" height="100" rx="22"
            fill="#121212" stroke="#00E676" strokeWidth="5"
          />
          {/* Flame outline */}
          <path
            d="M60 20 L45 45 C40 55 38 62 42 70 C44 74 38 72 36 68 C32 78 38 92 48 96 C44 90 46 84 50 80 C52 88 56 92 60 95 C64 92 68 88 70 80 C74 84 76 90 72 96 C82 92 88 78 84 68 C82 72 76 74 78 70 C82 62 80 55 75 45 L60 20 Z"
            fill="none"
            stroke="#00E676"
            strokeWidth="3"
            strokeLinejoin="miter"
          />
        </svg>
      </div>

      {/* Inner layer — solid teardrop, breathes scaleY */}
      <div className="logo-inner">
        <svg width={px} height={px} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M60 50 L52 70 C52 70 50 85 60 85 C70 85 68 70 68 70 L60 50 Z"
            fill="#00E676"
          />
        </svg>
      </div>

      {showText && (
        <span
          className="font-black uppercase text-white text-center whitespace-nowrap text-[11px] tracking-[0.18em]"
          style={{ fontFamily: "'DM Sans', sans-serif", marginTop: px + 4 }}
        >
          EXPENSE ROASTER
        </span>
      )}
    </div>
  );
}
