import { useEffect, useState, useRef } from "react";

export default function App() {
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
          text: "안녕하세요! 😊 법무법인 나란 챗봇입니다.\n무엇을 도와드릴까요?",
        },
      ],
    },
  ]);
  const [currentId, setCurrentId] = useState(1);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // GPT 응답 로딩
  const [error, setError] = useState("");        // 에러 메시지

  const chatRef = useRef(null);

  const currentConv = conversations.find((c) => c.id === currentId);

  // 저장된 테마 불러오기
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  // 다크모드 전환
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // 자동 스크롤
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [currentConv?.messages, loading]);

  // 새 상담 생성
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

  // 제목 업데이트
  const updateTitle = (id, title) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  };

  // 현재 대화를 GPT용 messages 배열로 변환
  const buildMessagesForApi = (conv) =>
    conv.messages.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));

  // 제목 자동 생성
  const generateTitle = async (conversationId) => {
    try {
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv) return;

      // 이미 제목 있으면 스킵
      if (!["새 상담", "오늘 상담"].includes(conv.title)) return;
      if (conv.messages.length < 3) return; // 대화가 너무 짧으면 스킵

      const messagesForApi = buildMessagesForApi(conv);

      const res = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForApi,
          category: conv.category,
        }),
      });

      if (!res.ok) return;

      const data = await res.json();
      if (!data.title) return;

      updateTitle(conversationId, data.title.trim());
    } catch (err) {
      console.error("제목 생성 오류:", err);
    }
  };

  // GPT 답변 요청
  const requestGpt = async (conversationId, category, messagesForApi) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messagesForApi,
        category: category || null,
      }),
    });

    if (!res.ok) {
      throw new Error("서버와 통신 중 오류가 발생했습니다.");
    }

    const data = await res.json();
    if (!data.reply) {
      throw new Error("챗봇 응답을 가져오지 못했습니다.");
    }
    return data.reply;
  };

  // 메시지 전송
  const sendMessage = async (text) => {
    if (!text.trim() || !currentConv || loading) return;

    setError("");
    const activeId = currentId;
    const userMsg = {
      id: Date.now(),
      sender: "user",
      text,
    };

    // 1) 사용자 메시지 추가
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeId
          ? { ...conv, messages: [...conv.messages, userMsg] }
          : conv
      )
    );
    setInput("");

    setLoading(true);
    try {
      // 최신 상태의 대화 가져오기 (추가된 user 메시지 포함)
      const conv = conversations.find((c) => c.id === activeId);
      const tempConv = conv
        ? { ...conv, messages: [...conv.messages, userMsg] }
        : null;

      if (!tempConv) throw new Error("대화를 찾을 수 없습니다.");

      const messagesForApi = buildMessagesForApi(tempConv);

      // 2) GPT 호출
      const replyText = await requestGpt(
        activeId,
        tempConv.category,
        messagesForApi
      );

      const botMsg = {
        id: Date.now() + 1,
        sender: "bot",
        text: replyText,
      };

      // 3) GPT 메시지 추가
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeId
            ? { ...conv, messages: [...conv.messages, botMsg] }
            : conv
        )
      );

      // 4) 제목 자동 생성 시도
      generateTitle(activeId);
    } catch (err) {
      console.error(err);
      setError(err.message || "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 빠른 사건 유형 선택
  const chooseCategory = (cat) => {
    if (!currentConv) return;
    const activeId = currentId;

    // 1) 카테고리 저장
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeId ? { ...conv, category: cat } : conv
      )
    );

    // 2) 유저 메시지로도 남기기
    sendMessage(`사건 유형: ${cat}`);
  };

  return (
    <div className="w-screen h-screen flex overflow-hidden bg-gray-100 dark:bg-[#0f0f0f]">

      {/* 🔹 왼쪽 사이드바 */}
      <aside className="w-64 bg-white dark:bg-[#1a1a1a] border-r dark:border-neutral-700 flex flex-col p-4">
        {/* 다크모드 버튼 */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="mb-4 bg-indigo-600 dark:bg-neutral-700 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-neutral-600 transition"
        >
          {darkMode ? "🌞 라이트 모드" : "🌙 다크 모드"}
        </button>

        {/* 새 상담 */}
        <button
          onClick={addConversation}
          className="bg-indigo-600 dark:bg-neutral-700 text-white px-4 py-2 rounded-lg mb-4 hover:bg-indigo-700 dark:hover:bg-neutral-600 transition"
        >
          + 새 상담
        </button>

        {/* 상담 목록 */}
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setCurrentId(conv.id)}
              className={`p-3 rounded-lg cursor-pointer transition ${
                currentId === conv.id
                  ? "bg-indigo-100 text-indigo-700 dark:bg-neutral-700 dark:text-white"
                  : "bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700"
              }`}
            >
              <div className="text-sm font-semibold truncate">{conv.title}</div>
              {conv.category && (
                <div className="text-xs mt-1 opacity-80">
                  유형: {conv.category}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* 🔹 오른쪽 메인 영역 */}
      <main className="flex-1 flex flex-col bg-white dark:bg-black">

        {/* 헤더 */}
        <header className="p-4 border-b bg-white dark:bg-[#1a1a1a] dark:border-neutral-700 shadow flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold dark:text-white">상담 챗봇</h1>
            {currentConv?.category && (
              <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                사건 유형: {currentConv.category}
              </p>
            )}
          </div>
          {error && (
            <span className="text-xs text-red-500 max-w-xs text-right">
              ⚠ {error}
            </span>
          )}
        </header>

        {/* 메시지 영역 */}
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-black"
        >
          {currentConv?.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] px-4 py-3 rounded-2xl whitespace-pre-line shadow transition ${
                  msg.sender === "user"
                    ? "bg-indigo-500 text-white rounded-br-none"
                    : "bg-white dark:bg-neutral-800 dark:text-gray-200 rounded-bl-none"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {/* GPT 타이핑 중 표시 */}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[60%] px-4 py-3 rounded-2xl bg-white dark:bg-neutral-800 dark:text-gray-200 shadow rounded-bl-none flex items-center gap-2 text-sm">
                <span>챗봇이 입력 중입니다…</span>
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.15s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.3s]"></span>
                </span>
              </div>
            </div>
          )}

          {/* 빠른 사건유형 선택 */}
          <div className="flex gap-2 flex-wrap mt-6">
            {["민사", "형사", "가사", "노동", "기타"].map((cat) => (
              <button
                key={cat}
                disabled={loading}
                onClick={() => chooseCategory(cat)}
                className="bg-white dark:bg-neutral-800 dark:text-gray-200 border px-4 py-2 rounded-full shadow-sm hover:bg-indigo-50 dark:hover:bg-neutral-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="p-4 bg-white dark:bg-[#1a1a1a] border-t dark:border-neutral-700 flex gap-2">
          <input
            type="text"
            className="flex-1 border dark:border-neutral-600 rounded-xl px-4 py-2 focus:outline-indigo-500 bg-white dark:bg-neutral-800 dark:text-white"
            placeholder={loading ? "챗봇이 응답 중입니다…" : "메시지를 입력하세요…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage(input)}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading}
            className="bg-indigo-600 dark:bg-neutral-700 text-white px-5 py-2 rounded-xl hover:bg-indigo-700 dark:hover:bg-neutral-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            전송
          </button>
        </div>
      </main>
    </div>
  );
}
