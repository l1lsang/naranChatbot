import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";

export default function ChatPage({ user }) {
  /* ---------------- 상태 ---------------- */
  const [darkMode, setDarkMode] = useState(false);
  const [conversations, setConversations] = useState([
    {
      id: 1,
      title: "오늘 상담",
      category: null,
      messages: [
        {
          id: 1,
          sender: "bot",
          text: "안녕하세요! 😊 **법무법인 나란 챗봇**입니다.\n무엇을 도와드릴까요?",
        },
      ],
    },
  ]);

  const [currentId, setCurrentId] = useState(1);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  /* ---------------- 새 상담 ---------------- */
  const addConversation = () => {
    const newId = Date.now();
    const newConv = {
      id: newId,
      title: "새 상담",
      category: null,
      messages: [
        {
          id: Date.now(),
          sender: "bot",
          text: "새 상담을 시작합니다.\n어떤 사건인지 선택해주세요!",
        },
      ],
    };
    setConversations((prev) => [...prev, newConv]);
    setCurrentId(newId);
    setError("");
  };

  /* ---------------- 제목 업데이트 ---------------- */
  const updateTitle = (id, title) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  };

  const buildMessagesForApi = (conv) =>
    conv.messages.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));

  /* ---------------- GPT 제목 자동 생성 ---------------- */
  const generateTitle = async (conversationId) => {
    try {
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv) return;

      if (!["새 상담", "오늘 상담"].includes(conv.title)) return;
      if (conv.messages.length < 3) return;

      const res = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: buildMessagesForApi(conv),
          category: conv.category,
        }),
      });

      const data = await res.json();
      if (data.title) updateTitle(conversationId, data.title.trim());
    } catch (err) {
      console.error("제목 생성 오류:", err);
    }
  };

  /* ---------------- GPT API ---------------- */
  const requestGpt = async (conversationId, category, messagesForApi) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messagesForApi,
        category: category || null,
      }),
    });

    if (!res.ok) throw new Error("서버 오류 발생");

    const data = await res.json();
    if (!data.reply) throw new Error("GPT 응답 없음");

    return data.reply;
  };

  /* ---------------- 메시지 전송 ---------------- */
  const sendMessage = async (text) => {
    if (!text.trim() || !currentConv || loading) return;

    setError("");

    const activeId = currentId;
    const userMsg = {
      id: Date.now(),
      sender: "user",
      text,
    };

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

      const reply = await requestGpt(
        activeId,
        tempConv.category,
        buildMessagesForApi(tempConv)
      );

      const botMsg = { id: Date.now() + 1, sender: "bot", text: reply };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId ? { ...c, messages: [...c.messages, botMsg] } : c
        )
      );

      generateTitle(activeId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- 사건 유형 선택 ---------------- */
  const chooseCategory = (cat) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentId ? { ...c, category: cat } : c
      )
    );

    sendMessage(`사건 유형: ${cat}`);
  };

  /* ---------------- UI 렌더 ---------------- */
  return (
    <div className="w-screen h-screen flex overflow-hidden bg-gray-100 dark:bg-[#0f0f0f]">

      {/* 🔹 왼쪽 사이드바 */}
      <aside className="w-64 bg-white dark:bg-[#1a1a1a] border-r dark:border-neutral-700 p-4 flex flex-col">

        {/* 로그아웃 */}
        <button
          onClick={() => signOut(auth)}
          className="mb-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
        >
          로그아웃
        </button>

        {/* 다크모드 */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="mb-4 bg-indigo-600 dark:bg-neutral-700 text-white px-4 py-2 rounded-lg"
        >
          {darkMode ? "🌞 라이트 모드" : "🌙 다크 모드"}
        </button>

        {/* 새 상담 */}
        <button
          onClick={addConversation}
          className="mb-4 bg-indigo-600 dark:bg-neutral-700 text-white px-4 py-2 rounded-lg"
        >
          + 새 상담
        </button>

        {/* 상담 목록 */}
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setCurrentId(conv.id)}
              className={`p-3 rounded-lg cursor-pointer ${
                currentId === conv.id
                  ? "bg-indigo-100 dark:bg-neutral-700 text-indigo-700 dark:text-white"
                  : "bg-gray-100 dark:bg-neutral-800 dark:text-gray-300"
              }`}
            >
              <div className="font-semibold text-sm truncate">{conv.title}</div>

              {conv.category && (
                <div className="text-xs opacity-70">유형: {conv.category}</div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* 🔹 메인 영역 */}
      <main className="flex-1 flex flex-col bg-white dark:bg-black">
        
        {/* 헤더 */}
        <header className="p-4 border-b bg-white dark:bg-[#1a1a1a]">
          <h1 className="text-xl font-semibold dark:text-white">상담 챗봇</h1>
          <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
            {user.email} 님
          </p>
        </header>

        {/* 메시지 영역 */}
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-black"
        >
          {currentConv?.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              
              <div
                className={`max-w-[70%] px-4 py-3 rounded-2xl shadow transition ${
                  msg.sender === "user"
                    ? "bg-indigo-500 text-white rounded-br-none"
                    : "bg-white dark:bg-neutral-800 dark:text-gray-200 rounded-bl-none"
                }`}
              >
                {msg.sender === "user" ? (
                  <p className="whitespace-pre-line">{msg.text}</p>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    className="chat-markdown"
                  >
                    {msg.text}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}

          {/* GPT 입력 중 */}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[60%] px-4 py-3 bg-white dark:bg-neutral-800 rounded-2xl shadow text-sm">
                챗봇이 입력 중입니다…
              </div>
            </div>
          )}

          {/* 사건 유형 선택 */}
          <div className="flex gap-2 mt-6">
            {["민사", "형사", "가사", "노동", "기타"].map((cat) => (
              <button
                key={cat}
                onClick={() => chooseCategory(cat)}
                className="px-4 py-2 border rounded-full bg-white dark:bg-neutral-800 dark:text-gray-200"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 입력창 */}
        <div className="p-4 border-t bg-white dark:bg-neutral-900 flex gap-2">
          <input
            type="text"
            className="flex-1 border dark:border-neutral-600 px-4 py-2 rounded-xl bg-white dark:bg-neutral-800 dark:text-white"
            placeholder="메시지를 입력하세요…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          />
          <button
            onClick={() => sendMessage(input)}
            className="px-5 py-2 rounded-xl bg-indigo-600 dark:bg-neutral-700 text-white"
          >
            전송
          </button>
        </div>
      </main>
    </div>
  );
}
