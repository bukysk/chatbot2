import OpenAI from "openai";
import { retrieveRagChunks } from "../../../lib/pdfIndex";
import { addRetrieval } from '../../../lib/retrievalDebugStore';
import runtimeConfig from '../../../lib/runtimeConfig';
import crypto from 'crypto';

export const runtime = "nodejs"; // use node for streaming stability

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response("Missing OPENAI_API_KEY", { status: 500 });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];
    // Allow client to pass a debugSessionId to group retrievals for the conversation in the debug store.
    // If not provided, we generate a short id and return it in a response header so the client can poll debug endpoints.
    let debugSessionId: string | undefined = body.debugSessionId;
    if (!debugSessionId) debugSessionId = `s-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    let systemPrompt: string | undefined = body.systemPrompt;
    const includeSubjectContext: boolean = body.includeSubjectContext ?? runtimeConfig.getEffectiveConfig().INCLUDE_SUBJECT_CONTEXT; // default from runtime config
    if (includeSubjectContext && systemPrompt) {
      // Zostav query z poslednej user správy (ak existuje) na získanie relevantných chunkov
      const lastUser = [...messages].reverse().find(m => m.role === "user");
      const query = lastUser?.content || systemPrompt.slice(0, 500);
      try {
        // Use RAG retrieval: return top-5 chunk-level hits (explicitly excluding centroid/subject-level entries).
        const detailed = await retrieveRagChunks(query, 5);
        const contextChunks = detailed.map(d => d.text);
        if (contextChunks.length) {
          systemPrompt += `\n\nDoplňujúci kontext z informačných listov predmetov (použi len ak relevantné, neparafrázuj zbytočne):\n${contextChunks.map((c, i) => `[${i+1}] ${c}`).join('\n')}`;
        }
        // Record retrieval in dev-only debug store (includes query, chunk ids, scores and optional message snapshot)
        try {
          addRetrieval(debugSessionId!, { timestamp: new Date().toISOString(), query, chunks: detailed, messages: lastUser });
        } catch (e) {
          console.warn('Failed to add retrieval to debug store', e);
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

    const temp = runtimeConfig.getEffectiveConfig().CHAT_TEMPERATURE ?? 0.7;
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: temp,
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
        // expose the debug session id so client dev tooling can poll /api/debug/session/:id
        "x-debug-session": debugSessionId!,
      },
    });
  } catch (e: any) {
    return new Response(e.message || "Unknown error", { status: 500 });
  }
}
