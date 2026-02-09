import { cn } from "../../lib/utils";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

export const CardContainer = ({ children, className, containerClassName }) => {
    const containerRef = useRef(null);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], ["7.5deg", "-7.5deg"]));
    const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], ["-7.5deg", "7.5deg"]));

    const handleMouseMove = (e) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseXPos = e.clientX - rect.left;
        const mouseYPos = e.clientY - rect.top;
        const xPct = mouseXPos / width - 0.5;
        const yPct = mouseYPos / height - 0.5;
        mouseX.set(xPct);
        mouseY.set(yPct);
    };

    const handleMouseLeave = () => {
        mouseX.set(0);
        mouseY.set(0);
    };

    return (
        <motion.div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
            className={cn("relative", containerClassName)}
        >
            <div
                style={{
                    transformStyle: "preserve-3d",
                }}
                className={cn("relative", className)}
            >
                {children}
            </div>
        </motion.div>
    );
};

export const CardBody = ({ children, className }) => {
    return (
        <div
            className={cn("h-full w-full", className)}
            style={{
                transformStyle: "preserve-3d",
            }}
        >
            {children}
        </div>
    );
};

export const CardItem = ({ children, className, translateZ = 0 }) => {
    return (
        <div
            style={{
                transform: `translateZ(${translateZ}px)`,
            }}
            className={cn("", className)}
        >
            {children}
        </div>
    );
};
