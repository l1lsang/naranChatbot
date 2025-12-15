import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  orderBy,
  limit,
} from "firebase/firestore";

import TypingText from "./TypingText";

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
   ■ Tone Modal
--------------------------------------------------------- */
function ToneModal({ open, onSelect, toneOptions }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center">
      <div className="bg-white dark:bg-neutral-800 p-8 rounded-2xl w-[420px] shadow-xl">
        <h2 className="text-xl font-bold mb-4 dark:text-white">
          블로그 작성 톤을 선택해주세요 ✍️
        </h2>

        <div className="space-y-3 max-h-[260px] overflow-y-auto">
          {toneOptions.map((t) => (
            <button
              key={t.name}
              onClick={() => onSelect(t.name)}
              className="w-full p-4 text-left bg-indigo-600 dark:bg-neutral-700 text-white rounded-xl"
            >
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm opacity-80">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ■ 메인
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

  const [conversations, setConversations] = useState([]); // 메타데이터만
  const [currentId, setCurrentId] = useState(null);

  const [messages, setMessages] = useState([]); // ✅ 선택된 상담의 메시지들만
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // ROLE
  const [userRole, setUserRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(true);

  // 첫 인트로 타이핑
  const [showIntroTyping, setShowIntroTyping] = useState(false);
  const [introTargetConvId, setIntroTargetConvId] = useState(null);

  const currentConv = useMemo(
    () => conversations.find((c) => c.id === currentId) || null,
    [conversations, currentId]
  );
  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) || null,
    [projects, currentProjectId]
  );

  const toneOptions = useMemo(
    () => [
      { name: "전문가 시점(법률 분석)", desc: "법률·판례 기반의 전문 분석." },
      { name: "경고형 톤", desc: "위험과 주의 메시지를 강조." },
      { name: "친절한 설명형", desc: "초보도 쉽게 이해할 수 있는 말투." },
      { name: "뉴스 기사형", desc: "객관적 보도 스타일." },
      { name: "단호한 대응형", desc: "명확하고 강한 어조." },
      { name: "부드러운 위로형", desc: "감정 공감 & 위로 중심." },
    ],
    []
  );

  /* ---------------- Utils ---------------- */
  const resetTextareaHeight = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
  };

  /* ---------------- ROLE ---------------- */
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        setUserRole(snap.exists() ? snap.data()?.role || "pending" : "pending");
      } catch {
        setUserRole("pending");
      } finally {
        setLoadingRole(false);
      }
    })();
  }, [user?.uid]);

  /* ---------------- Dark Mode ---------------- */
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  /* ---------------- Auto Scroll ---------------- */
  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading, showIntroTyping]);

  /* ---------------- Projects ---------------- */
  useEffect(() => {
    if (!user?.uid || userRole !== "active") return;
    const unsub = onSnapshot(
      collection(db, "users", user.uid, "projects"),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort(
            (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
          );
        setProjects(list);
        if (!list.length) setCurrentProjectId(null);
      }
    );
    return () => unsub();
  }, [user?.uid, userRole]);

  /* ---------------- Conversations (메타만) ---------------- */
  useEffect(() => {
    if (!user?.uid || userRole !== "active") return;

    const base = collection(db, "users", user.uid, "conversations");
    const ref = currentProjectId
      ? query(base, where("projectId", "==", currentProjectId))
      : base;

    const unsub = onSnapshot(ref, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
      setConversations(list);
      if (!list.length) setCurrentId(null);
      else if (!currentId) setCurrentId(list[0].id);
      else if (!list.find((c) => c.id === currentId)) setCurrentId(list[0].id);
    });

    return () => unsub();
  }, [user?.uid, userRole, currentProjectId, currentId]);

  /* ---------------- Messages (선택된 상담만!) ---------------- */
  useEffect(() => {
    if (!user?.uid || !currentId) {
      setMessages([]);
      return;
    }

    const ref = query(
      collection(db, "users", user.uid, "conversations", currentId, "messages"),
      orderBy("createdAt", "asc"),
      limit(500)
    );

    const unsub = onSnapshot(ref, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);
    });

    return () => unsub();
  }, [user?.uid, currentId]);

  /* ---------------- Auto create conversation ---------------- */
  useEffect(() => {
    if (!user?.uid || userRole !== "active") return;
    if (conversations.length === 0 && !currentId) addConversation();
    // eslint-disable-next-line
  }, [user?.uid, userRole, conversations.length]);

  /* ---------------- CRUD ---------------- */
  const addProject = async () => {
    const name = window.prompt("프로젝트 이름을 입력해주세요!");
    if (!name?.trim()) return;
    const id = Date.now().toString();
    await setDoc(doc(db, "users", user.uid, "projects", id), {
      name: name.trim(),
      color: "#6366f1",
      createdAt: serverTimestamp(),
    });
    setCurrentProjectId(id);
  };

  const saveProjectEdit = async (projectId, name, color) => {
    await updateDoc(doc(db, "users", user.uid, "projects", projectId), {
      name,
      color,
    });
    const snap = await getDocs(
      query(
        collection(db, "users", user.uid, "conversations"),
        where("projectId", "==", projectId)
      )
    );
    for (let c of snap.docs) {
      await updateDoc(doc(db, "users", user.uid, "conversations", c.id), {
        color,
      });
    }
    setProjectModalOpen(false);
    setProjectEditing(null);
  };

  const deleteProject = async (projectId) => {
    if (!window.confirm("정말 이 프로젝트를 삭제할까요?")) return;
    const snap = await getDocs(
      query(
        collection(db, "users", user.uid, "conversations"),
        where("projectId", "==", projectId)
      )
    );
    for (let c of snap.docs) {
      await updateDoc(doc(db, "users", user.uid, "conversations", c.id), {
        projectId: null,
        color: null,
      });
    }
    await deleteDoc(doc(db, "users", user.uid, "projects", projectId));
    if (currentProjectId === projectId) setCurrentProjectId(null);
  };

  const addConversation = async () => {
    const id = Date.now().toString();
    await setDoc(doc(db, "users", user.uid, "conversations", id), {
      title: "제목 생성 중…",
      tone: null,
      projectId: currentProjectId || null,
      color: currentProject?.color || null,
      createdAt: serverTimestamp(),
    });
    setCurrentId(id);
    setToneModal(true);
  };

  const deleteConversation = async (convId) => {
    if (!window.confirm("이 상담을 삭제할까요?")) return;
    const snap = await getDocs(
      collection(db, "users", user.uid, "conversations", convId, "messages")
    );
    for (let m of snap.docs) {
      await deleteDoc(
        doc(db, "users", user.uid, "conversations", convId, "messages", m.id)
      );
    }
    await deleteDoc(doc(db, "users", user.uid, "conversations", convId));
    if (currentId === convId) setCurrentId(null);
  };

  const saveMessage = async (sender, text) => {
    if (!currentId) return;
    await setDoc(
      doc(
        db,
        "users",
        user.uid,
        "conversations",
        currentId,
        "messages",
        Date.now().toString()
      ),
      {
        sender,
        text,
        createdAt: serverTimestamp(),
        clientTime: Date.now() / 1000,
      }
    );
  };

  /* ---------------- GPT ---------------- */
  const buildMessagesForApi = () =>
    messages.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));

  const requestGpt = async (msgs) => {
    const last = msgs[msgs.length - 1]?.content?.trim();
    if (last === "시작") {
      const r = await fetch("/api/law/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
      return (await r.json()).reply;
    }
    const filled =
      /✅키워드:\s*\S+/i.test(last) ||
      /✅사기내용:\s*\S+/i.test(last) ||
      /✅구성선택:\s*[1-7]/i.test(last);
    if (filled) {
      const r = await fetch("/api/law/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
      const d = await r.json();
      return `# ${d.title}\n\n${d.intro}\n\n${d.body}\n\n## 결론\n${d.conclusion}\n\n${d.summary_table}`;
    }
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgs }),
    });
    return (await r.json()).reply;
  };

  /* ---------------- Send ---------------- */
  const sendMessage = async (text) => {
    if (!text.trim() || !currentConv?.tone || loading) return;
    await saveMessage("user", text.trim());
    if (text.trim() === "시작") return;

    setLoading(true);
    try {
      const reply = await requestGpt([
        ...buildMessagesForApi(),
        { role: "user", content: text.trim() },
      ]);
      await saveMessage("bot", reply);
    } finally {
      setLoading(false);
      setInput("");
      resetTextareaHeight();
    }
  };

  /* ---------------- Tone ---------------- */
  const selectTone = async (toneName) => {
    await updateDoc(
      doc(db, "users", user.uid, "conversations", currentId),
      { tone: toneName }
    );
    setToneModal(false);

    if (messages.length === 0) {
      setIntroTargetConvId(currentId);
      setShowIntroTyping(true);
    } else {
      await saveMessage(
        "bot",
        `좋습니다! 선택하신 블로그 톤은 **${toneName}** 입니다.\n"시작"이라고 입력하면 템플릿을 안내해드릴게요.`
      );
    }
  };

  /* ---------------- Gate ---------------- */
  if (loadingRole)
    return (
      <div className="w-screen h-screen flex items-center justify-center text-gray-500">
        권한 확인 중…
      </div>
    );
  if (userRole !== "active")
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <button onClick={() => signOut(auth)}>로그아웃</button>
      </div>
    );

  /* ---------------- UI ---------------- */
  return (
    <div className="w-screen h-screen flex overflow-hidden relative">
      {toneModal && <div className="absolute inset-0 bg-black/20 z-20" />}
      <ToneModal open={toneModal} onSelect={selectTone} toneOptions={toneOptions} />

      <div className="flex flex-1">
        {/* Sidebar (생략 없이 기존과 동일한 구조 사용 가능) */}
          <aside
          className="
            w-72 border-r flex flex-col
            bg-[#f8f9fa] text-[#111] border-[#e5e7eb]
            dark:bg-[#111] dark:text-gray-200 dark:border-[#2a2a2a]
          "
        >
          <div
            className="
              p-4 pb-3 border-b sticky top-0 z-10
              bg-[#f8f9fa] border-[#e5e7eb]
              dark:bg-[#111] dark:border-[#2a2a2a]
            "
          >
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="
                mb-4 w-full px-4 py-2 rounded-lg
                flex items-center justify-center gap-2
                bg-[#e5e7eb] text-[#111] hover:bg-[#dcdfe3]
                dark:bg-[#2a2a2a] dark:text-gray-200 dark:hover:bg-[#333]
              "
            >
              <img src={darkMode ? sun : moon} alt="theme" className="w-5 h-5" />
              <span>{darkMode ? "라이트 모드" : "다크 모드"}</span>
            </button>

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
                <img src={book} alt="all" className="w-4 h-4 shrink-0" />
                <span>전체 상담 보기</span>
              </button>

              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 mt-1">
                {projects.map((pjt) => {
                  const selected = pjt.id === currentProjectId;
                  const color = pjt.color || "#6366f1";

                  return (
                    <div key={pjt.id} className="group relative">
                      <button
                        onClick={() => setCurrentProjectId(pjt.id)}
                        className="
                          w-full flex items-center gap-2 p-3 rounded-lg border transition text-left
                          bg-[#ffffff] text-[#111] hover:bg-[#f3f3f3]
                          dark:bg-[#1a1a1a] dark:text-gray-300 dark:hover:bg-[#222]
                        "
                        style={{ borderColor: selected ? color : "transparent" }}
                      >
                        <img src={img1} alt="proj" className="w-4 h-4 shrink-0" />
                        <span className="font-semibold text-sm truncate">
                          {pjt.name}
                        </span>
                      </button>

                      <div
                        className="
                          absolute right-2 top-1/2 -translate-y-1/2
                          flex gap-1 opacity-0 group-hover:opacity-100 transition
                        "
                      >
                        <button
                          onClick={() => openProjectModal(pjt)}
                          className="
                            text-[10px] px-2 py-1 rounded border
                            bg-white text-gray-700 border-gray-300
                            dark:bg-[#1f1f1f] dark:text-gray-300 dark:border-[#3a3a3a]
                          "
                        >
                          수정
                        </button>
                        <button
                          onClick={() => deleteProject(pjt.id)}
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

              {conversations.map((conv) => {
                const proj = projects.find((pp) => pp.id === conv.projectId);
                const color = proj?.color || "#a3a3a3";
                const selected = conv.id === currentId;

                return (
                  <div key={conv.id} className="flex items-center gap-2">
                    <div
                      onClick={() => setCurrentId(conv.id)}
                      className="
                        flex-1 p-3 rounded-lg border cursor-pointer transition
                        bg-white text-[#111] hover:bg-[#f3f3f3]
                        dark:bg-[#1a1a1a] dark:text-gray-300 dark:hover:bg-[#222]
                      "
                      style={{ borderColor: selected ? color : "transparent" }}
                    >
                      <div className="font-semibold text-sm truncate">{conv.title}</div>
                    </div>

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

            <div className="mt-6 border-t pt-4 border-[#e5e7eb] dark:border-[#2a2a2a]">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="
                    w-9 h-9 rounded-full flex items-center justify-center
                    bg-[#e5e7eb] text-[#111]
                    dark:bg-[#2a2a2a] dark:text-gray-200
                  "
                >
                  <img src={p} alt="profile" className="w-5 h-5" />
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                  {user?.name}
                </p>
              </div>

              <button
                onClick={() => signOut(auth)}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
              >
                로그아웃
              </button>
            </div>
          </div>
        </aside>

        {/* … 필요 시 이전 답변의 사이드바 JSX 그대로 붙여도 됩니다 … */}
      {/* 오른쪽 메인 */}
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
            <h1 className="text-xl font-semibold dark:text-white">LAW HERO</h1>
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
          <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* ✅ 톤 선택 직후 1회 인트로 타이핑 */}
            {showIntroTyping && introTargetConvId === currentId && (
              <div className="flex justify-start">
                <div className="max-w-[70%] px-4 py-3 rounded-2xl shadow bg-white dark:bg-neutral-800 dark:text-gray-200">
                  <TypingText
                    text={`좋습니다! 블로그 톤 선택이 완료되었습니다.\n"시작"이라고 입력하면 템플릿을 안내해드릴게요.`}
                    onComplete={async () => {
                      await saveMessage(
                        "bot",
                        `좋습니다! 블로그 톤 선택이 완료되었습니다.\n"시작"이라고 입력하면 템플릿을 안내해드릴게요.`
                      );
                      setShowIntroTyping(false);
                      setIntroTargetConvId(null);
                    }}
                  />
                </div>
              </div>
            )}

            {/* 기존 메시지 */}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[70%] px-4 py-3 rounded-2xl shadow text-sm ${
                    m.sender === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-neutral-800 dark:text-gray-200"
                  }`}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.text}
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
                  sendMessage(input);
                }
              }}
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
);}