import { createHash } from "node:crypto";
import type {
  MaterialImportColorDTO,
  MaterialImportIssueDTO,
  PreviewMaterialImportRequestDTO,
} from "./dto/material-import.dto";

const maxBytes = 50_000;
const maxColors = 1000;
type CsvRow = { line: number; cells: string[] };
type ParsedColors = {
  colors: MaterialImportColorDTO[];
  issues: MaterialImportIssueDTO[];
};

export function materialImportHash(input: PreviewMaterialImportRequestDTO) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        format: "material-import-v1",
        title: input.title.trim(),
        slug: input.slug.trim(),
        brand: input.brand.trim(),
        line: input.line?.trim() || null,
        kind: input.kind,
        source: input.source,
      }),
    )
    .digest("hex");
}

export function parseMaterialColors(source: string): ParsedColors {
  const issues: MaterialImportIssueDTO[] = [];
  const colors: MaterialImportColorDTO[] = [];
  const error = (row: number | null, field: string, message: string) =>
    issues.push({ row, field, message, severity: "error" });

  if (Buffer.byteLength(source, "utf8") > maxBytes) {
    error(
      null,
      "source",
      "Файл слишком большой. Загрузите CSV размером до 50 КБ.",
    );
    return { colors, issues };
  }
  if (source.includes("\u0000") || source.includes("\uFFFD")) {
    error(
      null,
      "source",
      "Не удалось прочитать текст. Сохраните таблицу как CSV в кодировке UTF-8.",
    );
    return { colors, issues };
  }
  let rows: CsvRow[];
  try {
    rows = readCsv(source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"));
  } catch (cause) {
    error(
      null,
      "source",
      cause instanceof Error ? cause.message : "Не удалось прочитать CSV.",
    );
    return { colors, issues };
  }
  const headerRow = rows.shift();
  if (!headerRow) {
    error(
      null,
      "source",
      "В файле нет цветов. Добавьте заголовки code,hex и строки с цветами.",
    );
    return { colors, issues };
  }
  const headers = headerRow.cells.map((cell) => cell.trim().toLowerCase());
  const acceptedHeaders = new Set(["code", "hex", "name", "pantone"]);
  for (const header of headers) {
    if (!acceptedHeaders.has(header))
      error(
        headerRow.line,
        "source",
        "Допустимые столбцы: code, hex, name, pantone.",
      );
  }
  if (new Set(headers).size !== headers.length)
    error(
      headerRow.line,
      "source",
      "Заголовки столбцов не должны повторяться.",
    );
  if (!headers.includes("code") || !headers.includes("hex"))
    error(headerRow.line, "source", "Нужны столбцы code и hex.");
  if (issues.length) return { colors, issues };
  if (!rows.length) error(null, "source", "Добавьте хотя бы один цвет.");
  const codes = new Map<string, number>();
  const hexes = new Map<string, number>();
  for (const row of rows) {
    if (row.cells.length !== headers.length) {
      error(
        row.line,
        "source",
        "Количество значений не совпадает с количеством столбцов.",
      );
      continue;
    }
    const cell = (key: string) => row.cells[headers.indexOf(key)]?.trim() ?? "";
    const code = cell("code");
    const hex = cell("hex").toUpperCase();
    const name = cell("name");
    const pantone = cell("pantone");
    const errorsBefore = issues.length;
    if (!code || code.length > 40 || hasControlCharacters(code))
      error(
        row.line,
        "code",
        "Укажите номер длиной до 40 символов без переносов строк.",
      );
    if (!/^#[0-9A-F]{6}$/.test(hex))
      error(row.line, "hex", "Укажите цвет в формате #AABBCC.");
    if (name.length > 120)
      error(
        row.line,
        "name",
        "Название цвета должно быть не длиннее 120 символов.",
      );
    if (pantone.length > 40)
      error(
        row.line,
        "pantone",
        "Обозначение Pantone должно быть не длиннее 40 символов.",
      );
    const earlierCode = codes.get(code);
    if (earlierCode !== undefined)
      error(row.line, "code", `Номер уже указан в строке ${earlierCode}.`);
    else codes.set(code, row.line);
    if (issues.length !== errorsBefore) continue;

    const earlierHex = hexes.get(hex);
    if (earlierHex !== undefined)
      issues.push({
        row: row.line,
        field: "hex",
        severity: "warning",
        message: `Такой же цвет указан в строке ${earlierHex}. Проверьте выкраску; разные номера будут сохранены.`,
      });
    else hexes.set(hex, row.line);
    colors.push({
      code,
      hex,
      name: name || null,
      pantone: pantone || null,
      position: colors.length,
    });
  }
  return { colors, issues };
}

function hasControlCharacters(value: string) {
  return Array.from(value).some(
    (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
  );
}

// Bounded CSV reader: preserves quoted names, newlines and leading zeros.
function readCsv(source: string): CsvRow[] {
  const delimiter = detectDelimiter(source.trimStart());
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let rowLine = 1;
  const finishField = () => {
    cells.push(field);
    field = "";
    closedQuote = false;
  };
  const finishRow = () => {
    finishField();
    if (cells.some((cell) => cell.trim() !== ""))
      rows.push({ line: rowLine, cells });
    cells = [];
    if (rows.length > maxColors + 1)
      throw new Error("За один раз можно загрузить не больше 1000 цветов.");
  };
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += char;
        if (char === "\n") line++;
      }
      continue;
    }
    if (char === delimiter) {
      finishField();
      continue;
    }
    if (char === "\n") {
      finishRow();
      line++;
      rowLine = line;
      continue;
    }
    if (closedQuote) {
      if (char === " " || char === "\t") continue;
      throw new Error(`Проверьте кавычки и разделители в строке ${line}.`);
    }
    if (char === '"') {
      if (field.length) throw new Error(`Проверьте кавычки в строке ${line}.`);
      quoted = true;
    } else field += char;
  }
  if (quoted) throw new Error(`В строке ${rowLine} не закрыты кавычки.`);
  finishRow();
  return rows;
}

function detectDelimiter(source: string) {
  const counts = new Map([
    [",", 0],
    [";", 0],
    ["\t", 0],
  ]);
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!;
    if (char === '"') {
      if (quoted && source[index + 1] === '"') index++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (char === "\n") break;
      if (counts.has(char)) counts.set(char, counts.get(char)! + 1);
    }
  }
  return [...counts].sort((left, right) => right[1] - left[1])[0]![0];
}
