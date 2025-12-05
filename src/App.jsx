import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

import Login from "./Login";
import Signup from "./Signup";
import ChatPage from "./ChatPage"; // 🔥 챗봇 UI 분리한 컴포넌트

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [page, setPage] = useState("login"); // login | signup

  // 🔥 Firebase 로그인 감시 — App의 가장 첫 useEffect여야 안전함
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingUser(false);
    });
    return () => unsub();
  }, []);

  /* --------------------------------------------------
      조건부 렌더링은 Hook 아래에만 있어야 해서
      아래 구조는 절대 문제가 없음
  -------------------------------------------------- */

  // 1) Firebase가 로그인 상태 확인 중
  if (loadingUser) {
    return (
      <div className="w-screen h-screen flex items-center justify-center text-lg dark:text-white">
        🔄 로그인 상태 확인 중…
      </div>
    );
  }

  // 2) 로그인 안 된 상태 → Login / Signup 화면만 렌더
  if (!user) {
    return page === "login" ? (
      <Login goSignup={() => setPage("signup")} />
    ) : (
      <Signup goLogin={() => setPage("login")} />
    );
  }

  // 3) 로그인됨 → 챗봇 메인 페이지 렌더
  return <ChatPage user={user} />;
}
