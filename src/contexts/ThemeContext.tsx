import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { useAppSelector, useAppDispatch } from "../hooks/redux";
import { setTheme } from "../store/slices/settingsSlice";

export interface Theme {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  text: string;
  textSecondary: string;
  border: string;
  card: string;
  error: string;
  success: string;
  warning: string;
}

export const lightTheme: Theme = {
  background: "#FFFFFF",
  surface: "#F2F2F7",
  primary: "#007AFF",
  secondary: "#5856D6",
  text: "#000000",
  textSecondary: "#8E8E93",
  border: "#C6C6C8",
  card: "#FFFFFF",
  error: "#FF3B30",
  success: "#34C759",
  warning: "#FF9500",
};

export const darkTheme: Theme = {
  background: "#000000",
  surface: "#1C1C1E",
  primary: "#007AFF",
  secondary: "#5856D6",
  text: "#FFFFFF",
  textSecondary: "#8E8E93",
  border: "#38383A",
  card: "#1C1C1E",
  error: "#FF453A",
  success: "#30D158",
  warning: "#FF9F0A",
};

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  themeMode: "light" | "dark" | "system";
  setThemeMode: (mode: "light" | "dark" | "system") => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((state) => state.settings.theme);
  const systemColorScheme = useColorScheme();

  const [currentTheme, setCurrentTheme] = useState<Theme>(darkTheme);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    let shouldUseDark = false;

    switch (themeMode) {
      case "light":
        shouldUseDark = false;
        break;
      case "dark":
        shouldUseDark = true;
        break;
      case "system":
        shouldUseDark = systemColorScheme === "dark";
        break;
    }

    setIsDarkMode(shouldUseDark);
    setCurrentTheme(shouldUseDark ? darkTheme : lightTheme);
  }, [themeMode, systemColorScheme]);

  const setThemeMode = (mode: "light" | "dark" | "system") => {
    dispatch(setTheme(mode));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        isDarkMode,
        themeMode,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
