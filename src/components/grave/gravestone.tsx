import type { PublicGraveDto } from "@/domain";

type GravestoneProps = {
  grave: Pick<PublicGraveDto, "title" | "epitaph" | "style" | "accent" | "isExample">;
  compact?: boolean;
  showText?: boolean;
  className?: string;
};

export function Gravestone({ grave, compact = false, showText = true, className = "" }: GravestoneProps) {
  return (
    <div
      className={`gravestone gravestone-${grave.style} ${compact ? "gravestone-compact" : ""} ${className}`}
      data-accent={grave.accent}
      aria-hidden={compact ? true : undefined}
    >
      <div className="gravestone-glow" />
      <div className="gravestone-body">
        <div className="gravestone-age" />
        {grave.style === "moss" ? <span className="grave-moss" /> : null}
        {grave.style === "wildflowers" ? (
          <span className="grave-flowers">
            <i />
            <i />
            <i />
          </span>
        ) : null}
        {grave.style === "lantern" ? <span className="grave-lantern" /> : null}
        {showText ? (
          <div className="gravestone-copy">
            <p className="gravestone-title">{grave.title}</p>
            {!compact && grave.epitaph ? <p className="gravestone-epitaph">{grave.epitaph}</p> : null}
          </div>
        ) : null}
      </div>
      <div className="gravestone-base" />
      {grave.isExample && !compact ? <span className="stone-example">Example</span> : null}
    </div>
  );
}
