import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

import Login from "./Login";
import Signup from "./Signup";
import ChatPage from "./ChatPage";
import AdminPage from "./AdminPage";
import TypingText from "./TypingText";

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [page, setPage] = useState("login");

  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [loadingGlobal, setLoadingGlobal] = useState(true);

  /* 🔐 Auth */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingUser(false);
      if (!u) {
        setIsAdmin(false);
        setLoadingRole(false);
      }
    });
    return () => unsub();
  }, []);

  /* 👑 role (Firestore 기준) */
  useEffect(() => {
    if (!user?.uid) return;

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setIsAdmin(snap.data()?.role === "admin");
        setLoadingRole(false);
      },
      () => {
        setIsAdmin(false);
        setLoadingRole(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  /* 🌍 global access (중요 수정) */
  useEffect(() => {
    const ref = doc(db, "admin", "system", "globalAccess", "config");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        // ✅ globalEnabled 필드로 통일
        setGlobalEnabled(
          snap.exists() ? snap.data()?.globalEnabled ?? true : true
        );
        setLoadingGlobal(false);
      },
      (err) => {
        console.error("🔥 globalAccess error:", err);
        // ❗ 에러 시 기본은 허용
        setGlobalEnabled(true);
        setLoadingGlobal(false);
      }
    );

    return () => unsub();
  }, []);

  /* ⏳ 로딩 */
  if (loadingUser || loadingRole || loadingGlobal) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        🔄 상태 확인 중…
      </div>
    );
  }

  /* 🚫 로그인 안 됨 */
  if (!user) {
    return page === "login" ? (
      <Login
        goSignup={() => setPage("signup")}
        onFinishLogin={() => setPage("intro")}
      />
    ) : (
      <Signup goLogin={() => setPage("login")} />
    );
  }

  /* 🚫 전역 차단 (관리자 예외) */
  if (!globalEnabled && !isAdmin) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white">
        ⛔ 서비스 점검 중
      </div>
    );
  }

  /* 🎬 인트로 */
  if (page === "intro") {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <TypingText
          text="Here, Ever Reliable & Open"
          size="lg"
          onComplete={() => setPage("main")}
        />
      </div>
    );
  }

  /* 🛠 관리자 */
  if (page === "admin" && isAdmin) {
    return <AdminPage goMain={() => setPage("main")} />;
  }

  /* 💬 메인 */
  return (
    <ChatPage
      user={user}
      goAdmin={isAdmin ? () => setPage("admin") : null}
    />
  );
}
