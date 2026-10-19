export type OzonPostingScheme = "fbo" | "fbs";

export class OzonPostingUrl {
  public static parse(value: string) {
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        url.host !== "seller.ozon.ru" ||
        url.username ||
        url.password
      )
        return undefined;

      const scheme = /^\/app\/postings\/(fbo\/details|fbs)\/?$/.exec(
        url.pathname,
      )?.[1];
      if (!scheme) return undefined;
      const parameter = scheme === "fbs" ? "postingDetails" : "posting_number";
      const numbers = url.searchParams.getAll(parameter);
      const number = numbers[0];
      if (
        numbers.length !== 1 ||
        !number ||
        number.length > 64 ||
        number.trim() !== number ||
        !/^\d+-\d+-\d+$/.test(number)
      ) {
        return undefined;
      }
      return {
        number,
        scheme: scheme === "fbs" ? ("fbs" as const) : ("fbo" as const),
      };
    } catch {
      return undefined;
    }
  }

  public static build(number: string, scheme: OzonPostingScheme): string {
    return scheme === "fbs"
      ? `https://seller.ozon.ru/app/postings/fbs?tab=delivering&postingDetails=${encodeURIComponent(number)}`
      : `https://seller.ozon.ru/app/postings/fbo/details?posting_number=${encodeURIComponent(number)}`;
  }
}
