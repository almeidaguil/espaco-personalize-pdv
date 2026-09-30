export type BrandKey = "espaco-personalize" | "roberto";

type BrandConfig = {
  name: string;
  shortName: string;
  description: string;
  logo: string;

  colors: {
    primary: string;
    primaryHover: string;
    accent: string;
    background: string;
    surface: string;
    foreground: string;
    muted: string;
  };
};

const brands: Record<BrandKey, BrandConfig> = {
  "espaco-personalize": {
    name: "Espaço Personalize",
    shortName: "EP",
    description: "Sistema de gestão e vendas",
    logo: "/brand/ep-logo-site.png",

    colors: {
      primary: "#1e3275",
      primaryHover: "#17275c",
      accent: "#f5c313",
      background: "#f6f7fb",
      surface: "#ffffff",
      foreground: "#0f172a",
      muted: "#64748b",
    },
  },

  roberto: {
    name: "Roberto Multimarcas",
    shortName: "Roberto",
    description: "Sistema de gestão e vendas da Roberto Multimarcas",
    logo: "/brand/logorobertomultimarcas.webp",

    colors: {
      primary: "#111111",
      primaryHover: "#262626",
      accent: "#cda34f",
      background: "#f7f5f0",
      surface: "#ffffff",
      foreground: "#171717",
      muted: "#6b7280",
    },
  },
};

const DEFAULT_BRAND: BrandKey = "roberto";

const requestedBrand = process.env.NEXT_PUBLIC_BRAND;

function isBrandKey(value: string | undefined): value is BrandKey {
  return value !== undefined && value in brands;
}

export const brand =
  brands[isBrandKey(requestedBrand) ? requestedBrand : DEFAULT_BRAND];
