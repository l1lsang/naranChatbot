// /api/chat.js
import OpenAI from "openai";

export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    const { messages, category } = await req.json();
    const lastMsg = messages?.[messages.length - 1]?.content?.trim() || "";

    // ===============================
    // 1) "시작" → 템플릿 반환
    // ===============================
    if (lastMsg === "시작") {
      const FIXED_TEMPLATE = [
        "✅키워드:",
        "✅사기내용:",
        "✅구성선택:",
        "",
        "1. 사기 개연성을 중심으로 한 글",
        "2. 주의해야할 위험요소에 대해 디테일하게 분석한 글",
        "3. 실제로 드러난 정황을 바탕으로 경고형 분석한 글",
        "4. 피해예방과 도움이 되는 내용을 중점으로 쓴 글",
        "5. 법적 지식과 판례에 관해 전문가의 시점으로 쓴 글",
        "6. 웹사이트 검색 기반으로 실제 뉴스와 실제 사례들을 토대로 한 글",
        "7. 실제 피해 사례를 중점으로 한 글",
      ].join("\n");

      return new Response(
        JSON.stringify({ reply: FIXED_TEMPLATE }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ===============================
    // 2) "시작"이 아니면 → /api/law/blog로 넘김
    // ===============================
    const blogRes = await fetch(`${req.nextUrl.origin}/api/law/blog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, category }),
    });

    const data = await blogRes.json();
    return new Response(JSON.stringify(data), {
      status: blogRes.status,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "서버 오류" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
