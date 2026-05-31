import React from 'react';
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export const Logo: React.FC<LogoProps> = ({ className, size = "md" }) => {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
    xl: "h-20 w-20"
  };

  return (
    <div className={cn("relative flex items-center justify-center select-none group focus:outline-none transition-transform duration-700 group-hover:scale-110", sizes[size], className)}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_4px_16px_rgba(99,102,241,0.5)]"
        aria-label="HGUARD Elite Logo"
      >
        <defs>
          <radialGradient id="shieldGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#4f46e5" />
          </radialGradient>
          <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0.7" />
          </radialGradient>
          <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Shield body */}
        <path
          d="M32 4 L54 14 L54 34 C54 46 43 56 32 60 C21 56 10 46 10 34 L10 14 Z"
          fill="url(#shieldGrad)"
          filter="url(#logoGlow)"
        />

        {/* Shield inner border ring */}
        <path
          d="M32 8 L51 17 L51 34 C51 44.5 41.5 53.5 32 57 C22.5 53.5 13 44.5 13 34 L13 17 Z"
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />

        {/* Camera lens circle */}
        <circle cx="32" cy="32" r="11" fill="url(#coreGrad)" filter="url(#logoGlow)" />
        <circle cx="32" cy="32" r="7" fill="#312e81" />
        <circle cx="32" cy="32" r="4" fill="#4338ca" />
        <circle cx="29.5" cy="29.5" r="1.5" fill="rgba(255,255,255,0.7)" />

        {/* Scanning arc lines */}
        <path d="M20 32 A12 12 0 0 1 26 21" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M44 32 A12 12 0 0 0 38 21" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round" />

        {/* Corner targeting brackets */}
        <path d="M22 22 H26 V26 M42 22 H38 V26 M22 42 H26 V38 M42 42 H38 V38" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
};
