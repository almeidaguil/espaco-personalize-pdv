import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OfflineStatus } from "@/shared/components/offline-status";
import { ServiceWorkerRegistration } from "@/shared/components/service-worker-registration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Espaco Personalize PDV",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EP PDV",
  },
  description: "Sistema privado para vendas presenciais em eventos.",
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { sizes: "192x192", type: "image/png", url: "/icons/icon-192.png" },
      { sizes: "512x512", type: "image/png", url: "/icons/icon-512.png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  title: "Espaco Personalize PDV",
};

export const viewport: Viewport = {
  themeColor: "#1e3275",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ServiceWorkerRegistration />
        <OfflineStatus />
        {children}
      </body>
    </html>
  );
}
