import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag } from "lucide-react";
import type { DetectedObject } from "@tensorflow-models/coco-ssd";

export const DETECTION_CATEGORIES = [
    { id: "all", label: "ALL", classes: null, color: "hsl(var(--primary))" },
    { id: "person", label: "PERSON", classes: ["person"], color: "#3b82f6" },
    { id: "pet", label: "PET", classes: ["cat", "dog", "bird", "horse", "sheep", "cow"], color: "#10b981" },
    { id: "vehicle", label: "VEHICLE", classes: ["car", "truck", "bus", "motorcycle", "bicycle"], color: "#f59e0b" },
    { id: "plant", label: "PLANT", classes: ["potted plant", "vase"], color: "#22c55e" },
    { id: "other", label: "OTHER", classes: "__other__" as any, color: "#a855f7" },
] as const;

export type CategoryId = typeof DETECTION_CATEGORIES[number]["id"];

export const getCategoryColor = (obj: DetectedObject, activeCategories: Set<CategoryId>): string => {
    for (const cat of DETECTION_CATEGORIES) {
        if (cat.id === "all" || cat.id === "other") continue;
        if (Array.isArray(cat.classes) && cat.classes.includes(obj.class)) return cat.color;
    }
    return "#a855f7";
};

export const filterObjects = (objects: DetectedObject[], activeCategories: Set<CategoryId>): DetectedObject[] => {
    if (activeCategories.has("all")) return objects;
    if (activeCategories.size === 0) return [];
    const knownClasses = DETECTION_CATEGORIES.flatMap(c => (Array.isArray(c.classes) ? c.classes : []));
    return objects.filter(obj => {
        for (const catId of activeCategories) {
            const cat = DETECTION_CATEGORIES.find(c => c.id === catId);
            if (!cat) continue;
            if (catId === "other" && !knownClasses.includes(obj.class)) return true;
            if (Array.isArray(cat.classes) && cat.classes.includes(obj.class)) return true;
        }
        return false;
    });
};

export const countByCategory = (objects: DetectedObject[], catId: CategoryId): number => {
    if (catId === "all") return objects.length;
    const cat = DETECTION_CATEGORIES.find(c => c.id === catId);
    if (!cat) return 0;
    if (catId === "other") {
        const knownClasses = DETECTION_CATEGORIES.flatMap(c => (Array.isArray(c.classes) ? c.classes : []));
        return objects.filter(o => !knownClasses.includes(o.class)).length;
    }
    if (!Array.isArray(cat.classes)) return 0;
    return objects.filter(o => cat.classes!.includes(o.class)).length;
};

export const RadarOverlay = React.memo(({ detectedObjects, videoWidth, videoHeight }: { detectedObjects: DetectedObject[], videoWidth: number, videoHeight: number }) => {
    return (
        <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center opacity-40">
            <div className="relative h-[280px] w-[280px]">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border border-primary/20"
                >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1/2 w-1 bg-gradient-to-t from-primary/60 via-primary/10 to-transparent origin-bottom" />
                </motion.div>

                <div className="absolute inset-[40px] rounded-full border border-primary/10" />
                <div className="absolute inset-[80px] rounded-full border border-primary/10" />

                {/* AI Object Markers on Radar */}
                {detectedObjects.map((obj, i) => (
                    <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute h-6 w-6 bg-primary rounded-full shadow-[0_0_20px_hsl(var(--primary))] flex items-center justify-center"
                        style={{
                            left: `${(obj.bbox[0] / (videoWidth || 640)) * 100}%`,
                            top: `${(obj.bbox[1] / (videoHeight || 480)) * 100}%`
                        }}
                    >
                        <div className="text-[8px] font-black text-primary-foreground uppercase mt-8 text-center w-max whitespace-nowrap">{obj.class}</div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
});

export const BoundingBoxesOverlay = React.memo(({
    detectedObjects,
    filteredObjects,
    activeCategories
}: {
    detectedObjects: DetectedObject[],
    filteredObjects: DetectedObject[],
    activeCategories: Set<CategoryId>
}) => {
    const isSpotlightActive = !activeCategories.has("all") && filteredObjects.length > 0;

    return (
        <>
            <AnimatePresence>
                {isSpotlightActive && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[15] pointer-events-none"
                        style={{ background: 'rgba(0,0,0,0.55)' }}
                    >
                        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <mask id="spotlight-mask">
                                    <rect width="100%" height="100%" fill="white" />
                                    {filteredObjects.map((obj, i) => (
                                        <rect
                                            key={`mask-${i}`}
                                            x={`${(obj.bbox[0] / 320) * 100}%`}
                                            y={`${(obj.bbox[1] / 240) * 100}%`}
                                            width={`${(obj.bbox[2] / 320) * 100}%`}
                                            height={`${(obj.bbox[3] / 240) * 100}%`}
                                            rx="12"
                                            fill="black"
                                        />
                                    ))}
                                </mask>
                            </defs>
                            <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#spotlight-mask)" />
                        </svg>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {detectedObjects.map((obj, i) => {
                    const isFiltered = filteredObjects.some(f => f === obj);
                    const color = getCategoryColor(obj, activeCategories);

                    const opacity = isFiltered ? 1 : 0.25;
                    const scale = isFiltered ? 1 : 0.95;

                    return (
                        <motion.div
                            key={`bbox-${i}-${obj.class}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity, scale }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute z-20 pointer-events-none"
                            style={{
                                left: `${(obj.bbox[0] / 320) * 100}%`,
                                top: `${(obj.bbox[1] / 240) * 100}%`,
                                width: `${(obj.bbox[2] / 320) * 100}%`,
                                height: `${(obj.bbox[3] / 240) * 100}%`,
                            }}
                        >
                            <div className="absolute inset-0">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t border-l rounded-tl-md" style={{ borderColor: color }} />
                                <div className="absolute top-0 right-0 w-4 h-4 border-t border-r rounded-tr-md" style={{ borderColor: color }} />
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l rounded-bl-md" style={{ borderColor: color }} />
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r rounded-br-md" style={{ borderColor: color }} />
                            </div>

                            {isFiltered && (
                                <div className="absolute inset-0 rounded-lg opacity-20" style={{ boxShadow: `0 0 15px ${color}, inset 0 0 10px ${color}` }} />
                            )}

                            {isFiltered && (
                                <div
                                    className="absolute -top-5 left-0 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-tighter text-white/90 backdrop-blur-md border border-white/5 shadow-2xl flex items-center gap-1"
                                    style={{ backgroundColor: `${color}44` }}
                                >
                                    <Tag className="h-2 w-2 opacity-60" />
                                    {obj.class}
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </>
    );
});
