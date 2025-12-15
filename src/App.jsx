import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

import Login from "./Login";
import Signup from "./Signup";
import ChatPage from "./ChatPage";
import TypingText from "./TypingText";

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [page, setPage] = useState("login");

  // 🔑 인트로 제어
  const [showIntro, setShowIntro] = useState(false);
  const [introDone, setIntroDone] = useState(false);

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
        🔄 로그인 확인 중…
      </div>
    );
  }

  /* ---------------- 로그인 안 됨 ---------------- */
  if (!user) {
    return page === "login" ? (
      <Login
        goSignup={() => setPage("signup")}
        onFinishLogin={() => setShowIntro(true)} // ⭐ 여기
      />
    ) : (
      <Signup goLogin={() => setPage("login")} />
    );
  }

  /* ---------------- 로그인 직후 인트로 ---------------- */
  if (showIntro && !introDone) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <TypingText
          text="Here, Ever Reliable & Open"
          onComplete={() => {
            setTimeout(() => {
              setIntroDone(true);
              setShowIntro(false);
            }, 600);
          }}
        />
      </div>
    );
  }

  /* ---------------- 메인 챗봇 ---------------- */
  return <ChatPage user={user} />;
}
