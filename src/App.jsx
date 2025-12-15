import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";

import Login from "./Login";
import Signup from "./Signup";
import ChatPage from "./ChatPage";
import TypingText from "./TypingText";

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [page, setPage] = useState("login");
  const [readyForChat, setReadyForChat] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingUser(false);
    });
    return () => unsub();
  }, []);

  if (loadingUser) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        🔄 로그인 상태 확인 중…
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      {/* 🌊 배경 레이어 */}
      <AnimatePresence mode="wait">
        {!readyForChat ? (
          <motion.div
            key="login-bg"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/back.png')" }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        ) : (
          <motion.div
            key="chat-bg"
            className="
              absolute inset-0
              bg-gradient-to-br
              from-slate-900 via-neutral-900 to-black
            "
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      {/* 🧩 콘텐츠 레이어 */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {!user ? (
          page === "login" ? (
            <Login goSignup={() => setPage("signup")} />
          ) : (
            <Signup goLogin={() => setPage("login")} />
          )
        ) : !readyForChat ? (
          <TypingText
            text="Here, Ever Reliable & Open"
            onComplete={() => {
              setTimeout(() => {
                setReadyForChat(true);
              }, 600);
            }}
          />
        ) : (
          <ChatPage user={user} />
        )}
      </div>
    </div>
  );
}
