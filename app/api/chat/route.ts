import OpenAI from "openai";
import { retrieveSubjectContext } from "../../../lib/pdfIndex";

export const runtime = "nodejs"; // use node for streaming stability

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response("Missing OPENAI_API_KEY", { status: 500 });
  }

  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];
    let systemPrompt: string | undefined = body.systemPrompt;
    const includeSubjectContext: boolean = body.includeSubjectContext ?? true; // default zapnute pre prvú správu
    if (includeSubjectContext && systemPrompt) {
      // Zostav query z poslednej user správy (ak existuje) na získanie relevantných chunkov
      const lastUser = [...messages].reverse().find(m => m.role === "user");
      const query = lastUser?.content || systemPrompt.slice(0, 500);
      try {
        const contextChunks = await retrieveSubjectContext(query, 3);
        if (contextChunks.length) {
          systemPrompt += `\n\nDoplňujúci kontext z informačných listov predmetov (použi len ak relevantné, neparafrázuj zbytočne):\n${contextChunks.map((c,i)=>`[${i+1}] ${c}`).join('\n')}`;
        }
      } catch (err) {
        // Ak retrieval zlyhá, pokračujeme bez obohatenia
        console.error('Retrieval error', err);
      }
    }

    const chatMessages: ChatMessage[] = [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      ...messages,
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of completion) {
            const delta = part.choices[0]?.delta?.content;
            if (delta) {
              controller.enqueue(encoder.encode(delta));
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new Response(e.message || "Unknown error", { status: 500 });
  }
}
