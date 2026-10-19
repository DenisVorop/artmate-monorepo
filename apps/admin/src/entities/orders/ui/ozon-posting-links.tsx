import {
  OzonPostingUrl,
  type OzonPosting,
} from "@/shared/lib/ozon-posting-url";

export function OzonPostingLinks({
  ozonPostings,
}: {
  readonly ozonPostings: readonly OzonPosting[];
}) {
  if (ozonPostings.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-1 text-sm">
      {ozonPostings.map(({ number, scheme }) => (
        <li key={number}>
          <a
            className="break-all underline underline-offset-4"
            href={OzonPostingUrl.build(number, scheme)}
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
