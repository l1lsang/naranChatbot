import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { db } from "./firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";

export default function AdminPage({ goMain }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [enabled, setEnabled] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ===============================
     👑 관리자 여부 (Firestore role 기준)
     =============================== */
  useEffect(() => {
    const checkRole = async () => {
      const user = auth.currentUser;
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      const role = snap.exists() ? snap.data()?.role : null;

      setIsAdmin(role === "admin");
      setLoading(false);
    };

    checkRole();
  }, []);

  /* ===============================
     🌍 전역 접근 스위치 구독
     =============================== */
  useEffect(() => {
    if (!isAdmin) return;

    const ref = doc(db, "admin", "system", "globalAccess", "config");

    return onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        await setDoc(ref, {
          enabled: false,
          updatedAt: serverTimestamp(),
        });
        return;
      }

      setEnabled(snap.data().enabled);
    });
  }, [isAdmin]);

  /* ===============================
     ⛔ 관리자 아님
     =============================== */
  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        로딩 중…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <h2 className="text-xl font-bold">⛔ 관리자 전용 페이지</h2>
      </div>
    );
  }

  if (enabled === null) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        설정 불러오는 중…
      </div>
    );
  }

  /* ===============================
     🔘 스위치 토글
     =============================== */
  const toggle = async () => {
    const ref = doc(db, "admin", "system", "globalAccess", "config");

    await updateDoc(ref, {
      enabled: !enabled,
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-[360px] text-center">
        <h1 className="text-2xl font-bold mb-4">🛠 관리자 패널</h1>

        <p className="mb-6 text-gray-600">
          전체 사용자 접근 상태
        </p>

        <button
          onClick={toggle}
          className={`w-full py-3 rounded-xl text-white font-semibold transition ${
            enabled ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {enabled ? "ACTIVE (전체 허용)" : "PENDING (전체 차단)"}
        </button>

        <p className="mt-4 text-xs text-gray-400">
          스위치 변경 시 모든 사용자에게 즉시 반영됩니다.
        </p>

        {goMain && (
          <button
            onClick={goMain}
            className="mt-6 w-full py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition"
          >
            ← 메인으로 돌아가기
          </button>
        )}
      </div>
    </div>
  );
}
