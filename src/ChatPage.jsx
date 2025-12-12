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
  getDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import img1 from "../src/img/1.png";
import moon from "../src/img/moon.png";
import sun from "../src/img/sun.png";
import p from "../src/img/p.png";
import book from "../src/img/book.png";


/* ---------------------------------------------------------
   ■ 프로젝트 편집 모달
   --------------------------------------------------------- */
function ProjectModal({ open, onClose, project, onSave, onDelete }) {
  const [name, setName] = useState(project?.name || "");
  const [color, setColor] = useState(project?.color || "#6366f1");

  useEffect(() => {
    if (open && project) {
      setName(project.name || "");
      setColor(project.color || "#6366f1");
    }
  }, [open, project]);

  if (!open || !project) return null;

  return (
    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-30 flex items-center justify-center">
      <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl shadow-xl w-[380px]">
        <h2 className="text-lg font-semibold dark:text-white mb-4">
          프로젝트 설정
        </h2>

        {/* 이름 입력 */}
        <div className="mb-4">
          <label className="text-sm text-gray-500 dark:text-gray-400">
            프로젝트 이름
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg border dark:border-neutral-600 dark:bg-neutral-700 dark:text-white"
          />
        </div>

        {/* 컬러 선택 */}
        <div className="mb-4">
          <label className="text-sm text-gray-500 dark:text-gray-400">
            프로젝트 색상
          </label>
          <div className="mt-2 flex gap-3 items-center">
            <HexColorPicker color={color} onChange={setColor} />
            <div
              className="w-12 h-12 rounded-lg border dark:border-neutral-600"
              style={{ background: color }}
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => onDelete(project.id)}
            className="px-4 py-2 text-sm text-red-500"
          >
            프로젝트 삭제
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700 dark:text-white text-sm"
            >
              취소
            </button>
            <button
              onClick={() =>
                onSave(project.id, name.trim() || project.name, color)
              }
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectEditing, setProjectEditing] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const currentConv = conversations.find((c) => c.id === currentId) || null;
  const currentProject =
    projects.find((p) => p.id === currentProjectId) || null;

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

    const unsubscribe = onSnapshot(projRef, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );

      setProjects(list);

      if (list.length === 0) {
        setCurrentProjectId(null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  /* ---------------- Load Conversations ---------------- */
  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;

    let convRef;
    if (currentProjectId) {
      convRef = query(
        collection(db, "users", uid, "conversations"),
        where("projectId", "==", currentProjectId)
      );
    } else {
      convRef = collection(db, "users", uid, "conversations");
    }

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
          title: data.title || "제목 없음",
          tone: data.tone || null,
          projectId: data.projectId || null,
          systemPrompt: data.systemPrompt || "",
          color: data.color || null,
          createdAt: data.createdAt,
          messages,
        });
      }

      list.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );

      setConversations(list);

      if (list.length === 0) {
        setCurrentId(null);
      } else if (currentId && !list.find((c) => c.id === currentId)) {
        setCurrentId(list[0].id);
      }
    });

    return () => unsubscribe();
  }, [user, currentProjectId, currentId]);

  /* ---------------- Auto Scroll ---------------- */
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [currentConv?.messages, loading]);

  /* ---------------- Project CRUD ---------------- */
  const addProject = async () => {
    const name = window.prompt("프로젝트 이름을 입력해주세요!");
    if (!name || !name.trim()) return;

    const uid = user.uid;
    const newId = Date.now().toString();

    await setDoc(doc(db, "users", uid, "projects", newId), {
      name: name.trim(),
      color: "#6366f1",
      systemPrompt: "",
      createdAt: serverTimestamp(),
    });

    setCurrentProjectId(newId);
  };

  const openProjectModal = (project) => {
    setProjectEditing(project);
    setProjectModalOpen(true);
  };

  const saveProjectEdit = async (projectId, name, color) => {
    const uid = user.uid;
    await updateDoc(doc(db, "users", uid, "projects", projectId), {
      name,
      color,
    });

    // 해당 프로젝트에 속한 상담 카드 색 동기화 (선택사항)
    const convSnap = await getDocs(
      query(
        collection(db, "users", uid, "conversations"),
        where("projectId", "==", projectId)
      )
    );

    for (let c of convSnap.docs) {
      await updateDoc(
        doc(db, "users", uid, "conversations", c.id),
        { color }
      );
    }

    setProjectModalOpen(false);
    setProjectEditing(null);
  };

  const deleteProject = async (projectId) => {
    if (
      !window.confirm(
        "정말 이 프로젝트를 삭제할까요?\n해당 프로젝트에 연결된 상담들은 '일반 상담'으로 남아있습니다."
      )
    )
      return;

    const uid = user.uid;

    // 먼저, 해당 프로젝트에 속한 상담들의 projectId를 null로 변경
    const convSnap = await getDocs(
      query(
        collection(db, "users", uid, "conversations"),
        where("projectId", "==", projectId)
      )
    );

    for (let c of convSnap.docs) {
      await updateDoc(
        doc(db, "users", uid, "conversations", c.id),
        {
          projectId: null,
          color: null,
        }
      );
    }

    // 프로젝트 문서 삭제
    await deleteDoc(doc(db, "users", uid, "projects", projectId));

    if (currentProjectId === projectId) {
      setCurrentProjectId(null);
    }

    setProjectModalOpen(false);
    setProjectEditing(null);
  };

  /* ---------------- Conversation CRUD ---------------- */
  const addConversation = async () => {
    const uid = user.uid;
    const newId = Date.now().toString();

    const proj = currentProject;

    await setDoc(doc(db, "users", uid, "conversations", newId), {
      title: "제목 생성 중…",
      tone: null,
      projectId: currentProjectId || null,
      systemPrompt: proj?.systemPrompt || "",
      color: proj?.color || null,
      createdAt: serverTimestamp(),
    });

    const firstMsg = (Date.now() + 1).toString();
    await setDoc(
      doc(db, "users", uid, "conversations", newId, "messages", firstMsg),
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

  const deleteConversation = async (convId) => {
    if (!window.confirm("이 상담을 삭제할까요?")) return;
    const uid = user.uid;

    // 메시지들 삭제
    const msgSnap = await getDocs(
      collection(db, "users", uid, "conversations", convId, "messages")
    );
    for (let m of msgSnap.docs) {
      await deleteDoc(
        doc(db, "users", uid, "conversations", convId, "messages", m.id)
      );
    }

    await deleteDoc(doc(db, "users", uid, "conversations", convId));

    if (currentId === convId) setCurrentId(null);
  };

  const renameConversation = async (convId) => {
    const conv = conversations.find((c) => c.id === convId);
    const title = window.prompt(
      "새로운 상담 제목을 입력해주세요.",
      conv?.title || "상담"
    );
    if (!title || !title.trim()) return;

    const uid = user.uid;
    await updateDoc(doc(db, "users", uid, "conversations", convId), {
      title: title.trim(),
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

  /* ---------------- 제목 자동 생성 (title.js) ---------------- */
  const requestTitle = async (convLike) => {
    try {
      const messages = (convLike.messages || []).map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));

      if (messages.length === 0) return null;

      const category =
        projects.find((p) => p.id === convLike.projectId)?.name || "일반";

      const res = await fetch("/api/law/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, category }),
      });

      const data = await res.json();
      return data.title || null;
    } catch (e) {
      console.error("제목 생성 실패:", e);
      return null;
    }
  };

  /* ---------------- GPT API ---------------- */
  const buildMessagesForApi = (conv) => {
    const msgs = (conv.messages || []).map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));

    if (conv.systemPrompt) {
      return [{ role: "system", content: conv.systemPrompt }, ...msgs];
    }
    return msgs;
  };

  const requestGpt = async (convId, messagesForApi) => {
    const last = messagesForApi[messagesForApi.length - 1]?.content?.trim();
      const isStartTemplateFilled =
    /✅키워드:\s*\S+/i.test(last) ||
    /✅사기내용:\s*\S+/i.test(last) ||
    /✅구성선택:\s*[1-7]/i.test(last);

    // 1) "시작" → 템플릿 (/api/law/start)
    if (last === "시작") {
      const res = await fetch("/api/law/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesForApi }),
      });
      const data = await res.json();
      return data.reply;
    }

    // 2) 템플릿 일부 채워짐 → /api/law/blog
    if (isStartTemplateFilled) {
  const res = await fetch("/api/law/blog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: messagesForApi }),
  });

  const data = await res.json();

  // 🔧 JSON → Markdown 재조립
  const markdown = `
# ${data.title}

${data.intro}

${data.body}

## 결론
${data.conclusion}

${data.summary_table}
`;

  return markdown;
}


    // 3) 일반 대화 → /api/chat
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
    const trimmed = text.trim();

    // 1) user 메시지 저장
    await saveMessage(convId, "user", trimmed);

    // 2) UI 반영
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: [
                ...(c.messages || []),
                {
                  id: "temp-" + Date.now(),
                  sender: "user",
                  text: trimmed,
                  createdAt: { seconds: Date.now() / 1000 },
                },
              ],
            }
          : c
      )
    );

    // "시작" → 템플릿만 바로 출력
    if (trimmed === "시작") {
      const template = `✅키워드:
✅사기내용:
✅구성선택:
  
1\\. 사기 개연성을 중심으로 한 글
2\\. 주의해야할 위험요소에 대해 디테일하게 분석한 글
3\\. 실제로 드러난 정황을 바탕으로 경고형 분석한 글
4\\. 피해예방과 도움이 되는 내용을 중점으로 쓴 글
5\\. 법적 지식과 판례에 관해 전문가의 시점으로 쓴 글
6\\. 웹사이트 검색 기반으로 실제 뉴스와 실제 사례들을 토대로 한 글
7\\. 실제 피해 사례를 중점으로 한 글`;

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [
                  ...(c.messages || []),
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

      await saveMessage(convId, "bot", template);
      setInput("");
      setLoading(false);
      return;
    }

    // GPT 호출
    setLoading(true);

    try {
      const convState =
        conversations.find((c) => c.id === convId) || currentConv;

      const convForGpt = {
        ...convState,
        messages: [
          ...(convState?.messages || []),
          { sender: "user", text: trimmed },
        ],
      };

      const reply = await requestGpt(convId, buildMessagesForApi(convForGpt));

      await saveMessage(convId, "bot", reply);

      // UI 반영
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [
                  ...(c.messages || []),
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

      // 제목 자동 생성 (user + bot 메시지 기준)
      const convForTitle = {
        ...convForGpt,
        messages: [
          ...(convForGpt.messages || []),
          { sender: "bot", text: reply },
        ],
      };

      const newTitle = await requestTitle(convForTitle);
      if (newTitle) {
        const uid = user.uid;
        await updateDoc(
          doc(db, "users", uid, "conversations", convId),
          { title: newTitle }
        );
      }
    } finally {
      setLoading(false);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
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
      {/* Tone Modal Backdrop */}
      {toneModal && currentConv && (
        <div className="absolute inset-0 backdrop-blur-sm bg-black/20 z-20" />
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

      {/* Project Modal */}
      {projectModalOpen && projectEditing && (
        <ProjectModal
          open={projectModalOpen}
          project={projectEditing}
          onClose={() => {
            setProjectModalOpen(false);
            setProjectEditing(null);
          }}
          onSave={saveProjectEdit}
          onDelete={deleteProject}
        />
      )}

      {/* Main Layout */}
      <div className="flex flex-1">
        {/* Sidebar */}
<aside className="
  w-72 
  border-r 
  flex flex-col

  bg-[#f8f9fa] text-[#111] border-[#e5e7eb]      /* 라이트 */
  dark:bg-[#111] dark:text-gray-200 dark:border-[#2a2a2a]  /* 다크 */
">
  {/* 상단 영역 */}
  <div className="
    p-4 pb-3 border-b sticky top-0 z-10

    bg-[#f8f9fa] border-[#e5e7eb]
    dark:bg-[#111] dark:border-[#2a2a2a]
  ">
    {/* 🌙 다크모드 버튼 */}
    <button
  onClick={() => setDarkMode(!darkMode)}
  className="
    mb-4 w-full px-4 py-2 rounded-lg
    flex items-center justify-center gap-2

    bg-[#e5e7eb] text-[#111]
    hover:bg-[#dcdfe3]

    dark:bg-[#2a2a2a] dark:text-gray-200
    dark:hover:bg-[#333]
  "
>
  <img
    src={darkMode ? sun : moon}
    alt={darkMode ? "라이트 모드" : "다크 모드"}
    className="w-5 h-5"
  />
  <span>
    {darkMode ? "라이트 모드" : "다크 모드"}
  </span>
</button>


    {/* 🔧 프로젝트 섹션 */}
    <div>
      <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <span>프로젝트</span>

        <button
          onClick={addProject}
          className="
            text-[11px] px-2 py-1 rounded border

            bg-[#f0f0f0] text-[#444] border-[#ddd]
            dark:bg-[#1f1f1f] dark:text-gray-300 dark:border-[#3a3a3a]
          "
        >
          + 새 프로젝트
        </button>
      </div>

      {/* 전체 상담 버튼 */}
<button
  onClick={() => setCurrentProjectId(null)}
  className={`
    w-full text-left text-xs px-3 py-2 mb-1 rounded-lg border transition
    flex items-center gap-2
    ${
      currentProjectId === null
        ? `
          bg-[#e5e7eb] border-[#cbd5e1] text-[#111]
          dark:bg-[#2a2a2a] dark:border-[#555] dark:text-white
        `
        : `
          bg-[#ffffff] border-[#e5e7eb] text-gray-600 hover:bg-[#f3f3f3]
          dark:bg-[#1a1a1a] dark:border-[#2f2f2f] dark:text-gray-300
          dark:hover:bg-[#222]
        `
    }
  `}
>
  <img
    src={book}
    alt="전체 상담 보기"
    className="w-4 h-4 shrink-0"
  />
  <span>전체 상담 보기</span>
</button>


      {/* 프로젝트 목록 */}
      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 mt-1">
        {projects.map((p) => {
          const selected = p.id === currentProjectId;
          const color = p.color || "#6366f1";

          return (
            <div key={p.id} className="group relative">
           <button
  onClick={() => setCurrentProjectId(p.id)}
  className="
    w-full flex items-center gap-2 p-3 rounded-lg border transition text-left
    bg-[#ffffff] text-[#111] hover:bg-[#f3f3f3]
    dark:bg-[#1a1a1a] dark:text-gray-300 dark:hover:bg-[#222]
  "
  style={{
    borderColor: selected ? color : "transparent",
  }}
>
  <img
    src={img1}
    alt="프로젝트"
    className="w-4 h-4 shrink-0"
  />
  <span className="font-semibold text-sm truncate">
    {p.name}
  </span>
</button>


              {/* 수정/삭제 버튼 */}
              <div className="
                absolute right-2 top-1/2 -translate-y-1/2 
                flex gap-1 opacity-0 group-hover:opacity-100 transition
              ">
                <button
                  onClick={() => openProjectModal(p)}
                  className="
                    text-[10px] px-2 py-1 rounded border
                    bg-white text-gray-700 border-gray-300
                    dark:bg-[#1f1f1f] dark:text-gray-300 dark:border-[#3a3a3a]
                  "
                >
                  수정
                </button>
                <button
                  onClick={() => deleteProject(p.id)}
                  className="
                    text-[10px] px-2 py-1 rounded border
                    bg-red-100 text-red-700 border-red-300
                    dark:bg-red-900/40 dark:text-red-300 dark:border-red-900/60
                  "
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>

  {/* ------------------------ */}
  {/* 아래: 상담 목록 + 계정 */}
  {/* ------------------------ */}
  <div className="flex-1 overflow-y-auto p-4 pt-3">
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <span>
          상담 {currentProject ? `(프로젝트: ${currentProject.name})` : "(전체)"}
        </span>

        <button
          onClick={addConversation}
          className="
            text-[11px] px-2 py-1 rounded border
            bg-[#e5e7eb] text-[#111] border-[#ddd]
            dark:bg-[#333] dark:text-gray-200 dark:border-[#3a3a3a]
          "
        >
          + 새 상담
        </button>
      </div>

      {/* 상담 목록 */}
      {conversations.map((conv) => {
        const proj = projects.find((p) => p.id === conv.projectId);
        const color = proj?.color || "#a3a3a3";
        const selected = conv.id === currentId;

        return (
          <div key={conv.id} className="flex items-center gap-2">
            <div
              onClick={() => setCurrentId(conv.id)}
              className="
                flex-1 p-3 rounded-lg border cursor-pointer transition
                bg-white text-[#111]
                hover:bg-[#f3f3f3]
                dark:bg-[#1a1a1a] dark:text-gray-300
                dark:hover:bg-[#222]
              "
              style={{
                borderColor: selected ? color : "transparent",
              }}
            >
              <div className="font-semibold text-sm truncate">{conv.title}</div>
            </div>

            {/* 이름 변경 */}
            <button
              onClick={() => renameConversation(conv.id)}
              className="
                text-[10px] px-2 py-1 rounded border
                bg-white text-gray-700 border-gray-300
                dark:bg-[#1f1f1f] dark:text-gray-300 dark:border-[#3a3a3a]
              "
            >
              이름
            </button>

            {/* 삭제 */}
            <button
              onClick={() => deleteConversation(conv.id)}
              className="
                text-[10px] px-2 py-1 rounded border
                bg-red-100 text-red-700 border-red-300
                dark:bg-red-900/40 dark:text-red-300 dark:border-red-900/60
              "
            >
              삭제
            </button>
          </div>
        );
      })}
    </div>

    {/* 계정 */}
 <div className="mt-6 border-t pt-4 border-[#e5e7eb] dark:border-[#2a2a2a]">
  {/* 프로필 영역 */}
  <div className="flex items-center gap-3 mb-4">
    <div className="
      w-9 h-9 rounded-full flex items-center justify-center
      bg-[#e5e7eb] text-[#111]
      dark:bg-[#2a2a2a] dark:text-gray-200
    ">
      <img
        src={p}
        alt="프로필"
        className="w-5 h-5"
      />
    </div>

    <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
      {user?.email}
    </p>
  </div>

  {/* 로그아웃 버튼 */}
  <button
    onClick={() => signOut(auth)}
    className="
      w-full bg-red-600 hover:bg-red-700
      text-white px-4 py-2 rounded-lg
      transition
    "
  >
    로그아웃
  </button>
</div>

  </div>
</aside>



        {/* 오른쪽 메인 영역 */}
        {!currentConv ? (
          <main className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-black text-center px-4">
            <h2 className="text-2xl font-semibold dark:text-white mb-3">
              상담을 선택하거나 새로 만들어주세요
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              좌측에서 <strong>프로젝트</strong>를 선택해 필터링하거나,
              <br />
              <strong>“+ 새 상담”</strong>을 눌러 새로운 상담을 시작할 수 있습니다.
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
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                {currentProject
                  ? `프로젝트: ${currentProject.name} / 상담: ${currentConv.title}`
                  : `프로젝트 없음 / 상담: ${currentConv.title}`}
              </p>
            </header>

            {/* Messages */}
            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
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

                    setInput("");
                    if (textareaRef.current) {
                      textareaRef.current.style.height = "auto";
                    }
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
