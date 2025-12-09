import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { signOut } from "firebase/auth";
import { auth, db } from "./firebase";

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

export default function ChatPage({ user }) {
  /* ---------------- Refs ---------------- */
  const textareaRef = useRef(null);
  const chatRef = useRef(null);

  /* ---------------- State ---------------- */
  const [darkMode, setDarkMode] = useState(false);
  const [toneModal, setToneModal] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const currentConv = conversations.find((c) => c.id === currentId);

  /* ---------------- Firestore: Load Conversations & Messages ---------------- */
  useEffect(() => {
    if (!user?.uid) return;

    const uid = user.uid;
    const convRef = collection(db, "users", uid, "conversations");

    const unsubscribe = onSnapshot(convRef, async (snap) => {
      let list = [];

      for (let c of snap.docs) {
        const convId = c.id;
        const data = c.data();

        const msgSnap = await getDocs(
          collection(db, "users", uid, "conversations", convId, "messages")
        );

        const messages = msgSnap.docs
          .map((m) => ({ id: m.id, ...m.data() }))
          .sort((a, b) => {
            const at = a.createdAt?.seconds || a.clientTime || 0;
            const bt = b.createdAt?.seconds || b.clientTime || 0;
            return at - bt;
          });

        list.push({
          id: convId,
          title: data.title || "상담",
          tone: data.tone || null,
          createdAt: data.createdAt,
          messages,
        });
      }

      // 최신 상담이 위로 오게 정렬
      list.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );

      setConversations(list);
    });

    return () => unsubscribe();
  }, [user]);

  /* ---------------- Auto Select Conversation & Tone Modal ---------------- */
  useEffect(() => {
    if (conversations.length === 0) {
      setCurrentId(null);
      setToneModal(false);
      return;
    }

    if (!currentId) {
      const first = conversations[0];
      setCurrentId(first.id);
      setToneModal(!first.tone);
      return;
    }

    const conv = conversations.find((c) => c.id === currentId);
    if (conv) {
      setToneModal(!conv.tone);
    }
  }, [conversations, currentId]);

  /* ---------------- Auto Scroll ---------------- */
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [currentConv?.messages, loading]);

  /* ---------------- Dark Mode 초기 로드 ---------------- */
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  /* ---------------- Dark Mode 토글 시 DOM 반영 ---------------- */
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  /* ---------------- Firestore: Save Message ---------------- */
  const saveMessage = async (convId, sender, text) => {
    const uid = user.uid;
    const msgId = Date.now().toString();

    await setDoc(
      doc(db, "users", uid, "conversations", convId, "messages", msgId),
      {
        sender,
        text: text ?? "", // 안전하게 비어있는 문자열로 보정
        createdAt: serverTimestamp(),
        clientTime: Date.now() / 1000,
      }
    );
  };

  /* ---------------- 새 상담 생성 ---------------- */
  const addConversation = async () => {
    const uid = user.uid;
    const newId = Date.now().toString();

    // 1) 상담 문서 생성
    await setDoc(doc(db, "users", uid, "conversations", newId), {
      title: "새 상담",
      tone: null,
      createdAt: serverTimestamp(),
    });

    // 2) 첫 안내 메시지 (Firestore 저장)
    const firstMsgId = (Date.now() + 1).toString();

    await setDoc(
      doc(db, "users", uid, "conversations", newId, "messages", firstMsgId),
      {
        sender: "bot",
        text: "새로운 상담을 시작합니다. 먼저 블로그 작성 톤을 선택해주세요! ✍️",
        createdAt: serverTimestamp(),
        clientTime: Date.now() / 1000,
      }
    );

    setCurrentId(newId);
    setToneModal(true);
  };

  /* ---------------- GPT 호출용 메시지 배열 생성 ---------------- */
  const buildMessagesForApi = (conv) =>
    conv.messages.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text || "",
    }));

  /* ---------------- 공통 JSON 파서 (HTML 에러 대응) ---------------- */
  const safeJsonParse = async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("JSON Parse 실패, 응답 원문:", text);
      throw new Error("서버 응답을 JSON으로 해석하지 못했어요.");
    }
  };

  /* ---------------- GPT 라우팅 / API 호출 ---------------- */
  const requestGpt = async (convId, messagesForApi) => {
    const last =
      messagesForApi[messagesForApi.length - 1]?.content?.trim() || "";

    const tone = currentConv?.tone;

    try {
      // 1) "시작" → 템플릿 전용 API (/api/law/start)
      if (last === "시작") {
        const res = await fetch("/api/law/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: messagesForApi }),
        });

        if (!res.ok) {
          console.error("템플릿 API 오류:", res.status);
          throw new Error("템플릿 API 오류");
        }

        const data = await safeJsonParse(res);
        return data.reply || "템플릿을 불러오지 못했어요.";
      }

      // 2) 3줄 템플릿 + 구성선택이 채워진 경우 → 블로그 본문 생성 (/api/law/blog)
      const isBlogFormFilled =
        last.includes("✅키워드:") &&
        last.includes("✅사기내용:") &&
        last.includes("✅구성선택:");

      if (isBlogFormFilled) {
        const res = await fetch("/api/law/blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesForApi,
            category: tone || "일반",
          }),
        });

        if (!res.ok) {
          console.error("블로그 API 오류:", res.status);
          throw new Error("블로그 API 오류");
        }

        const data = await safeJsonParse(res);
        return data.reply || "블로그 본문을 생성하지 못했어요.";
      }

      // 3) 그 외는 모두 일반 상담 (/api/chat)
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesForApi }),
      });

      if (!res.ok) {
        console.error("일반 상담 API 오류:", res.status);
        throw new Error("상담 API 오류");
      }

      const data = await safeJsonParse(res);
      return data.reply || "답변을 생성하지 못했어요.";
    } catch (err) {
      console.error("requestGpt 에러:", err);
      return "⚠️ 서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }
  };

  /* ---------------- 메시지 전송 ---------------- */
  const sendMessage = async (text) => {
    if (!text.trim() || !currentConv?.tone || loading) return;

    const convId = currentId;

    setLoading(true);

    try {
      // 1) 사용자 메시지 Firestore 저장
      await saveMessage(convId, "user", text);

      // 2) GPT에 보낼 대화 구성 (로컬 state 기준 + 방금 메시지 추가)
      const conv = conversations.find((c) => c.id === convId);
      const tempConv = conv
        ? {
            ...conv,
            messages: [...conv.messages, { sender: "user", text }],
          }
        : {
            id: convId,
            messages: [{ sender: "user", text }],
          };

      // 3) GPT 요청
      const reply = await requestGpt(convId, buildMessagesForApi(tempConv));

      // 4) GPT 응답 Firestore 저장
      await saveMessage(convId, "bot", reply);
    } finally {
      setLoading(false);
      setInput("");

      const el = textareaRef.current;
      if (el) el.style.height = "auto";
    }
  };

  /* ---------------- 톤 선택 ---------------- */
  const selectTone = async (toneName) => {
    const uid = user.uid;

    await updateDoc(doc(db, "users", uid, "conversations", currentId), {
      tone: toneName,
    });

    // 모달 살짝 딜레이 후 닫기 (애니메이션 느낌)
    setTimeout(() => setToneModal(false), 30);

    // 선택 안내 메시지
    await saveMessage(
      currentId,
      "bot",
      `좋습니다! 선택하신 블로그 톤은 **${toneName}** 입니다.\n"시작"이라고 입력하면 템플릿을 안내해드릴게요.`
    );
  };

  /* ---------------- 톤 옵션 ---------------- */
  const toneOptions = [
    { name: "전문가 시점(법률 분석)", desc: "법률·판례 기반의 전문 분석." },
    { name: "경고형 톤", desc: "위험과 주의 메시지를 강조." },
    { name: "친절한 설명형", desc: "초보도 쉽게 이해할 수 있는 말투." },
    { name: "뉴스 기사형", desc: "객관적 보도 스타일." },
    { name: "단호한 대응형", desc: "명확하고 강한 어조." },
    { name: "부드러운 위로형", desc: "감정 공감 & 위로 중심." },
  ];

  /* ---------------- UI ---------------- */
  return (
    <div className="w-screen h-screen flex overflow-hidden relative">
      {/* Tone 선택 시 배경 블러 */}
      {toneModal && currentConv && (
        <div className="absolute inset-0 backdrop-blur-sm bg-black/20 z-20" />
      )}

      {/* Tone 선택 모달 */}
      {toneModal && currentConv && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="bg-white dark:bg-neutral-800 p-8 rounded-2xl w-[420px] shadow-xl">
            <h2 className="text-xl font-bold mb-4 dark:text-white">
              블로그 작성 톤을 선택해주세요 ✍️
            </h2>

            <div className="space-y-3 max-h-[260px] overflow-y-auto">
              {toneOptions.map((t) => (
                <button
                  key={t.name}
                  onClick={() => selectTone(t.name)}
                  className="w-full p-4 text-left bg-indigo-600 dark:bg-neutral-700 text-white rounded-xl"
                >
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-sm opacity-80">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 메인 레이아웃 */}
      <div
        className={`flex flex-1 ${
          toneModal && currentConv ? "pointer-events-none blur-sm" : ""
        }`}
      >
        {/* 사이드바 */}
        <aside className="w-64 bg-white dark:bg-neutral-900 border-r dark:border-neutral-700 p-4 flex flex-col">
          <button
            onClick={() => signOut(auth)}
            className="mb-4 bg-red-500 text-white px-4 py-2 rounded-lg"
          >
            로그아웃
          </button>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="mb-4 bg-indigo-600 text-white px-4 py-2 rounded-lg dark:bg-neutral-700"
          >
            {darkMode ? "🌞 라이트 모드" : "🌙 다크 모드"}
          </button>

          <button
            onClick={addConversation}
            className="mb-4 bg-indigo-600 text-white px-4 py-2 rounded-lg dark:bg-neutral-700"
          >
            + 새 상담
          </button>

          <div className="flex-1 overflow-y-auto space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  setCurrentId(conv.id);
                  setToneModal(!conv.tone);
                }}
                className={`p-3 rounded-lg cursor-pointer ${
                  conv.id === currentId
                    ? "bg-indigo-100 dark:bg-neutral-700 text-indigo-700 dark:text-white"
                    : "bg-gray-100 dark:bg-neutral-800 dark:text-gray-300"
                }`}
              >
                <div className="font-semibold text-sm truncate">
                  {conv.title}
                </div>
                {conv.tone && (
                  <div className="text-xs opacity-70 mt-1">톤: {conv.tone}</div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* 채팅 영역 */}
        {conversations.length === 0 ? (
          <main className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-black text-center px-4">
            <h2 className="text-2xl font-semibold dark:text-white mb-3">
              아직 상담이 없습니다
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              좌측 상단의 <strong>“+ 새 상담”</strong>을 눌러
              <br />
              상담을 시작해 주세요.
            </p>
          </main>
        ) : (
          <main className="flex-1 flex flex-col bg-gray-50 dark:bg-black">
            <header className="p-4 border-b dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <h1 className="text-xl font-semibold dark:text-white">
                상담 챗봇
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user.email} 님
              </p>
            </header>

            {/* 메시지 리스트 */}
            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {(currentConv?.messages ?? []).map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-3 rounded-2xl shadow text-sm leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-indigo-600 text-white rounded-br-none"
                        : "bg-white dark:bg-neutral-800 dark:text-gray-200 rounded-bl-none"
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.text || ""}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 text-sm rounded-2xl bg-white dark:bg-neutral-800 shadow">
                    챗봇이 입력 중입니다…
                  </div>
                </div>
              )}
            </div>

            {/* 입력창 */}
            <div className="p-4 border-t dark:border-neutral-700 bg-white dark:bg-neutral-900 flex gap-2">
              <textarea
                ref={textareaRef}
                disabled={!currentConv?.tone}
                className={`flex-1 border px-4 py-2 rounded-xl resize-none overflow-hidden leading-relaxed dark:border-neutral-600 ${
                  currentConv?.tone
                    ? "bg-white dark:bg-neutral-800 dark:text-white"
                    : "bg-gray-300 dark:bg-neutral-700 cursor-not-allowed"
                }`}
                placeholder={
                  currentConv?.tone
                    ? 'Shift + Enter = 줄바꿈 / Enter = 전송\n"시작"을 입력하면 템플릿이 나와요.'
                    : "먼저 블로그 톤을 선택해주세요"
                }
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = textareaRef.current;
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = el.scrollHeight + "px";
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (e.shiftKey) return;
                    e.preventDefault();
                    sendMessage(input);

                    const el = textareaRef.current;
                    if (el) el.style.height = "auto";
                  }
                }}
              />

              <button
                onClick={() => sendMessage(input)}
                disabled={!currentConv?.tone}
                className="px-5 py-2 rounded-xl bg-indigo-600 dark:bg-neutral-700 text-white disabled:opacity-40"
              >
                전송
              </button>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
