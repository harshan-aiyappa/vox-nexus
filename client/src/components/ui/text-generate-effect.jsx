import { cn } from "../../lib/utils";
import { motion } from "framer-motion";

export const TextGenerateEffect = ({ words, className }) => {
    const wordsArray = words.split(" ");

    return (
        <div className={cn("", className)}>
            {wordsArray.map((word, idx) => (
                <motion.span
                    key={word + idx}
                    initial={{ opacity: 0, filter: "blur(10px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    transition={{
                        duration: 0.5,
                        delay: idx * 0.1,
                    }}
                    className="inline-block mr-1"
                >
                    {word}
                </motion.span>
            ))}
        </div>
    );
};
