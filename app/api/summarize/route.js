// app/api/summarize/route.js
import Groq from "groq-sdk";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req) {
  try {
    const { docsText } = await req.json();

    if (!docsText?.trim()) {
      return new Response(
        JSON.stringify({ error: "Document is empty — add some content first." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `You are a meeting intelligence assistant. Analyze the following collaborative document from a live session and produce a clear, structured summary.

## Document Content
${docsText.trim()}

---

Produce a summary with these sections (only include a section if relevant content exists):

**📋 Overview**
One or two sentences capturing the core topic or purpose of this document.

**🔑 Key Points**
Bullet list of the most important ideas, decisions, or facts.

**✅ Action Items**
Specific tasks, next steps, or follow-ups mentioned. If none, omit this section.

**💡 Insights**
Any notable patterns, open questions, or ideas worth highlighting.

Be concise. Use plain language. Do not invent content not present in the source material.`;

    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      stream: true,
      messages: [{ role: "user", content: userPrompt }],
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[/api/summarize]", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}