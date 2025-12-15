import { motion } from "framer-motion";

export default function TypingText({ text, onComplete, size = "lg" }) {
  const letters = text.split("");
console.log("🔥 TypingText rendered");

const sizeClass =
  size === "xl"
    ? "text-[clamp(2.5rem,6vw,4rem)]"
    : size === "sm"
    ? "text-[clamp(1rem,3vw,1.25rem)]"
    : "text-[clamp(1.25rem,4vw,1.75rem)]";




  return (
    <motion.div
      key={text} // ⭐ 이거 중요 (재마운트 → 애니메이션 재실행)
      className="relative z-20 font-semibold leading-relaxed select-none"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {}, // ⭐ 반드시 필요
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
