import Image from "next/image";

interface LogoProps {
  href?: string;
  className?: string;
  textClassName?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

const textSizeMap = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

/**
 * ロゴコンポーネント
 */
export function Logo({ href = "/", className = "", textClassName = "", size = "md" }: LogoProps) {
  const logoContent = (
    <div className={`flex items-center gap-3 hover:opacity-80 transition-opacity ${className}`}>
      <div className={`relative ${sizeMap[size]}`}>
        <Image
          src="/logo.png"
          alt="ScoreFlow"
          fill
          className="object-contain"
          unoptimized
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
      <span className={`font-bold text-gray-900 ${textSizeMap[size]} ${textClassName}`}>
        ScoreFlow
      </span>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {logoContent}
      </a>
    );
  }

  return logoContent;
}

