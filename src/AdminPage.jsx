import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { db } from "./firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [enabled, setEnabled] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔐 관리자 여부 확인
  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdTokenResult();
      setIsAdmin(token.claims.admin === true);
    };

    checkAdmin();
  }, []);

  // 🌍 전역 스위치 구독
  useEffect(() => {
    if (!isAdmin) return;

    const ref = doc(db, "admin", "system", "globalAccess");

    return onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        // 최초 1회 생성
        await setDoc(ref, {
          enabled: false,
          updatedAt: serverTimestamp(),
        });
        return;
      }

      setEnabled(snap.data().enabled);
      setLoading(false);
    });
  }, [isAdmin]);

  // ⛔ 관리자 아님
  if (!isAdmin) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <h2 className="text-xl font-bold">⛔ 관리자 전용 페이지</h2>
      </div>
    );
  }

  if (loading || enabled === null) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        로딩 중…
      </div>
    );
  }

  // 🔘 스위치 토글
  const toggle = async () => {
    const ref = doc(db, "admin", "system", "globalAccess");
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
      </div>
    </div>
  );
}
