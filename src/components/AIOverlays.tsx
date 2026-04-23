import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface AIOverlaysProps {
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  isMonitoring: boolean;
  analysis: any;
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

export const AIOverlays = ({ isMonitoring, analysis }: AIOverlaysProps) => {
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

      {/* If we have analysis, show the complex HUD */}
      {analysis && (
        <>
          {/* Light Theme Sidebar HUD - Hidden on small mobile, collapsible on larger mobile */}
          <div className="absolute top-0 left-0 w-32 sm:w-48 h-full bg-[#fcfcfc]/95 backdrop-blur-md border-r border-[#e5e7eb] text-[#111827] flex flex-col pointer-events-none overflow-y-auto shadow-2xl transition-transform duration-500 -translate-x-full sm:translate-x-0 group-hover:translate-x-0">
            
            {/* Header / Config */}
            <div className="p-3 border-b border-[#e5e7eb] flex flex-col gap-2">
              <div className="flex gap-1.5 opacity-60">
                 <div className="h-3 w-4 border-[1.5px] border-[#111827] rounded-sm flex items-center justify-center">
                    <div className="h-1 w-1.5 bg-[#111827]" />
                 </div>
                 <div className="h-3 w-4 border-[1.5px] border-[#111827] rounded-sm flex items-center justify-center">
                    <div className="h-[2px] w-2 bg-[#111827]" />
                 </div>
                 <div className="h-3 w-3 border-[1.5px] border-[#111827] flex items-center justify-center">
                    <div className="h-1 w-1 bg-[#111827]" />
                 </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                 <span className="text-[7px] text-[#9ca3af] uppercase font-bold tracking-widest whitespace-nowrap">Conf. Threshold</span>
                 <div className="flex-1 h-1 bg-[#e5e7eb] rounded-full overflow-hidden">
                    <div className="h-full bg-[#a855f7] w-[60%]" />
                 </div>
                 <span className="text-[8px] font-bold text-[#a855f7]">0.60</span>
              </div>
              <div className="text-[7px] text-[#d1d5db] font-bold tracking-widest mt-1 border-b border-dashed border-[#e5e7eb] pb-1 inline-block text-left w-20">
                filter labels
              </div>
            </div>

            {/* Objects Section */}
            <div className="p-3 border-b border-[#e5e7eb]">
              <div className="text-[8px] font-bold text-[#6b7280] uppercase tracking-widest mb-1">Objects</div>
              <div className="text-3xl font-black text-[#f97316] leading-none mb-3">{objects.length}</div>
              
              <div className="space-y-1.5">
                {objects.map((obj: any, idx: number) => {
                  const color = getColorForLabel(obj.label, idx);
                  const conf = Math.round((obj.confidence || 0) * 100);
                  return (
                    <div key={`list-${idx}`} className="flex items-center gap-2 text-[7px] uppercase font-bold">
                       <span className="w-12 truncate text-[#4b5563] text-left">{obj.label}</span>
                       <div className="flex-1 h-1.5 bg-[#e5e7eb] rounded-sm overflow-hidden flex">
                         <div className="h-full" style={{ width: `${conf}%`, backgroundColor: color }} />
                       </div>
                       <span className="w-4 text-right text-[#4b5563]">{conf}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Heat Map Section */}
            <div className="p-3 border-b border-[#e5e7eb]">
              <div className="text-[8px] font-bold text-[#6b7280] uppercase tracking-widest mb-2">Heat Map</div>
              <div className="grid grid-cols-12 gap-[1px] bg-[#111827] p-[1.5px] max-w-fit rounded-sm shadow-inner">
                {Array.from({ length: 96 }).map((_, i) => {
                  const col = i % 12;
                  const row = Math.floor(i / 12);
                  // Generate Tetris-like clusters
                  const isRed = (col > 8 && row > 1 && row < 6);
                  const isYellow = (col > 2 && col < 5 && row > 3 && row < 7);
                  const isCyan = (col < 2 && row > 3 && row < 6) || (col === 2 && row === 4);
                  
                  // Pulse active blocks slightly if motion exists
                  const isActive = (isRed || isYellow || isCyan) && analysis?.motion_level > 0.1;
                  
                  let color = '#111827';
                  if (isActive) {
                    if (isRed) color = '#ef4444';
                    else if (isYellow) color = '#eab308';
                    else if (isCyan) color = '#06b6d4';
                  }

                  return <div key={`hm-${i}`} className="w-2.5 h-2.5 border-[0.5px] border-[#1f2937]" style={{ backgroundColor: color }} />
                })}
              </div>
            </div>

            {/* Models Section */}
            <div className="p-3 border-b border-[#e5e7eb] text-[8px] space-y-2">
              <div className="text-[#6b7280] font-bold uppercase tracking-widest mb-1">Models</div>
              <div className="flex justify-between font-bold text-[#4b5563]"><span>GEMMA 4</span> <span className="text-[#ef4444]">PRO</span></div>
              <div className="flex justify-between font-bold text-[#4b5563]"><span>RT-DETR</span> <span>ON</span></div>
              <div className="flex justify-between font-bold text-[#4b5563] mt-2 pt-2"><span>FPS</span> <span>30</span></div>
            </div>

            {/* Log Section */}
            <div className="p-3 flex-1 flex flex-col overflow-hidden">
               <div className="text-[8px] font-bold text-[#6b7280] uppercase tracking-widest mb-2">Log</div>
               <div className="flex-1 overflow-y-auto space-y-1 text-[7px] uppercase font-bold pr-1">
                  {[...logs].reverse().map((log) => (
                     <div key={log.id} className="flex gap-2">
                        <span className="text-[#9ca3af] whitespace-nowrap">{log.time} {'>'}</span>
                        <span style={{ color: log.color }}>{log.label}</span>
                     </div>
                  ))}
                </div>
             </div>
           </div>
        </>
      )}
    </div>
  );
};
