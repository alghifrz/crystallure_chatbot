import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-noyh",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Crystallure Smart Chatbot",
  description: "AI-powered chatbot for Crystallure products information",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-noyh antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
