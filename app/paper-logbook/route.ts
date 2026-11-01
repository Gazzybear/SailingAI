import { paperLogbookTemplate } from "@/lib/paper-template";
export function GET() {
  return new Response(paperLogbookTemplate(), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
