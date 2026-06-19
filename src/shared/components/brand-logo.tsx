import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      alt="Espaco Personalize"
      className={className}
      height={90}
      priority={priority}
      src="/brand/ep-logo-site.png"
      width={160}
    />
  );
}
