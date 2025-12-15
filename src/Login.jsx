import { useState } from "react";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      setError("");
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, pw);
      } else {
        await createUserWithEmailAndPassword(auth, email, pw);
      }
      setSuccess(true); // 로그인 성공 → fade-out
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      {/* ✅ 배경 이미지 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/img/back.png')", // 🔥 여기만 수정
        }}
      >
        {/* 선택: 어두운 오버레이 */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* 로그인 카드 */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <AnimatePresence>
          {!success && (
            <motion.div
              key="login-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: 3, duration: 0.6 }}
              className="
                bg-white/90 dark:bg-neutral-900/90
                backdrop-blur-xl
                p-8 rounded-2xl shadow-xl w-80
              "
            >
              <h2 className="text-lg font-semibold mb-4 dark:text-white text-center">
                {mode === "login" ? "Welcome Back" : "Create Account"}
              </h2>

              <form onSubmit={handleAuth}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 border rounded mb-3 dark:bg-neutral-800 dark:text-white"
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="w-full p-2 border rounded mb-3 dark:bg-neutral-800 dark:text-white"
                />

                {error && (
                  <p className="text-red-500 text-sm mb-2 text-center">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white p-2 rounded mb-3 hover:bg-indigo-700 transition"
                >
                  {mode === "login" ? "로그인" : "회원가입"}
                </button>
              </form>

              <p
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-sm text-indigo-600 cursor-pointer text-center dark:text-indigo-400"
              >
                {mode === "login"
                  ? "회원가입하기"
                  : "이미 계정이 있으신가요? 로그인"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
