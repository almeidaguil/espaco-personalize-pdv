import Image from "next/image";

import { brand } from "@/shared/config/brand";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      alt={brand.name}
      className={className}
      height={120}
      priority={priority}
      src={brand.logo}
      width={240}
    />
  );
}
