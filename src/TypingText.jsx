import { motion } from "framer-motion";

export default function TypingText({ text, onComplete, size = "lg" }) {
  const letters = text.split("");

  const sizeClass =
    size === "sm"
      ? "text-base md:text-lg"
      : "text-xl md:text-2xl";

  return (
    <motion.div
      className={`
        relative z-20
        font-semibold leading-relaxed
        select-none
      `}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: { staggerChildren: 0.04 },
        },
      }}
    >
      {letters.map((char, i) => {
        const isLast = i === letters.length - 1;

        return (
          <motion.span
            key={i}
            className={`
              inline-block
              ${sizeClass}
              bg-gradient-to-r from-sky-400 via-pink-400 to-indigo-400
              bg-clip-text text-transparent
              drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]
            `}
            onAnimationComplete={isLast ? onComplete : undefined}
            variants={{
              hidden: {
                opacity: 0,
                y: 8,
                filter: "blur(4px)",
              },
              visible: {
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                transition: {
                  duration: 0.25,
                  ease: "easeOut",
                },
              },
            }}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        );
      })}
    </motion.div>
  );
}
