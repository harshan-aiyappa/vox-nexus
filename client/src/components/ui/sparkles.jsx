import { cn } from "../../lib/utils";

export const SparklesCore = ({
    id,
    background,
    minSize,
    maxSize,
    particleDensity,
    className,
    particleColor,
}) => {
    return (
        <div className={cn("relative w-full h-full", className)}>
            <svg className="absolute inset-0 w-full h-full">
                <defs>
                    <radialGradient id={`gradient-${id}`}>
                        <stop offset="0%" stopColor={particleColor || "#06b6d4"} stopOpacity="1" />
                        <stop offset="100%" stopColor={particleColor || "#06b6d4"} stopOpacity="0" />
                    </radialGradient>
                </defs>
                {[...Array(particleDensity || 50)].map((_, i) => (
                    <circle
                        key={i}
                        cx={`${Math.random() * 100}%`}
                        cy={`${Math.random() * 100}%`}
                        r={Math.random() * (maxSize || 2) + (minSize || 0.5)}
                        fill={`url(#gradient-${id})`}
                        className="animate-pulse"
                        style={{
                            animationDelay: `${Math.random() * 3}s`,
                            animationDuration: `${Math.random() * 3 + 2}s`,
                        }}
                    />
                ))}
            </svg>
        </div>
    );
};
