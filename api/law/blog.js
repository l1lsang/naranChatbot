// /api/law/blog.js
import OpenAI from "openai";
import fs from "fs";
import path from "path";

/* =========================================================
   1. Runtime
========================================================= */
export const config = {
  runtime: "nodejs",
};

/* =========================================================
   2. TXT 로드
========================================================= */
const TXT_DIR = path.join(process.cwd(), "src", "txt");
const loadTxt = (f) => fs.readFileSync(path.join(TXT_DIR, f), "utf8");

const REF = {
  t1: loadTxt("1.txt"), // 도입부 형식 규칙
  t2: loadTxt("2.txt"),
  t3: loadTxt("3.txt"),
  t4: loadTxt("4.txt"),
  t5: loadTxt("5.txt"), // 제목 형식 규칙
  t6: loadTxt("6.txt"),
  t7: loadTxt("7.txt"),
  t8: loadTxt("8.txt"),
};

/* =========================================================
   3. OpenAI
========================================================= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* =========================================================
   4. 출력 JSON 스키마
========================================================= */
const OUTPUT_SCHEMA = `
{
  "title": "string (H1 제목, 제목 형식은 반드시 5.txt의 규칙을 따른다)",
  "intro": "string (3~5문장, markdown, 도입부 형식은 반드시 1.txt의 A~E 중 정확히 하나만 따른다)",
  "body": "string (markdown, H2/H3 구조 포함, 본문 전체)",
  "conclusion": "string (markdown, bullet 리스트 포함)",
  "summary_table": "string (markdown table, 글 전체 요약)"
}
`;

/* =========================================================
   5. System Prompt
========================================================= */
const buildSystemPrompt = (category) => `
당신은 **10년 이상 경력의 한국 변호사**입니다.
아래 JSON 스키마를 **정확히** 따르세요.
JSON 이외의 출력은 **절대 금지**합니다.

${OUTPUT_SCHEMA}

# 제목 작성 규칙 (5.txt 기준)
${REF.t5}

# 도입부 형식 규칙 (1.txt 기준)
${REF.t1}

# 공통 작성 규칙
- 모든 값은 markdown 문자열
- title에는 #을 쓰지 말고 제목 텍스트만 작성
- intro는 3~5문장 엄수
- intro 형식은 A~E 중 하나만 선택 (혼합 금지)
- body는 H2/H3 구조 필수, 2,000자 이상
- conclusion에는 반드시 bullet 리스트 포함
- summary_table은 markdown table 필수

# 참고 지식 (재작성용, 복붙 금지)
${REF.t2}
${REF.t3}
${REF.t4}
${REF.t6}
${REF.t7}
${REF.t8}

# 사건 유형
${category || "일반"}

출력 전에 스스로 검증하고,
조건을 하나라도 만족하지 못하면 **다시 작성**하라.
`;

/* =========================================================
   6. 출력 검증
========================================================= */
const isValidOutput = (json) => {
  if (!json) return false;
  const required = ["title", "intro", "body", "conclusion", "summary_table"];
  return required.every(
    (k) => typeof json[k] === "string" && json[k].trim().length > 0
  );
};

/* =========================================================
   7. GPT 호출
========================================================= */
const requestGPT = async (messages, category) => {
  const res = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0.3,
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: buildSystemPrompt(category) },
      ...messages,
    ],
  });

  return res.choices?.[0]?.message?.content ?? "";
};

/* =========================================================
   8. Handler
========================================================= */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { messages, category } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages 배열 필요" });
  }

  let attempt = 0;
  let parsed = null;

  while (attempt < 2) {
    attempt++;

    const raw = await requestGPT(messages, category);

    try {
      parsed = JSON.parse(raw);
      if (isValidOutput(parsed)) break;
    } catch (e) {
      // JSON 파싱 실패 → 재시도
    }
  }

  if (!parsed || !isValidOutput(parsed)) {
    return res.status(500).json({
      error: "출력 형식 검증 실패 (재시도 후)",
    });
  }

  return res.status(200).json(parsed);
}
