import { motion } from "framer-motion";

export default function TypingText({ text, onComplete, size = "lg" }) {
  const letters = text.split("");

  const sizeClass =
    size === "sm"
      ? "text-xl md:text-2xl"
      : "text-[2.5rem] md:text-[4rem] lg:text-[5.5rem]";

  return (
    <motion.div
      className={`
        relative z-20
        text-center font-extrabold tracking-tight select-none
        ${sizeClass}
        bg-gradient-to-r from-sky-300 via-pink-300 to-indigo-300
        bg-clip-text text-transparent
        drop-shadow-[0_0_20px_rgba(0,0,0,0.45)]
      `}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: { staggerChildren: 0.08 },
        },
      }}
    >
      {letters.map((char, i) => {
        const isLast = i === letters.length - 1;

        return (
          <motion.span
            key={i}
            className="inline-block"
            onAnimationComplete={isLast ? onComplete : undefined}
            variants={{
              hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
              visible: {
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                transition: { duration: 0.4, ease: "easeOut" },
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
