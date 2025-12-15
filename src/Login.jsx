import { useState } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import TypingText from "./TypingText";

export default function Login({ goSignup, onFinishLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  const [success, setSuccess] = useState(false);      // 로그인 성공 → 카드 제거
  const [showTyping, setShowTyping] = useState(false); // 타이핑 인트로
  const [loading, setLoading] = useState(false);       // 중복 클릭 방지

  const handleAuth = async (e) => {
    e.preventDefault();
    if (loading) return;

    try {
      setError("");
      setLoading(true);

      // 🔐 로그인
      await signInWithEmailAndPassword(auth, email, pw);

      // ✅ 로그인 성공 → 카드 제거
      setSuccess(true);

      // ⏱ 카드 사라진 뒤 타이핑 시작
      setTimeout(() => {
        setShowTyping(true);
      }, 600);
    } catch (err) {
      console.error(err);
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      {/* 🌌 배경 */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('/back.png')" }}
      />

      {/* 🧱 메인 레이어 */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {/* 🟦 로그인 카드 */}
        <AnimatePresence>
          {!success && (
            <motion.div
              key="login-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className="
                relative p-[1px] rounded-2xl
                bg-gradient-to-br
                from-sky-400/60 via-indigo-400/40 to-pink-400/60
                shadow-xl
              "
            >
              <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl w-80">
                <h2 className="text-lg font-semibold mb-4 text-center">
                  Welcome Back
                </h2>

                <form onSubmit={handleAuth}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />

                  <input
                    type="password"
                    placeholder="Password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    className="w-full p-2 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />

                  {error && (
                    <p className="text-red-500 text-sm mb-2 text-center">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="
                      w-full p-2 rounded text-white font-medium
                      bg-gradient-to-r
                      from-sky-400 via-sky-500 to-pink-400
                      hover:from-sky-500 hover:via-sky-600 hover:to-pink-500
                      active:scale-[0.98]
                      transition-all duration-300
                      shadow-md shadow-sky-300/40
                      disabled:opacity-50
                    "
                  >
                    로그인
                  </button>
                </form>

                {/* 👉 회원가입 이동 */}
                <p
                  onClick={goSignup}
                  className="text-sm text-center mt-3 cursor-pointer text-sky-600"
                >
                  회원가입하기
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ✨ 타이핑 인트로 */}
        <AnimatePresence>
          {showTyping && (
            <motion.div
              className="absolute inset-0 z-30 flex items-center justify-center bg-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TypingText
                text="Here, Ever Reliable & Open"
                onComplete={() => {
                  setTimeout(() => {
                    onFinishLogin(); // ⭐ 여기서 App → ChatPage 진입
                  }, 600);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
