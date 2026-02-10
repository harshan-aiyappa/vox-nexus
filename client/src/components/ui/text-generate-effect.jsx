import { cn } from "../../lib/utils";
import { motion } from "framer-motion";

export const TextGenerateEffect = ({ words, className }) => {
    const wordsArray = words.split(" ");

    return (
        <div className={cn("inline", className)}>
            {wordsArray.map((word, idx) => (
                <motion.span
                    key={word + idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                        duration: 0.3,
                        delay: idx * 0.05, // Faster, punchier reveal
                        ease: "easeOut"
                    }}
                    className="inline-block mr-1 will-change-transform transform-gpu"
                >
                    {word}
                </motion.span>
            ))}
        </div>
    );
};
