import { useEffect, useRef, useState } from "react";

const useTemporaryPasswordReveal = (durationMs = 3000) => {
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef(null);

    useEffect(() => () => clearTimeout(timeoutRef.current), []);

    const toggle = () => {
        clearTimeout(timeoutRef.current);
        setVisible((prev) => {
            const next = !prev;
            if (next) {
                timeoutRef.current = setTimeout(() => setVisible(false), durationMs);
            }
            return next;
        });
    };

    return [visible, toggle];
};

export default useTemporaryPasswordReveal;
