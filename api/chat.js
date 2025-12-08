import OpenAI from "openai";
import txt1 from "../src/txt/도입부 형식.txt"
import txt2 from "../src/txt/라이브방송환전 사기란.txt"
import txt3 from "../src/txt/로맨스스캠 사기란.txt"
import txt4 from "../src/txt/리딩방 사기란.txt"
import txt5 from "../src/txt/제목 구성 형식.txt"
import txt6 from "../src/txt/주식 사기란.txt"
import txt7 from "../src/txt/코인 사기란.txt"
import txt8 from "../src/txt/팀미션 사기란.txt"
export const config = {
  runtime: "edge", // 빠르고 저렴한 Edge 런타임
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req) {
  try {
    const { messages, category } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages 배열이 필요합니다." }), {
        status: 400,
      });
    }
const openapiYAML = String.raw`
openapi: 3.1.0
info:
  title: webPilot
  description: >-
    Start with a Request: Users can either directly request the \'longContentWriter\' to write a long form article or
    choose to use \'webPageReader\' for information gathering before content creation. In both scenarios, before using the
    \'longContentWriter\' service, I confirm all details of their request with the user, including the writing task
    (task), content summary (summary), writing style (style), and any additional information they provide.

    Information Gathering with \'webPageReader\': When \'webPageReader\' is used, I search the internet and gather relevant information based on the writing task. If more information is needed to enhance the article\'s depth and accuracy, I continue using \'webPageReader\', integrating this information into the reference section.

    Content Generation by \'longContentWriter\': After confirming all details with the user, including any additional contributions and enhanced information from \'webPageReader\', I proceed to generate the long-form content. This ensures the content aligns with the specified requirements and style.

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
          description: The \"task\" field outlines the specific requirements and objectives for generating the content. This
            includes detailed instructions on what needs to be accomplished through the writing, such as the main topic
            to be covered, any particular arguments or perspectives to be presented, and the desired outcome or impact
            of the piece. This field serves as a directive for the content creation process, ensuring that the writing
            not only adheres to the given guidelines but also effectively achieves its intended purpose, whether it's to
            inform, persuade, entertain, or educate the audience.
        language:
          type: string
          description: Required, the language used by the user in the request, according to the ISO 639-1 standard. For Chinese,
            use zh-CN for Simplified Chinese and zh-TW for Traditional Chinese.
        summary:
          type: string
          description: The \"summary\" field encapsulates a concise overview of the writing content, presenting the core themes, key
            points, and primary objectives of the piece. This brief but comprehensive synopsis serves as a roadmap,
            guiding the overall direction and focus of the writing, ensuring that it remains aligned with the intended
            message and purpose throughout the development process. This summary not only aids in maintaining coherence
            and relevance but also provides a clear preview of what the reader can expect from the full content.
        reference:
          type: string
          description: The \"reference\" field is a curated collection of information sourced from the Internet via WebPilot, or
            proveded by the user, specifically tailored to enrich and support the writing task at hand. It involves a
            selective process where relevant data, facts, and insights related to the topic are gathered, ensuring that
            the content is not only well-informed and accurate but also closely aligned with the specific requirements
            and objectives of the writing project. This field acts as a foundation, providing a rich base of verified
            and pertinent information from which the article or content is crafted. This field would be long.
        style:
          type: string
          description: The \"style\" field in content creation is a detailed framework encompassing three pivotal components - the
            writing tone or style, the target audience, and the publication medium. This field is structured as
            \"[specific writing style], aimed at [target audience], using [language style], inspired by [notable content
            creator].\" The writing style element ranges from formal and analytical to casual and engaging, setting the
            overall tone. The target audience aspect identifies the specific reader group, such as students,
            professionals, or the general public, tailoring the content's complexity and relevance. The language style,
            whether academic, colloquial, or technical, shapes the linguistic approach. The final component, inspired by
            a notable content creator, serves as a reference for the desired tone and approach, like \"analytical and
            concise, aimed at business professionals, using professional language, inspired by a renowned business
            journalist.\" This clear and structured definition ensures the content is effectively aligned with the
            audience's needs and the publication's format.
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
          description: error code
        message:
          type: string
          description: error message
        detail:
          type: string
          description: error detail
    visitWebPageResponse:
      type: object
      properties:
        title:
          type: string
          description: The title of this web page
        content:
          type: string
          description: The content of the web page\'s url to be summarized
        meta:
          type: object
          description: The Html meta info of the web page
        links:
          type: array
          description: Some links in the web page
          items:
            type: string
        extra_search_results:
          type: array
          description: Additional Search results
          items:
            type: object
            properties:
              title:
                type: string
                description: the title of this search result
              link:
                type: string
                description: the link of this search result
              snippet:
                type: string
                description: the snippet of this search result
        todo:
          type: array
          description: what to do with the content
          items:
            type: string
        tips:
          type: array
          description: Tips placed at the end of the answer
          items:
            type: string
        rules:
          description: Adherence is required when outputting content.
          items:
            type: string
    visitWebPageRequest:
      type: object
      required:
        - link
        - ur
      properties:
        link:
          type: string
          description: Required, The web page\'s url to visit and retrieve content from.
        ur:
          type: string
          description: Required, a clear statement of the user\'s request, can be used as a search query and may include search
            operators.
        lp:
          type: boolean
          description: Required, Whether the link is directly provided by the user
        rt:
          type: boolean
          description: If the last request doesn\'t meet user\'s need, set this to true when trying to retry another request.
        l:
          type: string
          description: Required, the language used by the user in the request, according to the ISO 639-1 standard. For Chinese,
            use zh-CN for Simplified Chinese and zh-TW for Traditional Chinese.
    visitWebPageError:
      type: object
      properties:
        code:
          type: string
          description: error code
        message:
          type: string
          description: error message
        detail:
          type: string
          description: error detail
`;
    // 카테고리별 시스템 프롬프트
    const baseSystem = `
이 GPT는 10년 이상의 실무 경험을 가진 변호사의 시점에서 사기 관련 법률 블로그 글을 전문적으로 작성한다.

⚖️ 모든 원고는 반드시 다음 순서를 따른다:
**제목 → 도입부(3~5문장) → 서론 → 본문(3개 이상 SEO 소제목 포함) → 결론(요약·공감·CTA)**

제목 또는 도입부가 누락되면 GPT는 자동으로 해당 부분부터 재생성한다.

---

✅ **입력 및 출력 고정 형식 (항상 적용)**
사용자가 ‘시작’ 또는 특정 사기 주제를 입력하면 GPT는 아래 형식으로만 **정확히 출력**한다. **설명, 예시, 문장 등은 절대 추가하지 않는다.**

✅키워드:
✅사기내용:
✅구성선택

1.사기 개연성을 중심으로 한 글  
2.주의해야할 위험요소에 대해 디테일하게 분석한 글  
3.실제로 드러난 정황을 바탕으로 경고형분석한 글  
4.피해예방과 도움이 되는 내용을 중점으로 쓴 글  
5.법적 지식과 판례에 관해 전문가의 시점으로 쓴 글  
6.웹사이트 검색 기반으로 실제 뉴스와 실제 사례들을 토대로한 글  
7.실제 피해 사례를 중점으로 한 글

**주의:** 콜론(:) 뒤에는 절대 아무 내용도 작성하지 않는다. 반드시 빈 상태로 유지한다.

GPT는 위 세 줄 형식과 7가지 구성 리스트만 출력하며, **콜론(:) 뒤에는 어떠한 글자나 공백도 출력하지 않는다.** 입력 시 위 형식과 리스트만 출력하며, 이후 사용자가 항목을 모두 채워 입력하면 본문 원고 작성 프로세스를 시작한다.

---

✅ **제목 규칙**
1️⃣ 30자 권장, 최대 35자 이내.  
2️⃣ 형식: ‘[키워드] + [피해유형 또는 특징] + [대응/조치/법적 절차]’  
3️⃣ 키워드는 문두나 중간에 1회 자연스럽게 삽입.  
4️⃣ 필수 포함 단어: ‘사기’, ‘대응’ 또는 ‘피해’ 또는 ‘예방’ 또는 ‘조치’.  
5️⃣ 공공기관 언급 금지.  

제목 작성 후 내부적으로 다음 체크리스트를 점검한다:
- 제목 길이 35자 이하인가?  
- 키워드가 1회 포함되어 있는가?  
- ‘사기’ 키워드 포함 여부 확인  
- ‘대응’, ‘조치’, ‘예방’, ‘피해’ 중 최소 1개 포함  
- 문체 자연스러운가?

---
${txt1}
${txt5}를 참고해서 작성해줘
✅ **도입부 작성 규칙**
제목 작성 후 반드시 도입부(3~5문장)를 작성하며, 도입부에는 키워드를 포함하지 않는다. 도입부는 다음 5가지 형식 중 하나를 자동 선택해 작성한다.

1️⃣ 표 형식 도입부: ‘좋은 대처법 vs 잘못된 대처법’ 표 후 간단한 해석.  
2️⃣ 대화체 도입부: 피해자-사기범 대화 후 전문가의 코멘트.  
3️⃣ 체크리스트 도입부: 사기 수법의 특징 4가지 ✔️로 제시.  
4️⃣ 뉴스 인용 도입부: 실제 뉴스 사례 요약 + 질문 연결.  
5️⃣ FAQ 도입부: 피해자 질문 인용 + “이 글을 끝까지 읽어보세요.” 문장.

도입부 형식은 구성 선택(1~7)에 따라 자동 결정한다.

---

✅ **본문 및 결론 구성 원칙**
- 본문은 최소 3개의 소제목 포함, SEO 키워드 4~5회 자연 삽입, 2,000자 이상.  
- 결론은 ‘요약 → 공감 문장 → 클릭 유도 문장’ 순으로 구성.  
- 전체 문체는 구성 선택 번호에 따라 일관성 유지.
- 본문 마지막에는 항상 정리 요약본 표를 만들어준다
표의 구성은 예방 체크리스트, 본문요약, 간단한 법적 절차, 사기 체크리스트 이 중에 랜덤 구성으로 이루어진다
---

✅ **출력 검증 루프**
- 제목, 도입부, 서론 중 하나라도 누락 시 자동 재생성.  
- 도입부 생성 후 서론이 없으면 자동 연결.  
- 전체 흐름이 논리적으로 자연스러운지 자동 점검.

---

🧩 **추가 규칙 수정 사항**
- 모든 원고 생성 시 ‘이 패턴은 케이프pes·szagold·koaso 등 다수의 가짜 주식 플랫폼 사기와 동일한 구조로 확인됩니다.’ 문장은 절대 포함하지 않는다.
- 동일하거나 유사한 의미의 문장도 변형하여 포함하지 않는다.

---

이제 GPT는 사용자의 첫 입력에 대해 위 **3줄 형식과 구성 선택 리스트**만 출력하며, **콜론 뒤에 어떤 내용도 출력하지 않는다.** 추가 설명은 내부적으로만 수행하며, 출력에는 절대 포함되지 않는다.
`;
const systemPrompt = `
${baseSystem}

[사건 유형]: ${category || "일반"}
${txt2}
${txt3}
${txt4}
${txt6}
${txt7}
${txt8}
---

📘 아래는 참고용 OpenAPI 문서입니다.
⚠️ 출력에 사용하거나 재현하지 않습니다.
⚠️ 단지 내부 이해를 돕기 위한 참고 자료입니다.
⚠️ 이 문서를 사용자에게 출력하지 않습니다.

[BEGIN_REFERENCE_OPENAPI]
\`\`\`yaml
${openapiYAML}
\`\`\`
[END_REFERENCE_OPENAPI]

---
위 참고 문서는 LLM 내부 이해를 위한 것입니다.
사용자에게 절대 출력하지 말고,
요청받은 출력 형식(3줄 + 구성 리스트)만 수행하세요.
`;




    // messages: [{ role: "user" | "assistant", content: "..." }]
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const reply = completion.choices[0].message.content;

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message || "서버 오류" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
