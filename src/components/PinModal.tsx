import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Delete, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface PinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    correctPin: string;
    title?: string;
}

const PinModal = ({ isOpen, onClose, onSuccess, correctPin, title = "Security Verification" }: PinModalProps) => {
    const [pin, setPin] = useState("");
    const [error, setError] = useState(false);

    useEffect(() => {
        if (pin.length === correctPin.length && pin.length > 0) {
            if (pin === correctPin) {
                setPin(""); // Clear first to prevent re-trigger
                onSuccess();
            } else {
                setError(true);
                setTimeout(() => {
                    setError(false);
                    setPin("");
                }, 800);
            }
        }
    }, [pin, correctPin, onSuccess]);

    if (!isOpen) return null;

    const handleKeyPress = (num: string) => {
        if (pin.length < correctPin.length) {
            setPin(prev => prev + num);
        }
    };

    const handleBackspace = () => {
        setPin(prev => prev.slice(0, -1));
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-safe">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{
                            scale: 1,
                            opacity: 1,
                            y: 0,
                            x: error ? [0, -10, 10, -10, 10, 0] : 0
                        }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-sm bg-card border-2 border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-2xl"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-white/40"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="text-center space-y-2">
                            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-2">
                                <ShieldAlert className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tight">{title}</h2>
                            <p className="text-sm font-bold opacity-40 uppercase tracking-widest">Enter Security PIN to continue</p>
                        </div>

                        <div className="flex justify-center gap-4">
                            {Array.from({ length: correctPin.length }).map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "w-4 h-4 rounded-full border-2 transition-all duration-300",
                                        i < pin.length ? "bg-primary border-primary scale-125" : "border-white/20",
                                        error && "bg-destructive border-destructive"
                                    )}
                                />
                            ))}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <button
                                    key={num}
                                    onClick={() => handleKeyPress(num.toString())}
                                    className="h-16 rounded-2xl bg-white/5 border border-white/5 text-2xl font-black hover:bg-white/10 active:scale-90 transition-all"
                                >
                                    {num}
                                </button>
                            ))}
                            <div />
                            <button
                                onClick={() => handleKeyPress("0")}
                                className="h-16 rounded-2xl bg-white/5 border border-white/5 text-2xl font-black hover:bg-white/10 active:scale-90 transition-all"
                            >
                                0
                            </button>
                            <button
                                onClick={handleBackspace}
                                className="h-16 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-colors"
                            >
                                <Delete className="w-8 h-8" />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default PinModal;
