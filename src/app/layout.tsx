import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const marsek = localFont({
  src: "./fonts/Marsek-Demi.ttf",
  variable: "--font-marsek",
  weight: "600",
});

export const metadata: Metadata = {
  title: "HIEROS",
  description: "HIEROS — Terminal HUD",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${marsek.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
