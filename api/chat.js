import OpenAI from "openai";

export const config = { runtime: "edge" };

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req) {
  try {
    if (req.method && req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { messages } = await req.json();

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages 배열이 필요합니다." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const completion = await client.chat.completions.create({
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

    const reply = completion.choices[0]?.message?.content || "";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message || "서버 오류" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
