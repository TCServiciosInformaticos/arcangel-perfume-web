import { useState, type ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & {
  src?: string | null;
  fallbackSrc?: string | null;
};
/** Remount the source state on URL changes, so repaired images can load again. */
export function ProductImage(props: Props) {
  return <ImageSources key={JSON.stringify([props.src, props.fallbackSrc])} {...props} />;
}
function ImageSources({ src, fallbackSrc, alt = "", className, ...rest }: Props) {
  const sources = [...new Set([src, fallbackSrc].filter((s): s is string => !!s?.trim()))];
  const [index, setIndex] = useState(0);
  return sources[index] ? (
    <img
      {...rest}
      src={sources[index]}
      alt={alt}
      className={className}
      onError={() => setIndex((i) => i + 1)}
    />
  ) : (
    <div
      role="img"
      aria-label={alt ? `${alt}: imagen no disponible` : "Imagen no disponible"}
      className={`flex items-center justify-center bg-secondary/40 text-center text-sm text-muted-foreground ${className ?? ""}`}
    >
      <span>
        El Arcángel
        <br />
        <span className="text-xs">Imagen no disponible</span>
      </span>
    </div>
  );
}
