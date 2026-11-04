import { useEffect, useState } from "react";

const getInitialTheme = () => {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
        return "dark";
    }
    return "light";
};

const useTheme = () => {
    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

    return { theme, toggleTheme };
};

export default useTheme;
