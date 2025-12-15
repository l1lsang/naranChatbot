import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

import Login from "./Login";
import Signup from "./Signup";
import ChatPage from "./ChatPage";

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [page, setPage] = useState("login"); // login | signup
  const [readyForChat, setReadyForChat] = useState(false); // 🔑 핵심 상태

  // 🔥 Firebase 인증 상태 감시 (인증만!)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingUser(false);
    });
    return () => unsub();
  }, []);

  // 1️⃣ Firebase 인증 확인 중
  if (loadingUser) {
    return (
      <div className="w-screen h-screen flex items-center justify-center text-lg dark:text-white">
        🔄 로그인 상태 확인 중…
      </div>
    );
  }

  // 2️⃣ 로그인 안 됨 → Login / Signup
  if (!user) {
    return page === "login" ? (
      <Login
        goSignup={() => setPage("signup")}
        onFinishLogin={() => setReadyForChat(true)} // 🔥 Login 연출 끝났을 때만
      />
    ) : (
      <Signup goLogin={() => setPage("login")} />
    );
  }

  // 3️⃣ 로그인은 됐지만, 아직 연출 중 → Login 화면 유지
  if (user && !readyForChat) {
    return (
      <Login
        goSignup={() => setPage("signup")}
        onFinishLogin={() => setReadyForChat(true)}
      />
    );
  }

  // 4️⃣ 로그인 + 연출 완료 → ChatPage 진입
  return <ChatPage user={user} />;
}
