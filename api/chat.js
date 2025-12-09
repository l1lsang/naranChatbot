import OpenAI from "openai";

export const config = { runtime: "edge" };

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// JSON Response 헬퍼
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export default async function handler(req) {
  try {
    // ---------------------------------
    // 1) 항상 POST만 허용
    // ---------------------------------
    if (req.method !== "POST") {
      return json({ error: "Only POST allowed" }, 405);
    }

    // ---------------------------------
    // 2) body 파싱 (edge 안전 처리)
    // ---------------------------------
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json({ error: "JSON 파싱 실패", detail: e.message }, 400);
    }

    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return json({ error: "messages 배열이 필요합니다." }, 400);
    }

    // ---------------------------------
    // 3) GPT 요청
    // ---------------------------------
    let completion;
    try {
      completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "너는 사기 피해 관련 법률 상담을 쉽게 설명해주는 어시스턴트야. 사용자의 상황을 최대한 공감하면서, 법률적인 정보는 신중하게, 모르는 부분은 추측하지 말고 솔직하게 이야기해.",
          },
          ...messages,
        ],
      });
    } catch (e) {
      return json(
        {
          error: "OpenAI 요청 실패",
          detail: e.message,
        },
        500
      );
    }

    const reply = completion?.choices?.[0]?.message?.content || "";

    return json({ reply });
  } catch (err) {
    // 🔥 절대 HTML 반환하지 않게 최상위 에러도 JSON으로 강제!
    return json(
      {
        error: "SERVER_CRASH",
        detail: err?.message || String(err),
      },
      500
    );
  }
}
