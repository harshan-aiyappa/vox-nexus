import { cn } from "../../lib/utils";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

const springConfig = { damping: 20, stiffness: 150, mass: 0.5 };

export const CardContainer = ({ children, className, containerClassName }) => {
    const containerRef = useRef(null);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], ["10deg", "-10deg"]), springConfig);
    const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], ["-10deg", "10deg"]), springConfig);

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
                willChange: "transform"
            }}
            className={cn("relative group/card", containerClassName)}
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

export const CardItem = ({ children, className, translateZ = 0, ...props }) => {
    return (
        <div
            style={{
                transform: `translateZ(${translateZ}px)`,
                transformStyle: "preserve-3d",
            }}
            className={cn("transition-transform duration-200 ease-out", className)}
            {...props}
        >
            {children}
        </div>
    );
};
