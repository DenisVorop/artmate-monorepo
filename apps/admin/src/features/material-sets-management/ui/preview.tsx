import type { MaterialSetImportPreviewDTO } from "@/shared/actions/material-sets";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

export function ImportPreview({
  preview,
}: {
  readonly preview: MaterialSetImportPreviewDTO;
}) {
  return (
    <section className="grid gap-4" aria-label="Предварительная проверка">
      <p className="font-medium" role="status">
        {preview.canImport
          ? `Готово к добавлению. Цветов: ${preview.colors.length}.`
          : "Исправьте ошибки и проверьте файл снова."}
      </p>
      {preview.issues.length > 0 && (
        <ul
          className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border p-4 text-sm"
          aria-label="Замечания к данным"
        >
          {preview.issues.map((issue, index) => (
            <li key={index} className="flex flex-wrap items-start gap-2">
              <Badge
                variant={
                  issue.severity === "error" ? "destructive" : "secondary"
                }
              >
                {issue.severity === "error" ? "Ошибка" : "Замечание"}
              </Badge>
              <span>
                {issue.row !== null ? `Строка ${issue.row}: ` : ""}
                {issue.message}
              </span>
            </li>
          ))}
        </ul>
      )}
      {preview.colors.length > 0 && (
        <div className="max-h-96 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Цвет</TableHead>
                <TableHead>Код</TableHead>
                <TableHead>HEX</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Pantone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.colors.map((color, index) => (
                <TableRow key={`${color.position}-${index}`}>
                  <TableCell>
                    <span
                      className="block size-7 rounded border"
                      style={{ backgroundColor: color.hex }}
                      aria-label={`Цвет ${color.hex}`}
                      role="img"
                    />
                  </TableCell>
                  <TableCell className="font-mono">{color.code}</TableCell>
                  <TableCell className="font-mono">{color.hex}</TableCell>
                  <TableCell>{color.name ?? "—"}</TableCell>
                  <TableCell>{color.pantone ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
