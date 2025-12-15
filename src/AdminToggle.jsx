import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export default function AdminGlobalToggle() {
  const [enabled, setEnabled] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, "admin", "system", "globalAccess");

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setEnabled(snap.data().enabled);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const toggle = async () => {
    const ref = doc(db, "admin", "system", "globalAccess");
    await updateDoc(ref, { enabled: !enabled });
  };

  if (loading) return <div>불러오는 중…</div>;

  return (
    <div className="p-6 rounded-xl border bg-white dark:bg-neutral-900">
      <h2 className="text-lg font-bold mb-4">🌍 전역 접근 제어</h2>

      <div className="flex items-center gap-4">
        <span className="text-sm">
          현재 상태:
          <strong className={enabled ? "text-green-600" : "text-red-600"}>
            {enabled ? " ACTIVE" : " PENDING"}
          </strong>
        </span>

        <button
          onClick={toggle}
          className={`px-4 py-2 rounded-lg text-white transition
            ${enabled ? "bg-red-600" : "bg-green-600"}
          `}
        >
          {enabled ? "전체 차단" : "전체 허용"}
        </button>
      </div>
    </div>
  );
}
