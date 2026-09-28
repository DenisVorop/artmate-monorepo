export function OzonPostingLinks({
  postingNumbers,
}: {
  readonly postingNumbers: readonly string[];
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
            href={`https://seller.ozon.ru/app/postings/fbo/${encodeURIComponent(number)}`}
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
