import { cn } from "../../lib/utils";

export const BackgroundGradient = ({
    children,
    className,
    containerClassName,
    animate = true,
}) => {
    return (
        <div className={cn("relative p-[4px] group", containerClassName)}>
            <div
                className={cn(
                    "absolute inset-0 rounded-3xl z-[1] opacity-60 group-hover:opacity-100 blur-xl transition duration-500 will-change-transform",
                    " bg-[radial-gradient(circle_farthest-side_at_0_100%,#00ccb1,transparent),radial-gradient(circle_farthest-side_at_100%_0,#7b61ff,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#ffc414,transparent),radial-gradient(circle_farthest-side_at_0_0,#1ca0fb,#141316)]"
                )}
                style={{
                    backgroundSize: "400% 400%",
                    animation: animate ? "gradient-animation 10s ease infinite" : undefined,
                }}
            />
            <div
                className={cn(
                    "relative z-10 rounded-3xl h-full",
                    className
                )}
            >
                {children}
            </div>
            <style>{`
                @keyframes gradient-animation {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}</style>
        </div>
    );
};
