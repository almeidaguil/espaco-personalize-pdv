import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";

import { brand } from "@/shared/config/brand";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${brand.name} | Sistema de Gestão`,
    template: `%s | ${brand.name}`,
  },
  description: brand.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: brand.colors.primary,
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  const brandStyles = {
    "--brand-primary": brand.colors.primary,
    "--brand-primary-hover": brand.colors.primaryHover,
    "--brand-accent": brand.colors.accent,
    "--brand-background": brand.colors.background,
    "--brand-surface": brand.colors.surface,
    "--brand-foreground": brand.colors.foreground,
    "--brand-muted": brand.colors.muted,

    "--background": brand.colors.background,
    "--foreground": brand.colors.foreground,
    "--surface": brand.colors.surface,
    "--muted": brand.colors.muted,
  } as CSSProperties;

  return (
    <html lang="pt-BR">
      <body style={brandStyles}>{children}</body>
    </html>
  );
}
