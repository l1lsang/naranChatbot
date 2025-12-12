// /api/law/blog.js
import OpenAI from "openai";
import fs from "fs";
import path from "path";

/* ------------------------------------------------------------------
   Node.js Runtime 설정 (Edge → Node로 전환)
------------------------------------------------------------------ */
export const config = {
  runtime: "nodejs", // ★ 반드시 Node 환경에서 실행되도록 설정
};

/* ------------------------------------------------------------------
   텍스트 파일 로드 함수
------------------------------------------------------------------ */
const loadTxt = (filename) => {
  const filePath = path.join(process.cwd(), "src", "txt", filename);
  return fs.readFileSync(filePath, "utf8");
};

// txt 파일 읽기
const txt1 = loadTxt("1.txt");
const txt2 = loadTxt("2.txt");
const txt3 = loadTxt("3.txt");
const txt4 = loadTxt("4.txt");
const txt5 = loadTxt("5.txt");
const txt6 = loadTxt("6.txt");
const txt7 = loadTxt("7.txt");
const txt8 = loadTxt("8.txt");

/* ------------------------------------------------------------------
   OpenAI Client
------------------------------------------------------------------ */
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ------------------------------------------------------------------
   SYSTEM PROMPT 생성
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
- 사기 구조 · 진행 단계 · 수법 · 법적 평가 · 대응 포함

[금지]
- 특정 플랫폼을 단정적으로 사기라고 명시 금지
- 케이프pes, szagold, koaso 등 문장 사용 금지

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
   MAIN HANDLER
   (Vercel Node.js API Route — req, res 사용)
------------------------------------------------------------------ */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 메서드만 허용됩니다." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY가 없습니다." });
  }

  let body;
  try {
    body = req.body; // Vercel은 자동 JSON 파싱됨
  } catch {
    return res.status(400).json({ error: "JSON 파싱 오류" });
  }

  const { messages, category } = body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages 배열이 필요합니다." });
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

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("🔥 /api/law/blog 에러:", err);
    return res.status(500).json({
      error: "블로그 생성 중 서버 오류가 발생했습니다.",
      detail: err?.message,
    });
  }
}
