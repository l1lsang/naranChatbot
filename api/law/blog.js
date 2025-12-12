// /api/law/blog.js
import OpenAI from "openai";
import fs from "fs";
import path from "path";

/* ------------------------------------------------------------------
   Node.js Runtime 설정
------------------------------------------------------------------ */
export const config = {
  runtime: "nodejs",
};

/* ------------------------------------------------------------------
   txt 파일 로드 함수
------------------------------------------------------------------ */
const loadTxt = (filename) => {
  const filePath = path.join(process.cwd(), "src", "txt", filename);
  return fs.readFileSync(filePath, "utf8");
};

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
   시스템 프롬프트 (마크다운 전용 버전)
------------------------------------------------------------------ */
const buildSystemPrompt = (category) => {
  const 사건유형 = category || "일반";

  return `
당신은 **10년 이상 경력의 한국 변호사** 관점에서 **사기 사건 법률 블로그 글**을 작성하는 전문 AI입니다.

# 🔧 출력 형식 기본 규칙 (Markdown 필수)

모든 출력은 **반드시 마크다운(Markdown)** 으로 작성해야 합니다.

## 제목 규칙 (H1)
- 최상단은 반드시 **H1 제목(예: # 제목)**  
- 예) \`# 라이브방송 환전 사기 대응법\`

## 도입부 규칙
- 제목 바로 아래 **3~5문장**
- **키워드 언급 0~1회**
- 도입부 형식은 아래 5개 중 **1가지 선택**
  - A) 표(마크다운 표)
  - B) 대화체
  - C) 체크리스트
  - D) 뉴스 인용
  - E) FAQ 스타일

## 본문 규칙
모두 **마크다운 구조**로 작성:
- H2: 서론, 사기 구조, 전형적 수법, 법적 평가, 피해 대응 등  
- H3: 세부 내용 분리  
- 글자수: **최소 2,000자 이상**  
- 키워드(사기 명칭) 4~5회 자연스럽게 반복  
- 불필요한 아웃풋 금지

## 결론 규칙
- H2: 결론  
- 핵심 3~5줄 요약  
- 피해자 공감 한 문장  
- 지금 할 수 있는 행동 조언 2~4개 bullet  
- 반드시 마크다운 bullet 사용

## 마지막: 정리 표(필수)
- 마크다운 테이블 형식
- 2~4열 구성
- 예: "사기특징 / 핵심요약 / 대응법"

# 금지 규칙
- 특정 플랫폼을 단정적으로 “사기”라고 하지 말 것  
- "케이프pes·szagold·koaso…" 문자열 포함 금지  

# 참고 지식 (내부 참조용)
절대 복붙 금지, 자연스럽게 재작성할 것.

${txt2}
${txt3}
${txt4}
${txt6}
${txt7}
${txt8}

# 사건 유형 태그
- 이번 글의 핵심 사건: **${사건유형}**

# ⚠️ 출력 전 필수 검증 (중요)

출력을 완료하기 전에, 아래 항목을 **스스로 점검**하고
하나라도 충족되지 않으면 **출력을 다시 작성**하라.

- [ ] 최상단이 반드시 H1 제목인가?
- [ ] 도입부가 3~5문장인가?
- [ ] 도입부 형식(A~E) 중 정확히 하나인가?
- [ ] 본문에 H2 / H3 구조가 있는가?
- [ ] 결론에 bullet 리스트가 있는가?
- [ ] 마지막에 마크다운 표가 있는가?
- [ ] 전체 출력이 마크다운 형식인가?

위 조건을 모두 만족할 때만 최종 답변을 출력하라.

`;
};

/* ------------------------------------------------------------------
   MAIN HANDLER (Vercel Node.js API)
------------------------------------------------------------------ */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 메서드만 허용됩니다." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY가 없습니다." });
  }

  const body = req.body;
  const { messages, category } = body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages 배열이 필요합니다." });
  }

  try {
    const systemPrompt = buildSystemPrompt(category);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const reply = completion.choices?.[0]?.message?.content || "";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("🔥 /api/law/blog ERROR:", err);
    return res.status(500).json({
      error: "블로그 생성 중 서버 오류",
      detail: err?.message,
    });
  }
}
