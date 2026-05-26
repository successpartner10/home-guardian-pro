import React from 'react';
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export const Logo: React.FC<LogoProps> = ({ className, size = "md" }) => {
  const sizes = {
    sm: "h-12 w-12",
    md: "h-20 w-20",
    lg: "h-32 w-32",
    xl: "h-64 w-64"
  };

  return (
    <div className={cn("relative flex items-center justify-center select-none group focus:outline-none", className)}>
      <img 
        src={`/hguard_elite_logo.png?t=${new Date().getTime()}`}
        alt="HGUARD home security" 
        className={cn("object-contain transition-all duration-700 group-hover:scale-110 drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]", sizes[size])}
        draggable={false}
      />
    </div>
  );
};
