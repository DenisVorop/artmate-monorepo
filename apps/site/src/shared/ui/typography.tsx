import type { ReactNode, HTMLAttributes } from "react";

// ─── PageTitle ── h1 для страниц ──────────────────────────────────────────────
export function PageTitle({
  children,
  className = "",
  style,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={`font-display leading-tight font-bold text-stone-900 ${className}`}
      style={{ fontSize: "clamp(1.5rem, 4vw, 2.7rem)", ...style }}
      {...rest}
    >
      {children}
    </h1>
  );
}

// ─── SectionTitle ── h2 для секций ───────────────────────────────────────────
export function SectionTitle({
  children,
  className = "",
  style,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={`font-display leading-tight font-bold text-stone-900 ${className}`}
      style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.75rem)", ...style }}
      {...rest}
    >
      {children}
    </h2>
  );
}

// ─── CardTitle ── h3 для карточек, шагов и т.д. ──────────────────────────────
export function CardTitle({
  children,
  className = "",
  style,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`font-display font-bold text-stone-900 ${className}`}
      style={{ fontSize: "1.25rem", ...style }}
      {...rest}
    >
      {children}
    </h3>
  );
}

// ─── SectionLabel ── маленькая надпись-лейбл над заголовком секции ────────────
const LABEL_COLORS: Record<string, string> = {
  rose: "text-rose-400",
  amber: "text-amber-500",
  violet: "text-violet-500",
  emerald: "text-emerald-500",
  sky: "text-sky-500",
  stone: "text-stone-500",
};

export function SectionLabel({
  children,
  color = "rose",
}: {
  children: ReactNode;
  color?: keyof typeof LABEL_COLORS;
}) {
  const textColor = LABEL_COLORS[color] ?? "text-rose-400";
  return (
    <div className={`flex items-center gap-2 ${textColor}`}>
      <span className="h-0.5 w-6 shrink-0 rounded-full bg-current" />
      <span className="text-xs font-bold tracking-widest uppercase">{children}</span>
    </div>
  );
}

// ─── SectionSubtitle ── описательный абзац под h1 / h2 ───────────────────────
export function SectionSubtitle({
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-sm leading-relaxed text-stone-400 ${className}`} {...rest}>
      {children}
    </p>
  );
}
