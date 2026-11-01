import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SailingAI · Your sailing journal",
  description:
    "Turn your observations into a considered, skipper-reviewed sailing log.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
