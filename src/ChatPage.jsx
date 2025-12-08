import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";

export default function ChatPage({ user }) {
  /* ---------------- 상태 ---------------- */
  const [darkMode, setDarkMode] = useState(false);
  const [toneModal, setToneModal] = useState(true); // ⭐ 모달 ON
  const [conversations, setConversations] = useState([
    {
      id: 1,
      title: "오늘 상담",
      tone: null,
      messages: [],
    },
  ]);

  const [currentId, setCurrentId] = useState(1);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatRef = useRef(null);
  const currentConv = conversations.find((c) => c.id === currentId);

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

  /* ---------------- 자동 스크롤 ---------------- */
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [currentConv?.messages, loading]);

  /* ---------------- 상담 추가 ---------------- */
  const addConversation = () => {
    const newId = Date.now();
    setConversations((prev) => [
      ...prev,
      {
        id: newId,
        title: "새 상담",
        tone: null,
        messages: [],
      },
    ]);
    setCurrentId(newId);
    setToneModal(true); // 🔥 새 상담 시작 시 다시 모달 띄움
  };

  /* ---------------- 제목 자동 생성 ---------------- */
  const buildMessagesForApi = (conv) =>
    conv.messages.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));

  const generateTitle = async (conversationId) => {
    try {
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv || conv.messages.length < 3) return;

      const res = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: buildMessagesForApi(conv),
        }),
      });

      const data = await res.json();
      if (data.title) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, title: data.title.trim() } : c
          )
        );
      }
    } catch (err) {
      console.error("제목 생성 오류:", err);
    }
  };

  /* ---------------- GPT 분기 ---------------- */
  const requestGpt = async (conversationId, messagesForApi) => {
    const lastMessage = messagesForApi[messagesForApi.length - 1]?.content?.trim();
    const tone = currentConv?.tone;

    /* 1️⃣ "시작" → 템플릿 */
    if (lastMessage === "시작") {
      const res = await fetch("/api/law/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesForApi }),
      });
      return await res.text();
    }

    /* 2️⃣ 템플릿 채워짐 → 블로그 본문 생성 */
    const isTemplateFilled =
      /✅키워드:\s*\S+/i.test(lastMessage) ||
      /✅사기내용:\s*\S+/i.test(lastMessage) ||
      /✅구성선택:\s*[1-7]/i.test(lastMessage);

    if (isTemplateFilled) {
      const res = await fetch("/api/law/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForApi,
          tone, // ⭐ 톤 전달
        }),
      });

      const data = await res.json();
      return data.reply;
    }

    /* 3️⃣ 일반 상담 */
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
    if (!text.trim() || !currentConv || !currentConv.tone || loading) return;

    const activeId = currentId;
    const userMsg = { id: Date.now(), sender: "user", text };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId ? { ...c, messages: [...c.messages, userMsg] } : c
      )
    );
    setInput("");

    setLoading(true);
    try {
      const conv = conversations.find((c) => c.id === activeId);
      const tempConv = { ...conv, messages: [...conv.messages, userMsg] };

      const reply = await requestGpt(activeId, buildMessagesForApi(tempConv));

      const botMsg = { id: Date.now() + 1, sender: "bot", text: reply };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId ? { ...c, messages: [...c.messages, botMsg] } : c
        )
      );

      generateTitle(activeId);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- 톤 선택 ---------------- */
  const selectTone = (toneName) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentId ? { ...c, tone: toneName } : c
      )
    );

    setToneModal(false);

    // 선택 후 첫 메시지
    const botMsg = {
      id: Date.now(),
      sender: "bot",
      text: `좋습니다! 선택하신 블로그 톤은 **${toneName}** 입니다.\n이제 "시작"이라고 입력하면 템플릿을 안내해드릴게요.`,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentId ? { ...c, messages: [botMsg] } : c
      )
    );
  };

  /* ---------------- 톤 설명 리스트 ---------------- */
  const toneOptions = [
    {
      name: "전문가 시점(법률 분석)",
      desc: "판례·법률 조항 기반으로 구조적인 분석을 제공합니다.",
    },
    {
      name: "경고형 톤",
      desc: "피해 위험성을 강조하며 경고성 표현을 포함합니다.",
    },
    {
      name: "친절한 설명형",
      desc: "초보 독자도 이해하도록 쉽게 풀어 설명합니다.",
    },
    {
      name: "뉴스 기사형",
      desc: "사실 기반, 보도 스타일의 글을 작성합니다.",
    },
    {
      name: "단호한 대응형",
      desc: "확신에 찬 문체로 대응 방향을 제시합니다.",
    },
    {
      name: "부드러운 위로형",
      desc: "피해자의 감정을 위로하고 공감하며 안내합니다.",
    },
  ];

  /* ---------------- UI ---------------- */
  return (
    <div className="w-screen h-screen flex overflow-hidden relative">

      {/* 🔹 화면 흐림 효과 (톤 선택 전) */}
      {toneModal && (
        <div className="absolute inset-0 backdrop-blur-sm bg-black/20 z-20"></div>
      )}

      {/* 🔹 톤 선택 모달 */}
      {toneModal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-xl w-[420px]">
            <h2 className="text-xl font-bold mb-4 dark:text-white">
              블로그 작성 톤을 선택해주세요 ✍️
            </h2>

            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
              {toneOptions.map((t) => (
                <button
                  key={t.name}
                  onClick={() => selectTone(t.name)}
                  className="w-full text-left p-4 rounded-xl bg-indigo-600 text-white dark:bg-neutral-700"
                >
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-sm opacity-80 mt-1">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🔹 메인 전체 UI (흐림 적용 영역) */}
      <div className={`flex flex-1 ${toneModal ? "pointer-events-none blur-sm" : ""}`}>
        
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

          <div className="flex-1 overflow-y-auto space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setCurrentId(conv.id)}
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

        {/* 🔹 채팅 영역 */}
        <main className="flex-1 flex flex-col bg-gray-50 dark:bg-black">

          {/* 헤더 */}
          <header className="p-4 border-b dark:border-neutral-700 bg-white dark:bg-neutral-900">
            <h1 className="text-xl font-semibold dark:text-white">상담 챗봇</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {user.email} 님
            </p>
          </header>

          {/* 메시지 영역 */}
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            {currentConv?.messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] px-4 py-3 rounded-2xl shadow ${
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
                <div className="px-4 py-3 bg-white dark:bg-neutral-800 rounded-2xl shadow">
                  챗봇이 입력 중입니다…
                </div>
              </div>
            )}
          </div>

          {/* 입력창 */}
          <div className="p-4 border-t dark:border-neutral-700 bg-white dark:bg-neutral-900 flex gap-2">
            <input
              type="text"
              disabled={!currentConv.tone}
              className={`flex-1 border px-4 py-2 rounded-xl dark:border-neutral-600 ${
                currentConv.tone
                  ? "bg-white dark:bg-neutral-800 dark:text-white"
                  : "bg-gray-300 dark:bg-neutral-700 cursor-not-allowed"
              }`}
              placeholder={
                currentConv.tone
                  ? "메시지를 입력하세요…"
                  : "먼저 블로그 톤을 선택해주세요"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            />

            <button
              onClick={() => sendMessage(input)}
              disabled={!currentConv.tone}
              className="px-5 py-2 rounded-xl bg-indigo-600 dark:bg-neutral-700 text-white disabled:opacity-40"
            >
              전송
            </button>
          </div>

        </main>
      </div>
    </div>
  );
}
