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
  onSnapshot,
  serverTimestamp,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";

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

  // 프로젝트 편집 모달 상태
  const [editingProject, setEditingProject] = useState(null);
  const [editProjName, setEditProjName] = useState("");
  const [editProjColor, setEditProjColor] = useState("#6366F1");
  const [editProjIcon, setEditProjIcon] = useState("📁");

  const currentConv = conversations.find((c) => c.id === currentId) || null;
  const currentProject = projects.find((p) => p.id === currentProjectId) || null;

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

      // 프로젝트가 하나도 없을 때 자동 선택 해제
      if (list.length === 0) {
        setCurrentProjectId(null);
        setConversations([]);
        setCurrentId(null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  /* ---------------- Load Conversations (by Project) ---------------- */
  useEffect(() => {
    if (!user?.uid) return;

    const uid = user.uid;

    if (!currentProjectId) {
      setConversations([]);
      setCurrentId(null);
      return;
    }

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
          systemPrompt: data.systemPrompt || "",
          createdAt: data.createdAt,
          messages,
        });
      }

      list.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );

      setConversations(list);

      // GPT 스타일: 자동으로 상담 선택하지 않음
      if (list.length === 0) {
        setCurrentId(null);
      }
    });

    return () => unsubscribe();
  }, [user, currentProjectId]);

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

  /* ---------------- Create New Project ---------------- */
  const addProject = async () => {
    const name = window.prompt("프로젝트 이름을 입력해주세요!");
    if (!name || !name.trim()) return;

    const systemPrompt = window.prompt(
      "이 프로젝트의 기본 프롬프트(톤/지시문)를 입력해주세요.\n(나중에 수정 가능)"
    );

    const uid = user.uid;
    const newId = Date.now().toString();

    await setDoc(doc(db, "users", uid, "projects", newId), {
      name: name.trim(),
      icon: "📁",
      color: "#6366F1",
      systemPrompt: systemPrompt?.trim() || "",
      createdAt: serverTimestamp(),
    });

    // 방금 만든 프로젝트로 자동 선택
    setCurrentProjectId(newId);
    setConversations([]);
    setCurrentId(null);
  };

  /* ---------------- Edit Project (Name / Color / Icon) ---------------- */
  const openProjectEditor = (project) => {
    setEditingProject(project);
    setEditProjName(project.name || "");
    setEditProjColor(project.color || "#6366F1");
    setEditProjIcon(project.icon || "📁");
  };

  const saveProjectEdit = async () => {
    if (!editingProject || !user?.uid) return;
    const uid = user.uid;

    await updateDoc(doc(db, "users", uid, "projects", editingProject.id), {
      name: editProjName.trim() || editingProject.name,
      color: editProjColor || "#6366F1",
      icon: editProjIcon || "📁",
    });

    setEditingProject(null);
  };

  const deleteProject = async (projectId) => {
    if (
      !window.confirm(
        "정말 이 프로젝트를 삭제할까요?\n해당 프로젝트의 모든 상담과 메시지도 함께 삭제됩니다."
      )
    )
      return;

    const uid = user.uid;

    // 1) 프로젝트 삭제
    await deleteDoc(doc(db, "users", uid, "projects", projectId));

    // 2) 해당 프로젝트의 상담들 삭제
    const convSnap = await getDocs(
      query(
        collection(db, "users", uid, "conversations"),
        where("projectId", "==", projectId)
      )
    );

    for (let conv of convSnap.docs) {
      const convId = conv.id;

      const msgSnap = await getDocs(
        collection(db, "users", uid, "conversations", convId, "messages")
      );

      for (let m of msgSnap.docs) {
        await deleteDoc(
          doc(
            db,
            "users",
            uid,
            "conversations",
            convId,
            "messages",
            m.id
          )
        );
      }

      await deleteDoc(doc(db, "users", uid, "conversations", convId));
    }

    if (currentProjectId === projectId) {
      setCurrentProjectId(null);
      setConversations([]);
      setCurrentId(null);
    }
  };

  /* ---------------- Create New Conversation ---------------- */
  const addConversation = async () => {
    if (!currentProjectId) return;

    const uid = user.uid;
    const newId = Date.now().toString();

    let systemPrompt = "";
    const projSnap = await getDoc(
      doc(db, "users", uid, "projects", currentProjectId)
    );
    systemPrompt = projSnap.data()?.systemPrompt || "";

    const title =
      window.prompt("새 상담 제목을 입력하세요.", "새 상담") || "새 상담";

    await setDoc(doc(db, "users", uid, "conversations", newId), {
      title: title.trim(),
      tone: null,
      projectId: currentProjectId,
      systemPrompt,
      createdAt: serverTimestamp(),
    });

    const firstMsgId = (Date.now() + 1).toString();
    await setDoc(
      doc(
        db,
        "users",
        uid,
        "conversations",
        newId,
        "messages",
        firstMsgId
      ),
      {
        sender: "bot",
        text:
          "새로운 상담을 시작합니다. 먼저 블로그 작성 톤을 선택해주세요! ✍️",
        createdAt: serverTimestamp(),
        clientTime: Date.now() / 1000,
      }
    );

    setCurrentId(newId);
    setToneModal(true);
  };

  /* ---------------- Conversation Delete / Rename ---------------- */
  const deleteConversation = async (convId) => {
    if (!user?.uid) return;
    if (!window.confirm("이 상담을 삭제할까요?")) return;

    const uid = user.uid;

    const msgSnap = await getDocs(
      collection(db, "users", uid, "conversations", convId, "messages")
    );
    for (let m of msgSnap.docs) {
      await deleteDoc(
        doc(db, "users", uid, "conversations", convId, "messages", m.id)
      );
    }

    await deleteDoc(doc(db, "users", uid, "conversations", convId));

    if (currentId === convId) {
      setCurrentId(null);
    }
  };

  const renameConversation = async (convId) => {
    if (!user?.uid) return;

    const conv = conversations.find((c) => c.id === convId);
    const newTitle = window.prompt(
      "새 상담 제목을 입력하세요.",
      conv?.title || "상담"
    );
    if (!newTitle?.trim()) return;

    const uid = user.uid;
    await updateDoc(doc(db, "users", uid, "conversations", convId), {
      title: newTitle.trim(),
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

    if (last === "시작") {
      const res = await fetch("/api/law/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesForApi }),
      });

      const data = await res.json();
      return data.reply;
    }

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

    await saveMessage(convId, "user", trimmed);

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

    setLoading(true);

    try {
      const conv = conversations.find((c) => c.id === convId) || currentConv;
      const tempConv = {
        ...conv,
        messages: [...(conv?.messages || []), { sender: "user", text: trimmed }],
      };

      const reply = await requestGpt(convId, buildMessagesForApi(tempConv));

      await saveMessage(convId, "bot", reply);

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

      {/* 프로젝트 편집 모달 */}
      {editingProject && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 w-[380px] shadow-xl">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">
              프로젝트 설정
            </h2>

            <label className="block text-xs mb-1 dark:text-gray-300">
              프로젝트 이름
            </label>
            <input
              className="w-full mb-3 px-3 py-2 rounded border dark:bg-neutral-800 dark:border-neutral-700 dark:text-white text-sm"
              value={editProjName}
              onChange={(e) => setEditProjName(e.target.value)}
            />

            <label className="block text-xs mb-1 dark:text-gray-300">
              아이콘 (이모지)
            </label>
            <input
              className="w-full mb-3 px-3 py-2 rounded border dark:bg-neutral-800 dark:border-neutral-700 dark:text-white text-sm"
              value={editProjIcon}
              onChange={(e) => setEditProjIcon(e.target.value)}
              placeholder="예: ⚖️, 📘, 📝"
            />

            <label className="block text-xs mb-2 dark:text-gray-300">
              프로젝트 색상
            </label>
            <div className="mb-4 flex items-center gap-3">
              <HexColorPicker
                color={editProjColor}
                onChange={setEditProjColor}
              />
              <div className="flex-1">
                <input
                  className="w-full px-3 py-2 rounded border dark:bg-neutral-800 dark:border-neutral-700 dark:text-white text-sm mb-2"
                  value={editProjColor}
                  onChange={(e) => setEditProjColor(e.target.value)}
                />
                <div
                  className="w-full h-8 rounded"
                  style={{ backgroundColor: editProjColor }}
                ></div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setEditingProject(null)}
                className="px-3 py-1.5 rounded text-sm bg-neutral-200 dark:bg-neutral-700 dark:text-white"
              >
                취소
              </button>
              <button
                onClick={saveProjectEdit}
                className="px-3 py-1.5 rounded text-sm bg-indigo-600 text-white"
              >
                저장
              </button>
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
        <aside className="w-72 bg-white dark:bg-neutral-900 border-r dark:border-neutral-700 flex flex-col">
          {/* 상단 고정 영역 */}
          <div className="p-4 pb-3 border-b dark:border-neutral-700 sticky top-0 bg-white dark:bg-neutral-900 z-10">
            {/* 다크모드 토글 */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="mb-4 w-full bg-indigo-600 text-white px-4 py-2 rounded-lg dark:bg-neutral-700"
            >
              {darkMode ? "🌞 라이트 모드" : "🌙 다크 모드"}
            </button>

            {/* 프로젝트 섹션 */}
            <div>
              <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                <span>프로젝트</span>
                <button
                  onClick={addProject}
                  className="text-[11px] px-2 py-1 rounded bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100"
                >
                  + 새 프로젝트
                </button>
              </div>

              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {projects.length === 0 ? (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    프로젝트가 없습니다.
                  </p>
                ) : (
                  projects.map((p) => {
                    const color = p.color || "#6366F1";
                    const icon = p.icon || "📁";
                    const selected = currentProjectId === p.id;

                    return (
                      <div
                        key={p.id}
                        className="relative group"
                      >
                        <div
                          onClick={() => {
                            setCurrentProjectId(p.id);
                            setCurrentId(null);
                          }}
                          className="p-3 rounded-xl cursor-pointer transition border flex items-center gap-2"
                          style={{
                            background: selected ? color + "22" : "#f3f4f6",
                            borderColor: selected ? color : "transparent",
                            color: selected ? color : "#555",
                          }}
                        >
                          <span className="text-lg">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">
                              {p.name}
                            </div>
                          </div>

                          {/* 수정 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openProjectEditor(p);
                            }}
                            className="text-[11px] px-2 py-1 rounded bg-white/70 dark:bg-neutral-800/70 text-gray-600 dark:text-gray-200 opacity-0 group-hover:opacity-100 transition"
                          >
                            수정
                          </button>

                          {/* 삭제 버튼 (아이콘 버전) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProject(p.id);
                            }}
                            className="ml-1 text-[12px] text-red-500 opacity-0 group-hover:opacity-100 transition"
                            title="프로젝트 삭제"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 아래 스크롤 영역 */}
          <div className="flex-1 overflow-y-auto p-4 pt-3">
            {/* 상담 섹션 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                <span>상담</span>
                <button
                  onClick={addConversation}
                  disabled={!currentProjectId}
                  className={`text-[11px] px-2 py-1 rounded ${
                    currentProjectId
                      ? "bg-indigo-100 text-indigo-700 dark:bg-neutral-700 dark:text-neutral-100"
                      : "bg-gray-200 dark:bg-neutral-800 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  + 새 상담
                </button>
              </div>

              {!currentProjectId ? (
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  프로젝트를 먼저 선택하세요.
                </p>
              ) : conversations.length === 0 ? (
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  아직 이 프로젝트에는 상담이 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setCurrentId(conv.id);
                        setToneModal(!conv.tone);
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition border flex items-center gap-2 ${
                        conv.id === currentId
                          ? "bg-indigo-100 dark:bg-neutral-700 text-indigo-700 dark:text-white border-indigo-300 dark:border-neutral-500"
                          : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 border-transparent"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">
                          {conv.title}
                        </div>
                        {conv.tone && (
                          <div className="text-[11px] opacity-70 mt-0.5">
                            톤: {conv.tone}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          renameConversation(conv.id);
                        }}
                        className="text-[11px] px-2 py-1 rounded bg-white/70 dark:bg-neutral-700/70 text-gray-600 dark:text-gray-200"
                      >
                        이름
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="text-[11px] px-2 py-1 rounded bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 하단: 이메일 + 로그아웃 */}
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
          </div>
        </aside>

        {/* 오른쪽 메인 영역 (GPT 스타일 3단 분기) */}
        {!currentProjectId ? (
          // 1) 프로젝트 선택 안 된 상태
          <main className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-black text-center px-4">
            <h2 className="text-2xl font-semibold dark:text-white mb-3">
              프로젝트를 선택해주세요
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              좌측 상단에서 <strong>프로젝트</strong>를 선택하거나
              <br />
              <strong>“+ 새 프로젝트”</strong>로 시작할 수 있습니다.
            </p>
          </main>
        ) : !currentId ? (
          // 2) 프로젝트는 선택됐지만 상담 선택 안 된 상태 → 상담 목록 화면
          <main className="flex-1 bg-gray-50 dark:bg-black p-8 overflow-y-auto">
            <h1 className="text-2xl font-bold dark:text-white mb-2">
              {currentProject?.icon || "📁"} {currentProject?.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              이 프로젝트의 상담 목록입니다.
            </p>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold dark:text-white">
                상담 목록
              </h2>
              <button
                onClick={addConversation}
                className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 text-white"
              >
                + 새 상담
              </button>
            </div>

            {conversations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                아직 상담이 없습니다. 오른쪽 상단의{" "}
                <strong>“+ 새 상담”</strong> 버튼을 눌러 시작해보세요.
              </p>
            ) : (
              <div className="space-y-3">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className="p-4 bg-white dark:bg-neutral-900 rounded-xl shadow cursor-pointer flex items-center justify-between"
                    onClick={() => setCurrentId(conv.id)}
                  >
                    <div>
                      <div className="font-semibold text-sm dark:text-white">
                        {conv.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {conv.messages.length}개의 메시지
                        {conv.tone && ` · 톤: ${conv.tone}`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          renameConversation(conv.id);
                        }}
                        className="text-[11px] px-2 py-1 rounded bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-200 border dark:border-neutral-700"
                      >
                        이름 변경
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="text-[11px] px-2 py-1 rounded bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        ) : (
          // 3) 상담까지 선택된 상태 → 채팅 화면
          <main className="flex-1 flex flex-col bg-gray-50 dark:bg-black">
            <header className="p-4 border-b dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <h1 className="text-xl font-semibold dark:text-white">
                상담 챗봇
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user.email} 님
              </p>
              {currentProject && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  프로젝트: {currentProject.icon || "📁"}{" "}
                  {currentProject.name} / 상담: {currentConv?.title}
                </p>
              )}
            </header>

            {/* Messages */}
            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {(currentConv?.messages ?? []).map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender === "user"
                      ? "justify-end"
                      : "justify-start"
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
                          <p className="whitespace-pre-line">
                            {children}
                          </p>
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
