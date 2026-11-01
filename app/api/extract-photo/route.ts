import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { extractionInstructions } from "@/lib/extraction-instructions";
import {
  MAX_PHOTO_BYTES,
  PhotoExtraction,
  validPhotoBytes,
} from "@/lib/photo-logbook";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (process.env.LIVE_AI_ENABLED !== "true" || !process.env.OPENAI_API_KEY)
    return Response.json(
      {
        error:
          "Photo reading needs live AI to be configured. You can still download the paper template or enter observations manually.",
      },
      { status: 503 },
    );
  try {
    const type = request.headers.get("content-type")?.split(";")[0] ?? "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(type))
      return Response.json(
        {
          error:
            "Choose a JPEG, PNG or WebP photo. Convert HEIC/PDF to an image first.",
        },
        { status: 415 },
      );
    if (Number(request.headers.get("content-length") || 0) > MAX_PHOTO_BYTES)
      return Response.json(
        { error: "Photo must be 6 MB or smaller." },
        { status: 413 },
      );
    // Bound streaming reads too: a missing or dishonest Content-Length cannot bypass the limit.
    const reader = request.body?.getReader();
    if (!reader)
      return Response.json(
        { error: "No photo was received." },
        { status: 400 },
      );
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_PHOTO_BYTES) {
        await reader.cancel();
        return Response.json(
          { error: "Photo must be 6 MB or smaller." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    if (!validPhotoBytes(bytes, type))
      return Response.json(
        { error: "The file is not a valid supported photo." },
        { status: 400 },
      );
    const client = new OpenAI({ timeout: 60000, maxRetries: 0 });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-6-luna",
      store: false,
      max_output_tokens: 12000,
      input: [
        {
          role: "system",
          content:
            extractionInstructions +
            " Transcribe a photographed paper logbook. Return up to 12 separate observation rows in page order. Do not combine readings from different rows. Include a faithful transcription for each row, using [unclear] for unreadable text. Ignore empty template rows. Return rows=[] with a warning if no actual observations can be read. Warn if the page contains more than 12 rows and ask for a cropped remaining section. Include visible page dates/timezone in the transcription only; the user must confirm each date/time. Page-level warnings belong in warnings.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Read the observations from this paper logbook photo for skipper review.",
            },
            {
              type: "input_image",
              image_url: `data:${type};base64,${bytes.toString("base64")}`,
              detail: "high",
            },
          ],
        },
      ],
      text: { format: zodTextFormat(PhotoExtraction, "paper_logbook") },
    });
    if (response.status !== "completed" || !response.output_parsed)
      return Response.json(
        {
          error:
            "The page could not be read completely. Try a sharper photo or crop to fewer rows.",
        },
        { status: 422 },
      );
    return Response.json(PhotoExtraction.parse(response.output_parsed));
  } catch (error) {
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    return Response.json(
      {
        error:
          status === 429
            ? "AI quota is exhausted or busy. Try later or enter the readings manually."
            : "Photo reading failed or timed out. Try a clearer photo or fewer rows; nothing has been saved.",
      },
      { status: status === 429 ? 429 : 502 },
    );
  }
}
