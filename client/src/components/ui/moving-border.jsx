import { cn } from "../../lib/utils";
import { motion } from "framer-motion";

export const MovingBorder = ({
    children,
    duration = 2000,
    className,
    containerClassName,
    borderClassName,
    as: Component = "button",
    ...otherProps
}) => {
    return (
        <Component
            className={cn(
                "relative text-xl p-[1px] overflow-hidden",
                containerClassName
            )}
            {...otherProps}
        >
            <div
                className="absolute inset-0"
                style={{ padding: "1px" }}
            >
                <motion.div
                    className={cn(
                        "h-full w-full",
                        borderClassName
                    )}
                    style={{
                        background: `linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6, #06b6d4)`,
                        backgroundSize: "200% 100%",
                    }}
                    animate={{
                        backgroundPosition: ["0% 0%", "200% 0%"],
                    }}
                    transition={{
                        duration: duration / 1000,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                />
            </div>
            <div
                className={cn(
                    "relative bg-slate-900 backdrop-blur-xl z-10",
                    className
                )}
            >
                {children}
            </div>
        </Component>
    );
};
