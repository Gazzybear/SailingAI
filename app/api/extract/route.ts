import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { Extraction } from "@/lib/logbook";
import { extractionInstructions } from "@/lib/extraction-instructions";
export const runtime = "nodejs";
const Input = z.object({ observation: z.string().trim().min(1).max(4000) });
export async function POST(request: Request) {
  if (process.env.LIVE_AI_ENABLED !== "true")
    return Response.json(
      {
        error:
          "Live AI is disabled. Use the labelled sample or add an entry manually.",
      },
      { status: 503 },
    );
  if (!process.env.OPENAI_API_KEY)
    return Response.json(
      {
        error:
          "The server needs an OpenAI API key. Your note is safe here; you can add it manually.",
      },
      { status: 503 },
    );
  try {
    if (Number(request.headers.get("content-length") || 0) > 20000)
      return Response.json(
        { error: "Observation is too long." },
        { status: 413 },
      );
    const raw = await request.text();
    if (raw.length > 16000)
      return Response.json(
        { error: "Observation is too long." },
        { status: 413 },
      );
    const parsed = Input.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return Response.json(
        { error: "Enter an observation between 1 and 4,000 characters." },
        { status: 400 },
      );
    const client = new OpenAI({ timeout: 30000, maxRetries: 0 });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-6-luna",
      store: false,
      max_output_tokens: 3500,
      input: [
        {
          role: "system",
          content:
            extractionInstructions +
            " Extract ONE observation. Multiple separate timed events: leave measurements null and warn the user to split notes.",
        },
        { role: "user", content: parsed.data.observation },
      ],
      text: { format: zodTextFormat(Extraction, "sailing_observation") },
    });
    if (response.status !== "completed" || !response.output_parsed)
      return Response.json(
        {
          error:
            "The observation could not be extracted. Try a shorter note or enter it manually.",
        },
        { status: 422 },
      );
    return Response.json({ reading: Extraction.parse(response.output_parsed) });
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json({ error: "Invalid request." }, { status: 400 });
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    return Response.json(
      {
        error:
          status === 429
            ? "The AI service is busy or its quota is exhausted. Try later or log manually."
            : status === 401 || status === 403
              ? "The server cannot access the AI service. Check its credentials."
              : "AI preparation failed or timed out. Your note has been retained; try again or log manually.",
      },
      { status: status === 429 ? 429 : 502 },
    );
  }
}
