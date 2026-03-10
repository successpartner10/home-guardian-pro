import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    const [theme, setThemeState] = useState<ThemeType>(() => {
        return (localStorage.getItem("app-theme") as ThemeType) || "dark-blue";
    });

    // Sync theme with Supabase metadata on mount
    useEffect(() => {
        async function syncTheme() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata?.theme) {
                const cloudTheme = user.user_metadata.theme as ThemeType;
                if (cloudTheme !== theme) {
                    setThemeState(cloudTheme);
                    localStorage.setItem("app-theme", cloudTheme);
                }
            }
        }
        syncTheme();
    }, []);

    const setTheme = async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        localStorage.setItem("app-theme", newTheme);

        // Save to Supabase metadata if logged in
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.auth.updateUser({
                data: { theme: newTheme }
            });
        }
    };

    useEffect(() => {
        const root = window.document.documentElement;
        // Remove all possible theme classes
        root.classList.remove(
            "dark-blue", "dark-onyx", "dark-slate",
            "pastel", "light-pure", "light-cream"
        );
        // Add new theme class
        root.classList.add(theme);

        // Also toggle standard 'dark' class for shadcn/components compatibility
        if (theme.startsWith("dark")) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, [theme]);

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
