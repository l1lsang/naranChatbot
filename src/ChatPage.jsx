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
  const textareaRef = useRef(null);
  const chatRef = useRef(null);

  /* ---------------- State ---------------- */
  const [darkMode, setDarkMode] = useState(false);
  const [toneModal, setToneModal] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);
const [projects, setProjects] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
const [currentProjectId, setCurrentProjectId] = useState(null);

  const currentConv = conversations.find((c) => c.id === currentId);

  /* ---------------- Load Conversations ---------------- */
  /* ---------------- Load Conversations (Project Filtered) ---------------- */
useEffect(() => {
  if (!user?.uid) return;

  const uid = user.uid;

  // 프로젝트 선택 안했으면 상담 안 보이게
  if (!currentProjectId) {
    setConversations([]);
    return;
  }

  // 특정 프로젝트의 상담만 로드
  const convRef = query(
    collection(db, "users", uid, "conversations"),
    where("projectId", "==", currentProjectId)
  );

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
        projectId: data.projectId || null,
        createdAt: data.createdAt,
        messages,
      });
    }

    list.sort(
      (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );

    setConversations(list);
  });

  return () => unsubscribe();
}, [user, currentProjectId]);

/* ---------------- Load Projects ---------------- */
useEffect(() => {
  if (!user?.uid) return;

  const uid = user.uid;
  const projRef = collection(db, "users", uid, "projects");

  const unsubscribe = onSnapshot(projRef, (snap) => {
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );

    setProjects(list);
  });

  return () => unsubscribe();
}, [user]);

  /* ---------------- Auto Select Conversation ---------------- */
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
    if (conv) setToneModal(!conv.tone);
  }, [conversations, currentId]);

  /* ---------------- Auto Scroll ---------------- */
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [currentConv?.messages, loading]);

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

  /* ---------------- Create New Conversation ---------------- */
const addConversation = async () => {
  const uid = user.uid;
  const newId = Date.now().toString();

  // 선택된 프로젝트의 systemPrompt 불러오기
  let systemPrompt = "";
  if (currentProjectId) {
    const projSnap = await getDoc(
      doc(db, "users", uid, "projects", currentProjectId)
    );
    systemPrompt = projSnap.data()?.systemPrompt || "";
  }

  await setDoc(doc(db, "users", uid, "conversations", newId), {
  title: "새 상담",
  tone: null,
  projectId: currentProjectId,     // ⭐ 어떤 프로젝트의 상담인가
  systemPrompt,                    // 이전 메시지에서 만들어둔 프롬프트 적용
  createdAt: serverTimestamp(),
});


    setCurrentId(newId);
    setToneModal(true);
  };
/* ---------------- Create New Project ---------------- */
const addProject = async () => {
  const name = window.prompt("프로젝트 이름을 입력해주세요!");
  if (!name || !name.trim()) return;

  const systemPrompt = window.prompt("이 프로젝트의 기본 프롬프트(톤/지시문)를 입력해주세요.\n(나중에도 수정 가능)");

  const uid = user.uid;
  const newId = Date.now().toString();

  await setDoc(doc(db, "users", uid, "projects", newId), {
    name: name.trim(),
    systemPrompt: systemPrompt?.trim() || "",
    createdAt: serverTimestamp(),
  });
};


  /* ---------------- Save Message ---------------- */
  const saveMessage = async (convId, sender, text) => {
    const uid = user.uid;
    const msgId = Date.now().toString();

    await setDoc(
      doc(db, "users", uid, "conversations", convId, "messages", msgId),
      {
        sender,
        text: text ?? "",
        createdAt: serverTimestamp(),
        clientTime: Date.now() / 1000,
      }
    );
  };

  /* ---------------- GPT API ---------------- */
const buildMessagesForApi = (conv) => {
  const msgs = conv.messages.map((m) => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text,
  }));

  // ⭐ 프로젝트/상담의 systemPrompt가 있으면 맨 앞에 삽입
  if (conv.systemPrompt) {
    return [
      { role: "system", content: conv.systemPrompt },
      ...msgs,
    ];
  }

  return msgs;
};


  const requestGpt = async (convId, messagesForApi) => {
  const last = messagesForApi[messagesForApi.length - 1]?.content?.trim();

  // =========================================================
  // 1) "시작" 입력 → 시작 템플릿 (/api/law/start)
  // =========================================================
  if (last === "시작") {
    const res = await fetch("/api/law/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesForApi }),
    });

    const data = await res.json();
    return data.reply;
  }

  // =========================================================
  // 2) 템플릿 3줄 중 하나라도 채워짐 → /api/law/blog
  // =========================================================
  const isStartTemplateFilled =
    /✅키워드:\s*\S+/i.test(last) ||
    /✅사기내용:\s*\S+/i.test(last) ||
    /✅구성선택:\s*[1-7]/i.test(last);

  if (isStartTemplateFilled) {
    const res = await fetch("/api/law/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesForApi }),
    });

    const data = await res.json();
    return data.reply;
  }

  // =========================================================
  // 3) 나머지 → 일반 GPT (/api/chat)
  // =========================================================
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: messagesForApi }),
  });

  const data = await res.json();
  return data.reply;
};


  /* ---------------- Send Message ---------------- */
  const sendMessage = async (text) => {
  if (!text.trim() || !currentConv?.tone || loading) return;

  const convId = currentId;

  // 1) User 메시지 Firestore 저장
  await saveMessage(convId, "user", text);

  // 2) UI 즉시 반영
  setConversations(prev =>
    prev.map(c =>
      c.id === convId
        ? {
            ...c,
            messages: [
              ...c.messages,
              {
                id: "temp-" + Date.now(),
                sender: "user",
                text,
                createdAt: { seconds: Date.now() / 1000 },
              },
            ],
          }
        : c
    )
  );

  // -----------------------------------------
  // ⭐⭐⭐ "시작" 입력 시 즉시 템플릿UI 출력 ⭐⭐⭐
  // -----------------------------------------
  if (text.trim() === "시작") {
    // GPT 호출 안 기다리고 바로 화면에 템플릿 넣기
    const template = 
`✅키워드:
✅사기내용:
✅구성선택:
  
1\\. 사기 개연성을 중심으로 한 글
2\\. 주의해야할 위험요소에 대해 디테일하게 분석한 글
3\\. 실제로 드러난 정황을 바탕으로 경고형 분석한 글
4\\. 피해예방과 도움이 되는 내용을 중점으로 쓴 글
5\\. 법적 지식과 판례에 관해 전문가의 시점으로 쓴 글
6\\. 웹사이트 검색 기반으로 실제 뉴스와 실제 사례들을 토대로 한 글
7\\. 실제 피해 사례를 중점으로 한 글`;

    // UI에 즉시 출력
    setConversations(prev =>
      prev.map(c =>
        c.id === convId
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: "temp-bot-" + Date.now(),
                  sender: "bot",
                  text: template,
                  createdAt: { seconds: Date.now() / 1000 },
                },
              ],
            }
          : c
      )
    );

    // Firestore에도 저장(중요!)
    await saveMessage(convId, "bot", template);

    // 입력창 초기화 + 로딩 제거
    setInput("");
    setLoading(false);

    return;
  }

  // -----------------------------------------
  // ⭐⭐⭐ 그 외에는 기존 로직대로 GPT 호출 ⭐⭐⭐
  // -----------------------------------------

  setLoading(true);

  try {
    const conv = conversations.find((c) => c.id === convId);
    const tempConv = {
      ...conv,
      messages: [...conv.messages, { sender: "user", text }],
    };

    const reply = await requestGpt(convId, buildMessagesForApi(tempConv));

    // Firestore에 bot 메시지 저장
    await saveMessage(convId, "bot", reply);

    // UI 반영
    setConversations(prev =>
      prev.map(c =>
        c.id === convId
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: "temp-bot-" + Date.now(),
                  sender: "bot",
                  text: reply,
                  createdAt: { seconds: Date.now() / 1000 },
                },
              ],
            }
          : c
      )
    );
  } finally {
    setLoading(false);
    setInput("");
    textareaRef.current.style.height = "auto";
  }
};


  /* ---------------- Tone Select ---------------- */
  const selectTone = async (toneName) => {
    const uid = user.uid;

    await updateDoc(doc(db, "users", uid, "conversations", currentId), {
      tone: toneName,
    });

    setTimeout(() => setToneModal(false), 30);

    await saveMessage(
      currentId,
      "bot",
      `좋습니다! 선택하신 블로그 톤은 **${toneName}** 입니다.\n"시작"이라고 입력하면 템플릿을 안내해드릴게요.`
    );
  };

  /* ---------------- Tone Options ---------------- */
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

      {/* Tone Modal Background */}
      {toneModal && currentConv && (
        <div className="absolute inset-0 backdrop-blur-sm bg-black/20 z-20"></div>
      )}

      {/* Tone Modal */}
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

      {/* Main layout */}
      <div
        className={`flex flex-1 ${
          toneModal && currentConv ? "pointer-events-none blur-sm" : ""
        }`}
      >
        {/* Sidebar */}
{/* Sidebar */}
<aside className="w-64 bg-white dark:bg-neutral-900 border-r dark:border-neutral-700 p-4 flex flex-col justify-between">

  {/* 🔼 상단 전체 영역 */}
  <div>

    {/* 🌙 다크모드 토글 */}
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="mb-4 w-full bg-indigo-600 text-white px-4 py-2 rounded-lg dark:bg-neutral-700"
    >
      {darkMode ? "🌞 라이트 모드" : "🌙 다크 모드"}
    </button>

    {/* 🧩 프로젝트 섹션 (상담보다 위) */}
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <span>프로젝트</span>

        <button
          onClick={addProject}
          className="text-[11px] px-2 py-1 rounded bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100"
        >
          + 새 프로젝트
        </button>
      </div>

      {/* 프로젝트 목록 */}
      <div className="space-y-2 max-h-[22vh] overflow-y-auto">
        {projects.length === 0 ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            프로젝트가 없습니다.
          </p>
        ) : (
          projects.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                setCurrentProjectId(p.id);
                setConversations([]);
                setCurrentId(null);
              }}
              className={`
                p-3 rounded-xl cursor-pointer transition border 
                ${
                  currentProjectId === p.id
                    ? "bg-indigo-50 dark:bg-neutral-700 border-indigo-300 dark:border-neutral-500 text-indigo-800 dark:text-white"
                    : "bg-gray-100 dark:bg-neutral-800 border-transparent text-gray-700 dark:text-gray-300"
                }
              `}
            >
              <div className="font-semibold text-sm truncate">{p.name}</div>
              <div className="text-[10px] opacity-60 mt-1">프로젝트 선택</div>
            </div>
          ))
        )}
      </div>
    </div>

    {/* 📂 상담 섹션 */}
    <div>
      <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <span>상담</span>

        <button
          onClick={addConversation}
          disabled={!currentProjectId}
          className={`text-[11px] px-2 py-1 rounded 
            ${
              currentProjectId
                ? "bg-indigo-100 text-indigo-700 dark:bg-neutral-700 dark:text-neutral-100"
                : "bg-gray-200 dark:bg-neutral-800 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          + 새 상담
        </button>
      </div>

      {/* 상담 목록 */}
      {!currentProjectId ? (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          프로젝트를 먼저 선택하세요.
        </p>
      ) : (
        <div className="overflow-y-auto space-y-2 max-h-[40vh]">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => {
                setCurrentId(conv.id);
                setToneModal(!conv.tone);
              }}
              className={`
                p-3 rounded-lg cursor-pointer transition 
                ${
                  conv.id === currentId
                    ? "bg-indigo-100 dark:bg-neutral-700 text-indigo-700 dark:text-white"
                    : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300"
                }
              `}
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
      )}
    </div>
  </div>

  {/* 🔽 하단 : 이메일 + 로그아웃 */}
  <div className="mt-6 border-t pt-4 dark:border-neutral-700">
    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 break-all">
      {user?.email}
    </p>

    <button
      onClick={() => signOut(auth)}
      className="w-full bg-red-500 text-white px-4 py-2 rounded-lg"
    >
      로그아웃
    </button>
  </div>
</aside>

        {/* Chat Area */}
        {!currentConv ? (
          <main className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-black text-center px-4">
            <h2 className="text-2xl font-semibold dark:text-white mb-3">
              아직 상담이 없습니다
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              좌측 상단의 <strong>“+ 새 상담”</strong>을 눌러<br />
              상담을 시작하세요.
            </p>
          </main>
        ) : (
          <main className="flex-1 flex flex-col bg-gray-50 dark:bg-black">
            <header className="p-4 border-b dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <h1 className="text-xl font-semibold dark:text-white">상담 챗봇</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user.email} 님
              </p>
            </header>

            {/* Messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              {(currentConv.messages ?? []).map((msg) => (
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
                    <ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    p: ({ children }) => (
      <p className="whitespace-pre-line">{children}</p>
    ),
  }}
>
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

            {/* Input */}
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
                  if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                    textareaRef.current.style.height =
                      textareaRef.current.scrollHeight + "px";
                  }
                }}
                onKeyDown={(e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const trimmed = input.trim();
    if (!trimmed) return;

    // 1) ⭐ 엔터 누르는 순간 input 먼저 비우기
    setInput("");

    // 2) ⭐ textarea 높이 즉시 재설정
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // 3) ⭐ 원본 텍스트로 메시지 전송
    sendMessage(trimmed);
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
