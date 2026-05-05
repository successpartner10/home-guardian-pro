import React from "react";
import { cn } from "@/lib/utils";

export const DrawerSection = ({ label, children, isLast = false }: { label: string; children: React.ReactNode; isLast?: boolean }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30 px-2 pt-2 pb-0.5">{label}</span>
    {children}
    {!isLast && <div className="h-px bg-white/5 mx-2 mt-1.5" />}
  </div>
);

export const DrawerBtn = ({
  icon, label, active, activeClass, onClick, onPointerDown, onPointerUp, onPointerLeave, disabled
}: any) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    onPointerDown={onPointerDown}
    onPointerUp={onPointerUp}
    onPointerLeave={onPointerLeave}
    disabled={disabled}
    className={cn(
      "w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-all",
      active
        ? (activeClass || "bg-primary/20 text-primary border border-primary/30")
        : "text-white/55 hover:bg-white/10 hover:text-white",
      disabled && "opacity-30 pointer-events-none"
    )}
  >
    <span className="shrink-0">{icon}</span>
    <span className="text-[10px] font-bold uppercase tracking-wide leading-tight">{label}</span>
  </button>
);
