import type { Metadata } from "next";
import { Bebas_Neue, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const displayFont = Bebas_Neue({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "570 Church Softball League",
  description:
    "Official schedule, standings, rosters, rules, and admin reporting for the 570 Church Softball League.",
  icons: {
    icon: [
      { url: "/all-glory-to-god.ico", type: "image/x-icon" },
      { url: "/all-glory-to-god.png", type: "image/png" },
    ],
    shortcut: ["/all-glory-to-god.ico"],
    apple: [{ url: "/all-glory-to-god.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>{children}</body>
    </html>
  );
}
