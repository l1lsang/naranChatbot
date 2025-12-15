import { useState } from "react";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import TypingText from "./TypingText";
import { useNavigate } from "react-router-dom";

export default function Login({ goSignup, onFinishLogin }) {

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showTyping, setShowTyping] = useState(false);

  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      setError("");
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, pw);
      } else {
        await createUserWithEmailAndPassword(auth, email, pw);
      }

      setSuccess(true);

      // 카드 사라진 뒤 타이핑 시작
      setTimeout(() => {
        setShowTyping(true);
      }, 700);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      {/* 배경 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/back.png')" }}
      />

      {/* 로그인 카드 */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <AnimatePresence>
          {!success && (
            <motion.div
              key="login-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: 1.5, duration: 0.6 }}
              className="
                relative p-[1px] rounded-2xl
                bg-gradient-to-br
                from-sky-400/60 via-indigo-400/40 to-pink-400/60
                shadow-xl
              "
            >
              <div className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl p-8 rounded-2xl w-80">
                <h2 className="text-lg font-semibold mb-4 text-center">
                  {mode === "login" ? "Welcome Back" : "Create Account"}
                </h2>

                <form onSubmit={handleAuth}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 border rounded mb-3"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    className="w-full p-2 border rounded mb-3"
                  />

                  {error && (
                    <p className="text-red-500 text-sm mb-2 text-center">
                      {error}
                    </p>
                  )}

                  <button
  type="submit"
  className="
    w-full p-2 rounded text-white font-medium
    bg-gradient-to-r
    from-sky-400 via-sky-500 to-pink-400
    hover:from-sky-500 hover:via-sky-600 hover:to-pink-500
    active:scale-[0.98]
    transition-all duration-300
    shadow-md shadow-sky-300/40
  "
>
  {mode === "login" ? "로그인" : "회원가입"}
</button>

                </form>

                <p
                  onClick={() =>
                    setMode(mode === "login" ? "signup" : "login")
                  }
                  className="text-sm text-center mt-3 cursor-pointer text-sky-600"
                >
                  {mode === "login"
                    ? "회원가입하기"
                    : "이미 계정이 있으신가요? 로그인"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 타이핑 문구 */}
        <AnimatePresence>
          {showTyping && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <TypingText
  text="Here, Ever Reliable & Open"
  onComplete={() => {
    setTimeout(() => {
      onFinishLogin(); // 🔥 App에게 “이제 Chat 가도 됨” 신호
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
