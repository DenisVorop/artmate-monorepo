export const coloringNumberMin = 1;
export const coloringNumberMax = 99;

const coloringNumberSegmentPattern = /^(?:0[1-9]|[1-9][0-9])$/;

export function formatColoringNumber(number: number) {
  return String(number).padStart(2, "0");
}

export function parseColoringNumberSegment(value: string) {
  if (!coloringNumberSegmentPattern.test(value)) {
    return null;
  }

  const number = Number(value);

  return number >= coloringNumberMin && number <= coloringNumberMax
    ? number
    : null;
}
