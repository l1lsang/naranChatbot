import { motion } from "framer-motion";

export default function TypingText({ text, onComplete }) {
  const letters = text.split("");

  return (
    <motion.div
      className="text-center font-extrabold tracking-tight
        text-[2.5rem] md:text-[4rem] lg:text-[5rem]
        text-white drop-shadow-xl"
      initial="hidden"
      animate="visible"
      onAnimationComplete={onComplete}
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.3,
          },
        },
      }}
    >
      {letters.map((char, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1 },
          }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </motion.div>
  );
}
