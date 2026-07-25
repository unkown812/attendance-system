import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import knowledgeBase from "./src/knowledgeBase.js";

const systemInstruction = `
You are the official support assistant for the AttenMo QR Attendance web application. Your purpose is to help students, CRs (Class Representatives), and educators use and troubleshoot the platform.

Here is your highly authoritative, primary reference source code knowledge base:
<KNOWLEDGE_BASE>
${knowledgeBase}
</KNOWLEDGE_BASE>

Knowledge priority guidelines:
1. The attached knowledge base (highest priority - do not invent any feature not specified here)
2. Official AttenMo website pages
3. Information explicitly provided by the user

Style rules:
- Be clear, concise, practical, and polite.
- Prefer short paragraphs and bullet points.
- When troubleshooting, provide numbered step-by-step instructions.
- Explain technical concepts in simple language.
- Ask only the minimum clarifying questions needed.

Clarification rules:
- If the user's request depends on their role and it is not obvious, first ask: "Are you a student or a CR/educator?"
- If information is missing, ask one brief follow-up question before providing instructions.

Common support topics:
- Google sign-in problems
- Phone login limitations (real SMS OTP delivery is unavailable unless test credentials are configured)
- First-time class setup
- Student list formatting (NAME - ROLLNO)
- QR code generation and attendance sessions
- QR expiry or invalid QR issues
- Duplicate attendance prevention
- Geofence, GPS permission, and location mismatch issues
- Pending attendance requests and CR approval workflow
- Student portal access using Class ID and roll number
- Export Hub usage and missing attendance records

Troubleshooting requirements:
- Separate actions for students and CRs/educators whenever applicable.
- If attendance is pending, explain that it is recorded as present only after CR approval if supported by the knowledge base.
- If a QR code is expired, invalid, or belongs to a closed session, instruct the user to request a new QR from the CR.
- For permission-related issues (camera or location), advise checking browser permissions before retrying.
- When multiple causes are possible, list them from most likely to least likely.

Accuracy requirements:
- Do NOT claim that native Android or iOS apps are required unless confirmed by the knowledge base.
- Do NOT fabricate timelines, guarantees, internal processes, or support policies.
- Do NOT claim access to user accounts, attendance records, databases, or private information.
- Do NOT state that you have verified account-specific data unless it was explicitly provided by the user.

Unsupported requests policy:
- For unsupported customization requests, source-code modifications, or account-specific actions that you cannot perform or verify, explain the limitation and direct the user to the official Contact page if available in the provided sources (e.g. Email: attenmo.tech@gmail.com, WhatsApp: https://chat.whatsapp.com/GDOjvKK7nxGFvQ7NSrQNiG, Instagram: https://www.instagram.com/theattenmo/, LinkedIn: https://www.linkedin.com/in/shivam-kumar-mahto-046228361/).

Uncertainty rule:
- If the answer cannot be determined from available sources, explicitly say so and ask a short clarifying question or recommend checking the official Contact page instead of guessing. Never invent features, policies, workflows, limitations, or fixes.
`;

let aiInstance: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined. Please add it to your AI Studio Secrets panel.");
  }
  if (!aiInstance || cachedApiKey !== apiKey) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    cachedApiKey = apiKey;
  }
  return aiInstance;
}

function isRateLimitOrQuotaError(err: any): boolean {
  const msg = (err?.message || "").toLowerCase();
  const status = err?.status ?? err?.statusCode ?? err?.httpStatus;
  return (
    status === 429 ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("ratequotaexceeded")
  );
}

async function callOpenRouter(openRouterKey: string, messages: any[]): Promise<string> {
  const openAiMessages = [
    { role: "system", content: systemInstruction },
    ...messages.map((msg: any) => ({
      role: msg.role === "assistant" || msg.role === "model" ? "assistant" : "user",
      content: msg.content || "(image attached — description unavailable in fallback mode)"
    }))
  ];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://attenmo.web.app",
      "X-Title": "AttenMo Support"
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: openAiMessages,
      temperature: 0.2,
      max_tokens: 1024
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `OpenRouter responded with ${res.status}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

const MAX_MESSAGES = 12;
const MAX_TEXT_CHARS = 2000;
const MAX_ATTACHMENT_BASE64_CHARS = 1_500_000;
const ALLOWED_ATTACHMENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function validateMessages(messages: any[]): string | null {
  if (messages.length === 0 || messages.length > MAX_MESSAGES) {
    return `Please send between 1 and ${MAX_MESSAGES} messages.`;
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      return "Each message must be an object.";
    }

    if (msg.content !== undefined && typeof msg.content !== "string") {
      return "Message content must be text.";
    }

    if ((msg.content || "").length > MAX_TEXT_CHARS) {
      return `Each message must be ${MAX_TEXT_CHARS} characters or fewer.`;
    }

    if (msg.attachment) {
      const { mimeType, base64 } = msg.attachment;
      if (!ALLOWED_ATTACHMENT_TYPES.has(mimeType) || typeof base64 !== "string") {
        return "Attachments must be PNG, JPEG, or WebP images.";
      }
      if (base64.length > MAX_ATTACHMENT_BASE64_CHARS) {
        return "Attachment is too large.";
      }
    }
  }

  return null;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "2mb" }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Chatbot conversation endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Missing or invalid 'messages' field in request body." });
        return;
      }
      const validationError = validateMessages(messages);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      // Check if API key is present
      const geminiKey = process.env.GEMINI_API_KEY;
      const openRouterKey = process.env.OPENROUTER_API_KEY;

      if (!geminiKey) {
        res.status(500).json({
          error: "API Key Missing",
          message: "GEMINI_API_KEY is required but not configured."
        });
        return;
      }

      // Prepare conversation history for Google Gemini Developer API
      const contents = messages.map((msg: any) => {
        const role = msg.role === "assistant" || msg.role === "model" ? "model" : "user";
        const parts: any[] = [];

        if (msg.content) {
          parts.push({ text: msg.content });
        }

        if (msg.attachment && msg.attachment.mimeType && msg.attachment.base64) {
          parts.push({
            inlineData: {
              mimeType: msg.attachment.mimeType,
              data: msg.attachment.base64
            }
          });
        }

        if (parts.length === 0) {
          parts.push({ text: "" });
        }

        return { role, parts };
      });

      // Set headers for SSE (Server-Sent Events)
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let usedFallback = false;

      try {
        const client = getGeminiClient();

        // Call Gemini 3.5 Flash with Streaming (generateContentStream)
        const responseStream = await client.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.2,
            thinkingConfig: { thinkingBudget: 0 }
          }
        });

        for await (const chunk of responseStream) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
        }

      } catch (geminiErr: any) {
        const isQuota = isRateLimitOrQuotaError(geminiErr);
        console.warn(
          isQuota
            ? "Gemini quota/rate-limit hit — switching to OpenRouter fallback."
            : "Gemini error — switching to OpenRouter fallback.",
          geminiErr?.message || geminiErr
        );

        if (!openRouterKey) {
          console.error("OPENROUTER_API_KEY is not configured. Cannot use fallback.");
          throw geminiErr;
        }

        const replyText = await callOpenRouter(openRouterKey, messages);
        usedFallback = true;

        res.write(`data: ${JSON.stringify({ text: replyText })}\n\n`);
      }

      console.log(`[Local Server] Response generated via ${usedFallback ? "OpenRouter (fallback)" : "Gemini (primary)"}.`);

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      console.error("Gemini API server route error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Server Error",
          message: "An internal error occurred while processing your support query."
        });
      } else {
        res.end();
      }
    }
  });

  // Vite integration middleware (Vite middleware for development, static serve for production)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
