import { PageTitle } from "@/shared/ui/typography";

export function Heading() {
  return (
    <PageTitle className="mb-4 tracking-tight">
      Раскраски по&nbsp;номерам{" "}
      <span className="relative inline-block">
        <span className="relative z-10 text-rose-400">Artmate</span>
        <svg
          className="absolute -bottom-1 left-0 w-full"
          height="6"
          viewBox="0 0 160 6"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M2 4 Q80 0 158 4"
            stroke="#fca5a5"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </span>{" "}
      для&nbsp;отдыха и&nbsp;творчества
    </PageTitle>
  );
}
