import { OzonPostingUrl } from "@/shared/lib/ozon-posting-url";

export function OzonPostingLinks({
  postingNumbers,
  fbsPostingNumbers,
}: {
  readonly postingNumbers: readonly string[];
  readonly fbsPostingNumbers: readonly string[];
}) {
  if (postingNumbers.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-1 text-sm">
      {postingNumbers.map((number) => (
        <li key={number}>
          <a
            className="break-all underline underline-offset-4"
            href={OzonPostingUrl.build(
              number,
              fbsPostingNumbers.includes(number) ? "fbs" : "fbo",
            )}
            rel="noopener noreferrer"
            target="_blank"
          >
            {number}
          </a>
        </li>
      ))}
    </ul>
  );
}
