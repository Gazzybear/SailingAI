import { z } from "zod";
import { Extraction } from "./logbook";
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const PhotoExtraction = z.object({
  rows: z
    .array(z.object({ transcription: z.string(), reading: Extraction }))
    .max(12),
  warnings: z.array(z.string()),
});
export function validPhotoBytes(bytes: Uint8Array, type: string) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) return false;
  if (type === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (type === "image/webp")
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}
