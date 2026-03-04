interface AppLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  showText?: boolean;
}

const PX = { xs: 60, sm: 80, md: 104, lg: 132 }; 

const TEXT = {
  xs: "text-[12px] tracking-[0.18em]",
  sm: "text-[15px] tracking-[0.18em]",
  md: "text-[18px] tracking-[0.18em]",
  lg: "text-[22px] tracking-[0.18em]",
};

const GAP = { xs: "gap-1", sm: "gap-1", md: "gap-1.5", lg: "gap-2" };

function FlameSVG({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className="flame-svg"
      aria-hidden="true"
    >
      <rect x="10" y="10" width="100" height="100" rx="20" className="logo-border" />
      
      <g className="burning-animation">
        <path d="M60 22 L72 45 L80 70 C80 90 40 90 40 70 L48 45 L60 22Z" className="flame-main" />
        
        <path d="M75 50 L92 28 L82 62" className="flame-flick" />
        
        <path d="M45 55 L28 35 L38 68" className="flame-flick" />
        
        <path d="M60 55 L52 78 L60 86 L68 78 L60 55Z" className="flame-core" />
      </g>
    </svg>
  );
}

export function AppLogo({ size = "sm", showText = true }: AppLogoProps) {
  const px = PX[size];

  return (
    <div className={`flex flex-col items-center ${GAP[size]} select-none`}> 
      <div className="brand-container"> 
        <div className="logo-box"> 
          <FlameSVG px={px} /> 
        </div> 
      </div> 
      {showText && ( 
        <div className="brand-text"> 
          <span 
            className={`font-black uppercase text-white text-center whitespace-nowrap ${TEXT[size]}`} 
            style={{ fontFamily: "'DM Sans', sans-serif" }} 
          > 
            EXPENSE 
          </span> 
          <span 
            className={`font-black uppercase text-white text-center whitespace-nowrap ${TEXT[size]}`} 
            style={{ fontFamily: "'DM Sans', sans-serif" }} 
          > 
            ROASTER 
          </span> 
        </div> 
      )} 
    </div> 
  );
}