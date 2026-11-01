type Position = { column: number; row: string };
type Placement = { columns: string; ratio: number; positions: Position[] };

const wideStacks: Record<number, number[]> = {
  1: [1],
  2: [1, 1],
  3: [1, 1, 1],
  4: [1, 2, 1],
  5: [1, 2, 2],
  6: [2, 1, 3],
  7: [2, 1, 2, 2],
};
const narrowStacks: Record<number, number[]> = {
  1: [1],
  2: [1, 1],
  3: [1, 2],
  4: [2, 2],
  5: [2, 3],
  6: [3, 3],
  7: [4, 3],
};

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

function place(items: readonly { publicId: string }[], block: number, narrow: boolean): Placement {
  const source = (narrow ? narrowStacks : wideStacks)[items.length]!;
  const rotation = block % source.length;
  const stacks = [...source.slice(rotation), ...source.slice(0, rotation)];
  const weights = stacks.map((size) => 1 / size);
  const smallestWeight = Math.min(...weights);
  const total = weights.reduce((sum, value) => sum + value, 0);
  let ratio = 0.8 * total;
  if (narrow && items.length === 3) ratio = 1 / 0.95;
  if (!narrow && items.length === 3) ratio /= 1.12;
  const columns = stacks
    .map((size, index) => {
      if (narrow && items.length === 3) return `${size === 1 ? 14 : 11}fr`;
      if (narrow && items.length === 5) return `${size === 2 ? 11 : 9}fr`;
      return `${weights[index]! / smallestWeight}fr`;
    })
    .join(" ");
  const positions: Position[] = [];
  for (const [column, size] of stacks.entries()) {
    let start = 1;
    for (let row = 0; row < size; row++) {
      const remaining = 13 - start;
      const shift = (hash(`${items[positions.length]!.publicId}:${block}`) % 3) - 1;
      const span =
        row === size - 1
          ? remaining
          : Math.max(1, Math.min(Math.round(12 / size) + shift, remaining - (size - row - 1)));
      positions.push({ column: column + 1, row: `${start} / span ${span}` });
      start += span;
    }
  }
  return { columns, ratio, positions };
}

function imageFraction(layout: Placement, index: number) {
  const tracks = layout.columns.split(" ").map(Number.parseFloat);
  const width = tracks[layout.positions[index]!.column - 1]! / tracks.reduce((a, b) => a + b, 0);
  const span = Number(layout.positions[index]!.row.split("span ")[1]);
  // object-cover also needs enough pixels when a tall tile crops the sides.
  return Math.max(width, ((span / 12) * 0.8) / layout.ratio);
}

export function getMosaicImageSizes(
  block: { items: readonly unknown[]; wide: Placement; narrow: Placement },
  index: number,
) {
  const compact = block.items.length <= 3;
  const wide = compact ? 1 / 3 : imageFraction(block.wide, index);
  const narrow = compact ? 1 / 2 : imageFraction(block.narrow, index);
  const large = compact ? 1 / 4 : wide;
  const fluid = (fraction: number) =>
    `calc(${(fraction * 100).toFixed(3)}vw - ${(fraction * 32).toFixed(3)}px)`;
  return [
    `(min-width: 1500px) ${(large * 1468).toFixed(1)}px`,
    `(min-width: 1280px) ${fluid(large)}`,
    `(min-width: 768px) ${fluid(wide)}`,
    fluid(narrow),
  ].join(", ");
}

export function getMosaicBlocks<T extends { publicId: string }>(works: readonly T[]) {
  const blocks = [];
  let position = 0;
  while (position < works.length) {
    const remaining = works.length - position;
    const preferred = [5, 7, 5][blocks.length % 3]!;
    const size = remaining <= 7 ? remaining : Math.min(preferred, remaining - 3);
    const items = works.slice(position, position + size);
    blocks.push({
      items,
      wide: place(items, blocks.length, false),
      narrow: place(items, blocks.length, true),
    });
    position += size;
  }
  return blocks;
}
