
import Groq from "groq-sdk";

const client = new Anthropic({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req) {
  try {
    const { docsText, whiteboardText } = await req.json();

    const hasDoc = docsText?.trim().length > 0;
    const hasWb  = whiteboardText?.trim().length > 0;

    if (!hasDoc && !hasWb) {
      return new Response(
        JSON.stringify({ error: "Nothing to summarize — both doc and whiteboard are empty." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build a focused prompt from whatever content we have
    const sections = [];
    if (hasDoc) sections.push(`## Collaborative Document\n${docsText.trim()}`);
    if (hasWb)  sections.push(`## Whiteboard Notes\n${whiteboardText.trim()}`);

    const userPrompt = `You are a meeting intelligence assistant. Analyze the following collaborative content from a live session and produce a clear, structured summary.

${sections.join("\n\n")}

---

Produce a summary with these sections (only include a section if relevant content exists):

**📋 Overview**
One or two sentences capturing the core topic or purpose of this session.

**🔑 Key Points**
Bullet list of the most important ideas, decisions, or facts discussed.

**✅ Action Items**
Specific tasks, next steps, or follow-ups mentioned. If none, omit this section.

**💡 Insights**
Any notable patterns, open questions, or ideas worth highlighting.

Be concise. Use plain language. Do not invent content not present in the source material.`;

    // Stream the response back to the client
    const stream = await client.messages.stream({
      
model: "llama-3.3-70b-versatile",


      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta?.type === "text_delta"
            ) {
              const data = `data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`)
          );
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