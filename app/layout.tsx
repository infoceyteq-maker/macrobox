import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

const poppins = localFont({
  src: [
    {
      path: "../public/fonts/poppins-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/poppins-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/poppins-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-poppins",
  display: "swap",
});

const montserrat = localFont({
  src: [
    {
      path: "../public/fonts/montserrat-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/montserrat-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MacroBox | Lunch (Rice & Curry)",
  description: "Explore the MacroBox Lunch (Rice & Curry) weekday selection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} ${montserrat.variable}`}>
      <body className="min-h-screen bg-[#DCE6DA] font-sans text-[#2C3E50] antialiased">
        {children}
      </body>
    </html>
  );
}
