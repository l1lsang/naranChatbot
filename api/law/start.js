import OpenAI from "openai";

export const config = {
  runtime: "edge",
};

const FIXED_TEMPLATE = `\
✅키워드:
✅사기내용:
✅구성선택:

1.사기 개연성을 중심으로 한 글  
2.주의해야할 위험요소에 대해 디테일하게 분석한 글  
3.실제로 드러난 정황을 바탕으로 경고형분석한 글  
4.피해예방과 도움이 되는 내용을 중점으로 쓴 글  
5.법적 지식과 판례에 관해 전문가의 시점으로 쓴 글  
6.웹사이트 검색 기반으로 실제 뉴스와 실제 사례들을 토대로한 글  
7.실제 피해 사례를 중점으로 한 글`;

export default async function handler(req) {
  try {
    const { messages } = await req.json();
    const lastMsg = messages?.[messages.length - 1]?.content?.trim();

    // 사용자가 '시작'이라고 하면 => GPT NO! 그냥 하드코딩된 양식만 출력
    if (lastMsg === "시작") {
      return new Response(FIXED_TEMPLATE, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // 여기 아래는 '본문 생성' 로직.
    // 입력이 3줄 모두 채워졌을 때 GPT를 호출하는 영역.

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      messages,
      temperature: 0,
    });

    return new Response(completion.choices[0].message.content, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
}
