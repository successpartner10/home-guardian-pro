import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";

export type ThemeType =
    | "dark-blue"
    | "dark-onyx"
    | "dark-slate"
    | "pastel"
    | "light-pure"
    | "light-cream";

interface ThemeContextType {
    theme: ThemeType;
    setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme] = useState<ThemeType>("dark-onyx");

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(...root.classList); // Clear all classes
        root.classList.add("dark", "dark-onyx");
    }, []);

    const setTheme = async () => {
        // No-op to disable theme switching
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};
