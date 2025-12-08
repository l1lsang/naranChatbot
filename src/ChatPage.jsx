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
  /* ---------------- Ref ---------------- */
  const textareaRef = useRef(null);
  const chatRef = useRef(null);

  /* ---------------- 상태 ---------------- */
  const [darkMode, setDarkMode] = useState(false);
  const [toneModal, setToneModal] = useState(false); // 🔥 기본값: false (처음엔 모달 X)
  const [conversations, setConversations] = useState([]); // 🔥 자동 상담 생성 X
  const [currentId, setCurrentId] = useState(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const currentConv = conversations.find((c) => c.id === currentId);

  /* ---------------- Firestore에서 상담 데이터 로드 ---------------- */
  useEffect(() => {
    if (!user?.uid) return;

    const uid = user.uid;
    const convRef = collection(db, "users", uid, "conversations");

    const unsubscribe = onSnapshot(convRef, async (snap) => {
      let list = [];

      for (let c of snap.docs) {
        const convId = c.id;
        const data = c.data();

        // 메시지 불러오기
        const msgSnap = await getDocs(
          collection(db, "users", uid, "conversations", convId, "messages")
        );

        const messages = msgSnap.docs
          .map((m) => ({ id: m.id, ...m.data() }))
          .sort(
            (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
          );

        list.push({
          id: convId,
          title: data.title || "상담",
          tone: data.tone || null,
          createdAt: data.createdAt,
          messages,
        });
      }

      // 최신 상담 순으로 정렬
      list.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );
      setConversations(list);
    });

    return () => unsubscribe();
  }, [user]);

  /* ---------------- 대화 리스트 변동 시 초기 선택/모달 처리 ---------------- */
  useEffect(() => {
    // 상담이 하나도 없으면 선택 해제 + 모달 닫기
    if (conversations.length === 0) {
      setCurrentId(null);
      setToneModal(false);
      return;
    }

    // 상담은 있는데 아직 선택된 방이 없으면 첫 번째 상담 자동 선택
    if (!currentId && conversations.length > 0) {
      const first = conversations[0];
      setCurrentId(first.id);
      setToneModal(!first.tone); // 톤 없으면 모달 열기
      return;
    }

    // 선택된 방이 있는데, 그 방이 톤이 없는 상태라면 모달 열기
    const conv = conversations.find((c) => c.id === currentId);
    if (conv && !conv.tone) {
      setToneModal(true);
    }
  }, [conversations, currentId]);

  /* ---------------- 자동 스크롤 ---------------- */
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [currentConv?.messages, loading]);

  /* ---------------- 다크모드 ---------------- */
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

  /* ---------------- 새 상담 추가 ---------------- */
  const addConversation = async () => {
    const uid = user.uid;
    const newId = Date.now().toString();

    await setDoc(doc(db, "users", uid, "conversations", newId), {
      title: "새 상담",
      tone: null,
      createdAt: serverTimestamp(),
    });

    setCurrentId(newId);
    setToneModal(true); // 새 상담 → 톤 선택 모달 띄우기
  };

  /* ---------------- Firestore 메시지 저장 ---------------- */
  const saveMessage = async (convId, sender, text) => {
    const uid = user.uid;
    const msgId = Date.now().toString();

    await setDoc(
      doc(db, "users", uid, "conversations", convId, "messages", msgId),
      {
        sender,
        text,
        createdAt: serverTimestamp(),
      }
    );
  };

  /* ---------------- GPT 요청 메시지 변환 ---------------- */
  const buildMessagesForApi = (conv) =>
    conv.messages.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));

  /* ---------------- GPT 요청 분기 ---------------- */
  const requestGpt = async (convId, messagesForApi) => {
    const last = messagesForApi[messagesForApi.length - 1]?.content?.trim();
    const tone = currentConv?.tone;

    // 1) "시작" → 템플릿 출력
    if (last === "시작") {
      const res = await fetch("/api/law/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesForApi }),
      });
      return await res.text();
    }

    // 2) 템플릿 채워짐 → blog API
    const isFilled =
      /✅키워드:\s*\S+/i.test(last) ||
      /✅사기내용:\s*\S+/i.test(last) ||
      /✅구성선택:\s*[1-7]/i.test(last);

    if (isFilled) {
      const res = await fetch("/api/law/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForApi,
          tone,
        }),
      });

      const data = await res.json();
      return data.reply;
    }

    // 3) 일반 상담 기본 API
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesForApi }),
    });

    const data = await res.json();
    return data.reply;
  };

  /* ---------------- 메시지 전송 ---------------- */
  const sendMessage = async (text) => {
    if (!text.trim() || !currentConv?.tone || loading) return;
    const convId = currentId;

    // 유저 메시지 저장
    await saveMessage(convId, "user", text);

    setLoading(true);

    try {
      const conv = conversations.find((c) => c.id === convId);
      const tempConv = {
        ...conv,
        messages: [...conv.messages, { sender: "user", text }],
      };

      const reply = await requestGpt(convId, buildMessagesForApi(tempConv));

      // 봇 메시지 저장
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

    setToneModal(false);

    await saveMessage(
      currentId,
      "bot",
      `좋습니다! 선택하신 블로그 톤은 **${toneName}** 입니다.\n이제 "시작"이라고 입력하면 템플릿을 안내해드릴게요.`
    );
  };

  /* ---------------- 톤 옵션 ---------------- */
  const toneOptions = [
    { name: "전문가 시점(법률 분석)", desc: "판례·법률 중심으로 구조적인 분석." },
    { name: "경고형 톤", desc: "주의 환기, 피해 위험을 강하게 경고." },
    { name: "친절한 설명형", desc: "처음 보는 사람도 이해하기 쉽게 설명." },
    { name: "뉴스 기사형", desc: "보도 기사처럼 객관적, 사실 위주로 작성." },
    { name: "단호한 대응형", desc: "단호한 어조로 대응 방향을 분명하게 제시." },
    { name: "부드러운 위로형", desc: "피해자 감정에 공감하며 위로 중심." },
  ];

  /* ---------------- UI ---------------- */
  return (
    <div className="w-screen h-screen flex overflow-hidden relative">
      {/* 🔹 톤 선택 모달 배경 (상담방이 있을 때만) */}
      {toneModal && conversations.length > 0 && (
        <div className="absolute inset-0 backdrop-blur-sm bg-black/20 z-20" />
      )}

      {/* 🔹 톤 선택 모달 (상담방이 있을 때만) */}
      {toneModal && conversations.length > 0 && (
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

      {/* 🔹 전체 레이아웃 (톤 모달 시 blur + 클릭 차단) */}
      <div
        className={`flex flex-1 ${
          toneModal && conversations.length > 0 ? "pointer-events-none blur-sm" : ""
        }`}
      >
        {/* 🔹 사이드바 */}
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

          {/* 상담 목록 */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  setCurrentId(conv.id);
                  if (!conv.tone) setToneModal(true);
                  else setToneModal(false);
                }}
                className={`p-3 rounded-lg cursor-pointer ${
                  conv.id === currentId
                    ? "bg-indigo-100 dark:bg-neutral-700 text-indigo-700 dark:text-white"
                    : "bg-gray-100 dark:bg-neutral-800 dark:text-gray-300"
                }`}
              >
                <div className="font-semibold text-sm truncate">{conv.title}</div>
                {conv.tone && (
                  <div className="text-xs opacity-70 mt-1">톤: {conv.tone}</div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* 🔹 메인 영역 */}
        {conversations.length === 0 ? (
          // ✅ 첫 화면: 상담이 없을 때
          <main className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-black text-center px-4">
            <h2 className="text-2xl font-semibold dark:text-white mb-3">
              아직 상담이 없습니다
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              좌측 상단의 <span className="font-semibold">“+ 새 상담”</span> 버튼을 눌러<br />
              새로운 상담을 시작해 주세요.
            </p>
          </main>
        ) : (
          // ✅ 상담이 하나 이상 있을 때 → 채팅 UI
          <main className="flex-1 flex flex-col bg-gray-50 dark:bg-black">
            {/* 헤더 */}
            <header className="p-4 border-b dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <h1 className="text-xl font-semibold dark:text-white">상담 챗봇</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user.email} 님
              </p>
            </header>

            {/* 메시지 리스트 */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              {currentConv?.messages?.map((msg) => (
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
                      {msg.text}
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
                    ? "Shift + Enter = 줄바꿈 / Enter = 전송"
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
                    if (e.shiftKey) return; // 줄바꿈
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
