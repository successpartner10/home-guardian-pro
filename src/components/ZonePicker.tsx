import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, X, Move, Maximize } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface ZonePickerProps {
    onConfirm: (zone: { x: number; y: number; width: number; height: number } | null) => void;
    onCancel: () => void;
    initialZone?: { x: number; y: number; width: number; height: number } | null;
}

export const ZonePicker = ({ onConfirm, onCancel, initialZone }: ZonePickerProps) => {
    const [zone, setZone] = useState(initialZone || { x: 40, y: 30, width: 240, height: 180 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handlePointerDown = (e: React.PointerEvent, type: 'drag' | 'resize') => {
        e.stopPropagation();
        if (type === 'drag') setIsDragging(true);
        else setIsResizing(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging && !isResizing) return;
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (isDragging) {
            setZone(prev => ({
                ...prev,
                x: Math.max(0, Math.min(rect.width - prev.width, x - prev.width / 2)),
                y: Math.max(0, Math.min(rect.height - prev.height, y - prev.height / 2))
            }));
        } else if (isResizing) {
            setZone(prev => ({
                ...prev,
                width: Math.max(50, Math.min(rect.width - prev.x, x - prev.x)),
                height: Math.max(50, Math.min(rect.height - prev.y, y - prev.y))
            }));
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        setIsResizing(false);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="mb-6 text-center space-y-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Set Detection Zone</h2>
                <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Only detect motion inside the box</p>
            </div>

            <div
                ref={containerRef}
                className="relative aspect-video w-full max-w-2xl bg-black/20 rounded-3xl border-2 border-white/10 overflow-hidden shadow-2xl"
                onPointerMove={handlePointerMove}
            >
                {/* The Draggable Zone Box */}
                <div
                    style={{
                        left: `${(zone.x / (containerRef.current?.clientWidth || 320)) * 100}%`,
                        top: `${(zone.y / (containerRef.current?.clientHeight || 240)) * 100}%`,
                        width: `${(zone.width / (containerRef.current?.clientWidth || 320)) * 100}%`,
                        height: `${(zone.height / (containerRef.current?.clientHeight || 240)) * 100}%`,
                    }}
                    className="absolute border-4 border-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.5)] bg-primary/10 group rounded-lg"
                >
                    {/* Drag Handle */}
                    <div
                        className="absolute inset-0 cursor-move flex items-center justify-center"
                        onPointerDown={(e) => handlePointerDown(e, 'drag')}
                        onPointerUp={handlePointerUp}
                    >
                        <Move className="text-white/40 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Resize Handle */}
                    <div
                        className="absolute bottom-0 right-0 w-12 h-12 cursor-nwse-resize flex items-end justify-end p-1"
                        onPointerDown={(e) => handlePointerDown(e, 'resize')}
                        onPointerUp={handlePointerUp}
                    >
                        <div className="bg-primary w-6 h-6 rounded-tl-xl flex items-center justify-center">
                            <Maximize className="w-3 h-3 text-white" />
                        </div>
                    </div>

                    {/* Label */}
                    <div className="absolute top-0 left-0 bg-primary text-white text-[10px] font-black uppercase px-3 py-1 rounded-br-lg shadow-lg">
                        Focus Zone
                    </div>
                </div>
            </div>

            <div className="mt-8 flex gap-4 w-full max-w-sm">
                <Button
                    variant="outline"
                    className="flex-1 h-14 rounded-2xl border-2 border-white/10 bg-white/5 text-white font-black uppercase tracking-widest hover:bg-white/10"
                    onClick={onCancel}
                >
                    <X className="mr-2 h-5 w-5" /> Cancel
                </Button>
                <Button
                    className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                    onClick={() => onConfirm(zone)}
                >
                    <Check className="mr-2 h-5 w-5" /> Save Zone
                </Button>
            </div>

            <Button
                variant="ghost"
                className="mt-4 text-xs font-bold text-primary/60 hover:text-primary uppercase tracking-widest"
                onClick={() => onConfirm(null)}
            >
                Reset to Full Screen
            </Button>
        </div>
    );
};
