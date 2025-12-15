import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { HexColorPicker } from "react-colorful";
import { signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

import TypingText from "./TypingText"; // ✨ NEW

import img1 from "../src/img/1.png";
import moon from "../src/img/moon.png";
import sun from "../src/img/sun.png";
import p from "../src/img/p.png";
import book from "../src/img/book.png";

/* ---------------------------------------------------------
   ■ 메인 컴포넌트
--------------------------------------------------------- */
export default function ChatPage({ user }) {
  const textareaRef = useRef(null);
  const chatRef = useRef(null);

  /* ---------------- State ---------------- */
  const [darkMode, setDarkMode] = useState(false);
  const [toneModal, setToneModal] = useState(false);

  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [showIntroTyping, setShowIntroTyping] = useState(false); // ✨ NEW

  const currentConv = conversations.find((c) => c.id === currentId) || null;
  const currentProject =
    projects.find((p) => p.id === currentProjectId) || null; 
    const [userRole, setUserRole] = useState(null);
const [loadingRole, setLoadingRole] = useState(true);

useEffect(() => {
  if (!user?.uid) return;

  const fetchRole = async () => {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        setUserRole(snap.data().role); // "pending" | "active"
      } else {
        setUserRole("pending");
      }
    } catch (e) {
      console.error("role 로드 실패", e);
      setUserRole("pending");
    } finally {
      setLoadingRole(false);
    }
  };

  fetchRole();
}, [user]);

  /* ---------------- Dark Mode ---------------- */
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  /* ---------------- Load Projects ---------------- */
  useEffect(() => {
    if (!user?.uid) return;

    const uid = user.uid;
    const projRef = collection(db, "users", uid, "projects");

    return onSnapshot(projRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProjects(list);
    });
  }, [user]);

  /* ---------------- Load Conversations ---------------- */
  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;

    let convRef = currentProjectId
      ? query(
          collection(db, "users", uid, "conversations"),
          where("projectId", "==", currentProjectId)
        )
      : collection(db, "users", uid, "conversations");

    return onSnapshot(convRef, async (snap) => {
      const list = [];

      for (let c of snap.docs) {
        const msgSnap = await getDocs(
          collection(db, "users", uid, "conversations", c.id, "messages")
        );

        const messages = msgSnap.docs
          .map((m) => ({ id: m.id, ...m.data() }))
          .sort(
            (a, b) =>
              (a.createdAt?.seconds || 0) -
              (b.createdAt?.seconds || 0)
          );

        list.push({ id: c.id, ...c.data(), messages });
      }

      setConversations(list);

      if (!currentId && list.length > 0) {
        setCurrentId(list[0].id);
      }
    });
  }, [user, currentProjectId]);

  /* ---------------- Auto Scroll ---------------- */
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [currentConv?.messages, loading]);

  /* ---------------- ✨ 첫 챗봇 인트로 타이핑 ---------------- */
  useEffect(() => {
    if (
      currentConv &&
      currentConv.messages.length === 0 &&
      currentConv.tone
    ) {
      setShowIntroTyping(true);
    } else {
      setShowIntroTyping(false);
    }
  }, [currentConv]);

  const saveMessage = async (convId, sender, text) => {
    const uid = user.uid;
    await setDoc(
      doc(
        db,
        "users",
        uid,
        "conversations",
        convId,
        "messages",
        Date.now().toString()
      ),
      {
        sender,
        text,
        createdAt: serverTimestamp(),
      }
    );
  };
  if (loadingRole) {
  return (
    <div className="flex-1 flex items-center justify-center text-gray-500">
      권한 확인 중…
    </div>
  );
}

if (userRole !== "active") {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-4">
      <div>
        <h2 className="text-xl font-semibold mb-2">
          ⛔ 접근 제한
        </h2>
        <p className="text-gray-500">
          관리자 허용 후 이용 가능합니다.
        </p>
      </div>
    </div>
  );
}


  /* ---------------- UI ---------------- */
  return (
    <div className="w-screen h-screen flex overflow-hidden">
      {/* Sidebar (기존 그대로) */}
      {/* ... 👉 네 기존 sidebar 코드 그대로 유지 */}

      {/* ---------------- 메인 영역 ---------------- */}
      {!currentConv ? (
        <main className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-black">
          <p className="text-gray-500">상담을 선택해주세요</p>
        </main>
      ) : (
        <main className="flex-1 flex flex-col bg-gray-50 dark:bg-black">
          {/* Header */}
          <header className="p-4 border-b bg-white dark:bg-neutral-900">
            <h1 className="text-lg font-semibold dark:text-white">
              LAW HERO
            </h1>
          </header>

          {/* Messages */}
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            {/* ✨ 첫 인트로 타이핑 */}
            {showIntroTyping && (
              <div className="flex justify-start">
                <TypingText
                  size="sm"
                  text="Here, Ever Reliable & Open"
                  onComplete={async () => {
                    await saveMessage(
                      currentConv.id,
                      "bot",
                      "Here, Ever Reliable & Open"
                    );
                    setShowIntroTyping(false);
                  }}
                />
              </div>
            )}

            {/* 기존 메시지 렌더 */}
            {(currentConv.messages ?? []).map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[70%] px-4 py-3 rounded-2xl shadow text-sm ${
                    msg.sender === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-neutral-800 dark:text-gray-200"
                  }`}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              </div>
            ))}

            {loading && (
              <div className="text-sm text-gray-500">
                챗봇이 입력 중입니다…
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t bg-white dark:bg-neutral-900 flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 border rounded-xl p-3 resize-none"
              placeholder="메시지를 입력하세요"
            />
            <button
              onClick={() => {}}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl"
            >
              전송
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
