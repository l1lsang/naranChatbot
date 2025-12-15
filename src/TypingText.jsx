import { motion } from "framer-motion";

export default function TypingText({ text, onComplete }) {
  const letters = text.split("");

  return (
    <motion.div
      className="
        text-center font-extrabold tracking-tight select-none
        text-[2.5rem] md:text-[4rem] lg:text-[5.5rem]
        bg-gradient-to-r from-sky-300 via-pink-300 to-indigo-300
        bg-clip-text text-transparent
        drop-shadow-[0_0_25px_rgba(255,255,255,0.35)]
      "
      initial="hidden"
      animate="visible"
      onAnimationComplete={onComplete}
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.12, // ✍️ 타이핑 속도
          },
        },
      }}
    >
      {letters.map((char, i) => (
        <motion.span
          key={i}
          className="inline-block"
          variants={{
            hidden: {
              opacity: 0,
              y: 24,
              filter: "blur(6px)",
            },
            visible: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: {
                duration: 0.45,
                ease: "easeOut",
              },
            },
          }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}

      {/* 🌙 숨 쉬는 듯한 마지막 빛 */}
      <motion.div
        className="absolute inset-0 -z-10"
        animate={{
          opacity: [0.15, 0.35, 0.15],
        }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}
