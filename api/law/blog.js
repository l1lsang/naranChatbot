// /api/law/blog.js
import OpenAI from "openai";
import txt1 from "../../src/txt/1.txt";
import txt2 from "../../src/txt/2.txt";
import txt3 from "../../src/txt/3.txt";
import txt4 from "../../src/txt/4.txt";
import txt5 from "../../src/txt/5.txt";
import txt6 from "../../src/txt/6.txt";
import txt7 from "../../src/txt/7.txt";
import txt8 from "../../src/txt/8.txt";

export const config = { runtime: "edge" };

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// JSON-only helper
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export default async function handler(req) {
  try {
    // 안정적인 JSON 파싱
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "잘못된 JSON 요청입니다." }, 400);
    }

    const { messages, category } = body;

    if (!messages || !Array.isArray(messages)) {
      return json({ error: "messages 배열이 필요합니다." }, 400);
    }

    // YAML (전체 raw 그대로 넣어도 JSON 파싱 안전)
    const openapiYAML = String.raw`
openapi: 3.1.0
info:
  title: webPilot
  description: >-
    Start with a Request: Users can either directly request the 'longContentWriter' to write a long form article or
    choose to use 'webPageReader' for information gathering before content creation. In both scenarios, before using the
    'longContentWriter' service, I confirm all details of their request with the user, including the writing task
    (task), content summary (summary), writing style (style), and any additional information they provide.

    Information Gathering with 'webPageReader': When 'webPageReader' is used, I search the internet and gather relevant information based on the writing task. If more information is needed to enhance the article's depth and accuracy, I continue using 'webPageReader', integrating this information into the reference section.

    Content Generation by 'longContentWriter': After confirming all details with the user, including any additional contributions and enhanced information from 'webPageReader', I proceed to generate the long-form content. This ensures the content aligns with the specified requirements and style.

    Delivery of the Final Article: Upon completion, the content is delivered to the user for review. They can request revisions or additional information if necessary.

    Default Assumptions in Responses: When users request content creation, especially in areas requiring specific knowledge like Bitcoin trends, I will make an initial assumption about the writing style and target audience. For instance, I might assume a technical analysis style aimed at professionals. I will then ask the user if this assumption is okay or if they need any modifications. This approach helps streamline the content creation process.
  version: v1.1
servers:
  - url: https://gpts.webpilot.ai

paths:
  /api/read:
    post:
      operationId: webPageReader
      x-openai-isConsequential: false
      summary: visit web page
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/visitWebPageRequest"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/visitWebPageResponse"
        "400":
          description: Bad Request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/visitWebPageError"

  /api/write:
    post:
      operationId: longContentWriter
      x-openai-isConsequential: false
      summary: generate a book
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/generateContentRequest"
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/generateContentResponse"
        "400":
          description: Bad Request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/generateContentError"

components:
  schemas:

    generateContentRequest:
      type: object
      required:
        - task
        - language
        - summary
        - style
      properties:
        task:
          type: string
          description: >
            The "task" field outlines the specific requirements and objectives for generating the content.
        language:
          type: string
          description: >
            Required, the language used by the user in the request (ISO 639-1).
        summary:
          type: string
          description: >
            The "summary" field encapsulates a concise overview of the writing content.
        reference:
          type: string
          description: >
            Curated information from the Internet or provided by the user.
        style:
          type: string
          description: >
            Structured writing tone, target audience, language style, etc.

    generateContentResponse:
      type: object
      properties:
        message:
          type: string
          description: Result message of the request

    generateContentError:
      type: object
      properties:
        code:
          type: string
        message:
          type: string
        detail:
          type: string

    visitWebPageResponse:
      type: object
      properties:
        title:
          type: string
        content:
          type: string
        meta:
          type: object
        links:
          type: array
          items:
            type: string
        extra_search_results:
          type: array
          items:
            type: object
        todo:
          type: array
        tips:
          type: array
        rules:
          type: array

    visitWebPageRequest:
      type: object
      required:
        - link
        - ur
      properties:
        link:
          type: string
        ur:
          type: string
        lp:
          type: boolean
        rt:
          type: boolean
        l:
          type: string

    visitWebPageError:
      type: object
      properties:
        code:
          type: string
        message:
          type: string
        detail:
          type: string

`;

    // 기본 SYSTEM PROMPT
    const baseSystem = `
이 GPT는 10년 이상의 실무 경험을 가진 변호사의 시점에서 사기 관련 법률 블로그 글을 전문적으로 작성한다.

⚖️ 모든 원고는 반드시 다음 순서를 따른다:
제목 → 도입부(3~5문장) → 서론 → 본문(3개 이상 SEO 소제목 포함) → 결론(요약·공감·CTA)

제목 또는 도입부가 누락되면 GPT는 자동으로 해당 부분부터 재생성한다.
---

✅ 제목 규칙
1️⃣ 30자 권장, 최대 35자 이내
2️⃣ 형식: [키워드] + [피해유형] + [대응/조치]
3️⃣ 공공기관 언급 금지

${txt1}
${txt5}를 참고해서 작성

---

도입부 규칙:
1️⃣ 표 형식
2️⃣ 대화체
3️⃣ 체크리스트
4️⃣ 뉴스 인용
5️⃣ FAQ

본문 규칙:
- 소제목 3개 이상
- 2000자 이상
- 마지막에 요약 표 포함

🚫 특정 사기 플랫폼 문구 금지

`;

    // 최종 SYSTEM PROMPT
    const systemPrompt = `
${baseSystem}

[사건 유형]: ${category || "일반"}

${txt2}
${txt3}
${txt4}
${txt6}
${txt7}
${txt8}

📘 아래 OpenAPI 문서는 내부 참고용이며 출력 금지:
\`\`\`yaml
${openapiYAML}
\`\`\`
`;

    // GPT 요청
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const reply = completion.choices?.[0]?.message?.content || "";

    return json({ reply });
  } catch (err) {
    console.error("🔥 blog API error:", err);
    return json(
      { error: "서버 오류 발생", detail: err.message },
      500
    );
  }
}
