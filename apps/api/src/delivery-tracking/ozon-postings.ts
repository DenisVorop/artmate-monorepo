export type OzonPosting = {
  number: string;
  scheme: "fbo" | "fbs";
};

// Shared persisted contract: Orders publishes postings, Delivery reads them.
export class OzonPostings {
  public static parse(value: unknown): OzonPosting[] {
    if (!Array.isArray(value) || value.length > 50) {
      throw new Error("Invalid Ozon postings");
    }
    const postings: OzonPosting[] = [];
    const numbers = new Set<string>();
    for (const entry of value) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        Array.isArray(entry) ||
        typeof entry.number !== "string" ||
        entry.number.length > 64 ||
        entry.number.trim() !== entry.number ||
        !/^\d+-\d+-\d+$/.test(entry.number) ||
        (entry.scheme !== "fbo" && entry.scheme !== "fbs") ||
        numbers.has(entry.number)
      ) {
        throw new Error("Invalid Ozon postings");
      }
      numbers.add(entry.number);
      postings.push({ number: entry.number, scheme: entry.scheme });
    }
    return postings.sort((left, right) =>
      left.number.localeCompare(right.number),
    );
  }
}
