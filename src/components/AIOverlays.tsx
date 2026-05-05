import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface AIOverlaysProps {
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  isMonitoring: boolean;
  analysis: any;
  isThermal?: boolean;
}

interface LogEntry {
  id: string;
  time: string;
  label: string;
  color: string;
}

// Generate consistent high-contrast colors following the reference palette
const getColorForLabel = (label: string | undefined, index: number): string => {
  const palette = [
    '#ef4444', // red
    '#3b82f6', // blue
    '#22c55e', // green
    '#eab308', // yellow
    '#a855f7', // purple
    '#f97316', // orange
    '#06b6d4', // cyan
  ];
  if (!label) return palette[(index % (palette.length - 1)) + 1];
  
  const upper = label.toUpperCase();
  if (upper.includes('PERSON')) return palette[0];
  if (upper.includes('CHAIR')) return palette[1];
  if (upper.includes('BANANA')) return palette[3];
  if (upper.includes('BOOK')) return palette[6];
  if (upper.includes('COUCH')) return palette[2];
  return palette[(index % (palette.length - 1)) + 1];
};

export const AIOverlays = ({ isMonitoring, analysis, isThermal = false }: AIOverlaysProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const objects = analysis?.detected_objects || [];

  useEffect(() => {
    if (objects.length > 0) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + Math.floor(now.getMilliseconds() / 100);
      
      const newLogs = objects.map((obj: any, idx: number) => ({
        id: Math.random().toString(36).substr(2, 9),
        time: timeStr,
        label: obj.label,
        color: getColorForLabel(obj.label, idx)
      }));

      setLogs(prev => [...prev, ...newLogs].slice(-25)); // Keep last 25 for the scrolling log
    }
  }, [analysis]);

  if (!isMonitoring) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden font-mono text-[9px] sm:text-[10px]">
      {/* Thermal Filter Definition */}
      <svg className="absolute w-0 h-0 invisible">
        <filter id="hguard-thermal-reconstruction">
          {/* Grayscale first */}
          <feColorMatrix type="saturate" values="0" />
          {/* Map intensity to colors: 0 (cold) to 1 (hot) */}
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.1 0 0.5 1 1" />
            <feFuncG type="table" tableValues="0 0.1 0 0.8 1" />
            <feFuncB type="table" tableValues="0.5 0.8 0.2 0 0.8" />
          </feComponentTransfer>
          {/* Add a thermal bloom/blur */}
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>

      <div 
        className={cn(
          "absolute inset-0 transition-opacity duration-1000",
          isThermal ? "opacity-100 backdrop-blur-[1px]" : "opacity-0"
        )}
        style={{ filter: isThermal ? "url(#hguard-thermal-reconstruction) contrast(1.4) brightness(1.1)" : "none" }}
      />
      
      {/* 1. Viewport Bounding Boxes */}
      {objects.map((obj: any, idx: number) => {
        if (!obj.box_2d) return null;
        const [ymin, xmin, ymax, xmax] = obj.box_2d;
        const color = getColorForLabel(obj.label, idx);
        
        return (
          <motion.div
            key={`box-${idx}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute border-[1.5px]"
            style={{
              left: `${xmin / 10}%`,
              top: `${ymin / 10}%`,
              width: `${(xmax - xmin) / 10}%`,
              height: `${(ymax - ymin) / 10}%`,
              borderColor: color,
            }}
          >
            {/* Box Label Tag */}
            <div 
              className="absolute -top-[14px] left-[-1.5px] px-1 py-[1.5px] text-[7px] font-black uppercase text-[#111827] flex items-center gap-2 border-[1.5px]"
              style={{ backgroundColor: color, borderColor: color }}
            >
              <span>{obj.label}</span>
              <span>{Math.round((obj.confidence || 0) * 100)}</span>
            </div>
          </motion.div>
        );
      })}

    </div>
  );
};
