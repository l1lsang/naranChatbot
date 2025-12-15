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
  /* ===============================
     🔐 인증 상태
     =============================== */
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [page, setPage] = useState("login"); // login | signup | intro | main | admin

  /* ===============================
     👑 관리자 여부 (role 기반)
     =============================== */
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  /* ===============================
     🌍 전역 접근 제어
     =============================== */
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [loadingGlobal, setLoadingGlobal] = useState(true);

  /* ===============================
     🔐 로그인 상태 감지
     =============================== */
useEffect(() => {
  const ref = doc(db, "admin", "system", "globalAccess", "config");

  const unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        // 🔥 문서 없으면 "허용"으로 간주
        setGlobalEnabled(true);
      } else {
        setGlobalEnabled(snap.data().enabled === true);
      }
      setLoadingGlobal(false);
    },
    () => {
      setGlobalEnabled(true); // 에러 시에도 막지 않음
      setLoadingGlobal(false);
    }
  );

  return () => unsub();
}, []);

  /* ===============================
     👑 role 기반 관리자 판별
     =============================== */
  useEffect(() => {
    if (!user?.uid) return;

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const role = snap.data()?.role;
        setIsAdmin(role === "admin");
        setLoadingRole(false);
      },
      () => {
        setIsAdmin(false);
        setLoadingRole(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  /* ===============================
     🌍 전역 스위치 구독
     =============================== */
  useEffect(() => {
    const ref = doc(db, "admin", "system");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        setGlobalEnabled(
          snap.exists() ? snap.data()?.globalAccess ?? false : false
        );
        setLoadingGlobal(false);
      },
      () => {
        setGlobalEnabled(false);
        setLoadingGlobal(false);
      }
    );

    return () => unsub();
  }, []);

  /* ===============================
     ⏳ 로딩
     =============================== */
  if (loadingUser || loadingRole || loadingGlobal) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        🔄 상태 확인 중…
      </div>
    );
  }

  /* ===============================
     🚫 로그인 안 됨
     =============================== */
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

  /* ===============================
     🚫 전역 차단 (관리자는 통과)
     =============================== */
  if (!globalEnabled && !isAdmin) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <h2 className="text-xl font-bold mb-2">⛔ 서비스 점검 중</h2>
          <p className="text-gray-400">
            현재 관리자가 전체 접근을 제한했습니다.
          </p>
        </div>
      </div>
    );
  }

  /* ===============================
     🎬 인트로
     =============================== */
  if (page === "intro") {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <TypingText
          text="Here, Ever Reliable & Open"
          size="xl"
          onComplete={() => {
            setTimeout(() => setPage("main"), 600);
          }}
        />
      </div>
    );
  }

  /* ===============================
     🛠 관리자 페이지
     =============================== */
  if (page === "admin" && isAdmin) {
    return <AdminPage goMain={() => setPage("main")} />;
  }

  /* ===============================
     💬 메인 챗봇
     =============================== */
  if (page === "main") {
    return (
      <ChatPage
        user={user}
        goAdmin={isAdmin ? () => setPage("admin") : null}
      />
    );
  }

  return null;
}
