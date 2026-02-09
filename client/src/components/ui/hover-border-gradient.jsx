import { cn } from "../../lib/utils";
import { motion } from "framer-motion";

export const HoverBorderGradient = ({
    children,
    containerClassName,
    className,
    as: Tag = "button",
    duration = 1,
    ...props
}) => {
    return (
        <Tag
            className={cn(
                "relative p-[2px] rounded-xl overflow-hidden group",
                containerClassName
            )}
            {...props}
        >
            <motion.div
                className="absolute inset-0 z-0 rounded-xl"
                style={{
                    background: "linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #06b6d4)",
                    backgroundSize: "400% 100%",
                }}
                animate={{
                    backgroundPosition: ["0% 0%", "400% 0%"],
                }}
                transition={{
                    duration: duration * 4,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />
            <div
                className={cn(
                    "relative z-10 rounded-xl bg-slate-950 backdrop-blur-xl",
                    className
                )}
            >
                {children}
            </div>
        </Tag>
    );
};
