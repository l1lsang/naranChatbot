// /api/law/blog.js
import OpenAI from "openai";

/* ------------------------------------------------------------------
   Node.js Runtime 설정 (Edge → Node로 전환)
------------------------------------------------------------------ */
export const config = {
  runtime: "nodejs", // ★ Node 환경에서 실행되도록 강제
};

/* ------------------------------------------------------------------
   JSON Response Helper
------------------------------------------------------------------ */
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

/* ------------------------------------------------------------------
   OpenAI Client
------------------------------------------------------------------ */
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ------------------------------------------------------------------
   초대형 txt 파일 내용 (Edge 미지원 → Node에서는 안전하게 사용 가능)
------------------------------------------------------------------ */
import txt1 from "../../src/txt/1.txt";
import txt2 from "../../src/txt/2.txt";
import txt3 from "../../src/txt/3.txt";
import txt4 from "../../src/txt/4.txt";
import txt5 from "../../src/txt/5.txt";
import txt6 from "../../src/txt/6.txt";
import txt7 from "../../src/txt/7.txt";
import txt8 from "../../src/txt/8.txt";

// ※ 그대로 내부 문자열로 쓰고 싶다면 import 없이 유지해도 됨
// Node에서는 메모리 문제 없음

/* ------------------------------------------------------------------
   SYSTEM PROMPT 빌더
------------------------------------------------------------------ */
const buildSystemPrompt = (category) => {
  const 사건유형 = category || "일반";

  return `
당신은 10년 이상의 실무 경험을 가진 한국 변호사의 시점에서
'사기 사건' 관련 법률 블로그를 전문적으로 작성하는 AI입니다.

[글 전체 기본 규칙]
- 독자는 실제 피해자 또는 피해를 걱정하는 일반인
- 법률 용어는 쉬운 설명과 함께 사용
- 목적: 구조 이해 + 예방 + 대응 제시

[필수 출력 구조]
1) 제목
2) 도입부 (3~5문장)
3) 서론
4) 본문 (최소 3개 소제목, 상세 설명)
5) 결론 (요약·공감·행동 조언)
6) 마지막에 **정리 요약 표 1개 포함**

[제목 규칙]
- 30~35자
- “사기” 1회 포함
- “대응/피해/예방/조치” 중 1개 이상 포함
- ${txt5} 형식 참고

[도입부 규칙 – 절대 위반 금지]
- 제목 바로 뒤 3~5문장
- 키워드 언급 0~1회
- ${txt1}의 5개 형식 중 1개 선택 (표/대화체/체크리스트/뉴스 인용/FAQ)

[본문 규칙]
- 최소 2,000자
- 키워드 4~5회 자연스럽게 반복
- 사기 구조 · 진행·수법 · 법적 평가 · 피해 후 대응 포함

[금지]
- 특정 플랫폼을 단정적으로 사기라고 명시 금지
- 케이프pes, szagold, koaso 등 문장 금지

[참고 지식 — 내부 가이드]
${txt2}
${txt3}
${txt4}
${txt6}
${txt7}
${txt8}

[사건 유형 태그]
- ${사건유형}
`;
};

/* ------------------------------------------------------------------
   MAIN HANDLER (POST only)
------------------------------------------------------------------ */
export default async function handler(req) {
  if (!process.env.OPENAI_API_KEY) {
    return json({ error: "OPENAI_API_KEY가 없습니다." }, 500);
  }

  if (req.method !== "POST") {
    return json({ error: "POST 메서드만 허용됩니다." }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON 파싱 오류" }, 400);
  }

  const { messages, category } = body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return json({ error: "messages 배열이 필요합니다." }, 400);
  }

  try {
    const systemPrompt = buildSystemPrompt(category);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const reply = completion.choices?.[0]?.message?.content || "";

    return json({ reply });
  } catch (err) {
    console.error("🔥 Node.js /api/law/blog error:", err);
    return json(
      {
        error: "서버 오류 발생",
        detail: err?.message,
      },
      500
    );
  }
}
