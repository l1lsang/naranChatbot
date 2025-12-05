import OpenAI from "openai";

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

    // 카테고리별 시스템 프롬프트
    const baseSystem = `
너는 '법무법인 나란'의 AI 상담 챗봇이야.
너는 변호사가 아니고, 1차 안내 및 정리 역할을 하며,
항상 "정확한 법률 판단은 담당 변호사의 최종 자문이 필요하다"는 점을 상기시켜줘.
답변은 최대한 쉬운 한국어로, 번호 매기기와 문단 구분을 적절히 사용해 설명해.
`;

    const categoryDescriptionMap = {
      "민사": "민사(계약 분쟁, 채권·채무, 손해배상, 임대차 등) 관련 기초 설명과 준비 서류를 중심으로 안내해줘.",
      "형사": "형사(사기, 폭행, 절도, 성범죄 등) 사건에서 피의자·피고인 또는 피해자가 어떤 절차를 밟을 수 있는지 중심으로 안내해줘.",
      "가사": "이혼, 양육권, 상속, 재산분할 등 가사 사건 위주로, 감정적인 부분에도 공감하면서 설명해줘.",
      "노동": "해고, 임금 체불, 산업재해, 직장 내 괴롭힘 등 노동 관련 분쟁에 대해, 근로자의 입장에서 이해하기 쉽게 안내해줘.",
      "기타": "어떤 분야든 기본적인 방향성과 '어디에서, 무엇을, 어떻게' 준비해야 할지 안내해줘.",
    };

    const categoryText = categoryDescriptionMap[category] || "사건 유형이 일반이거나 아직 명확하지 않으니, 사용자의 설명을 차분히 정리해주고 추가로 물어볼 내용을 제안해줘.";

    const systemPrompt = `${baseSystem}\n\n[사건 유형]: ${category || "일반"}\n${categoryText}`;

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
