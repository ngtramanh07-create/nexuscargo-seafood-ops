import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexusCargo Seafood Ops",
  description: "Điều phối công việc xuất khẩu tôm và cá tra bằng container lạnh.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
