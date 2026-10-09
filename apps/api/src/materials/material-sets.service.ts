import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ImportMaterialSetRequestDTO,
  MaterialImportPreviewDTO,
  PreviewMaterialImportRequestDTO,
} from "./dto/material-import.dto";
import { materialImportHash, parseMaterialColors } from "./material-import";

const summarySelect = {
  id: true,
  slug: true,
  title: true,
  brand: true,
  line: true,
  kind: true,
  isArchived: true,
  _count: { select: { colors: true } },
} satisfies Prisma.MaterialSetSelect;
type SummaryRecord = Prisma.MaterialSetGetPayload<{
  select: typeof summarySelect;
}>;

function mapSummary(record: SummaryRecord) {
  const { _count, ...summary } = record;
  return { ...summary, colorCount: _count.colors };
}

@Injectable()
export class MaterialSetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return (
      await this.prisma.materialSet.findMany({
        select: summarySelect,
        orderBy: [{ title: "asc" }, { id: "asc" }],
      })
    ).map(mapSummary);
  }

  async get(id: string) {
    const record = await this.prisma.materialSet.findUnique({
      where: { id },
      select: {
        ...summarySelect,
        colors: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
          select: {
            id: true,
            code: true,
            hex: true,
            name: true,
            pantone: true,
            position: true,
          },
        },
      },
    });
    if (!record) throw new NotFoundException("Набор не найден.");
    const { colors, ...summary } = record;
    return { ...mapSummary(summary), colors };
  }

  async preview(
    input: PreviewMaterialImportRequestDTO,
  ): Promise<MaterialImportPreviewDTO> {
    const parsed = parseMaterialColors(input.source);
    const existing = await this.prisma.materialSet.findUnique({
      where: { slug: input.slug.trim() },
      select: { id: true },
    });
    if (existing)
      parsed.issues.push({
        row: null,
        field: "slug",
        severity: "error",
        message:
          "Набор с таким адресом уже существует. Укажите другой адрес для нового набора.",
      });
    return {
      ...parsed,
      confirmationHash: materialImportHash(input),
      canImport:
        parsed.colors.length > 0 &&
        !parsed.issues.some((issue) => issue.severity === "error"),
    };
  }

  async import(input: ImportMaterialSetRequestDTO) {
    const preview = await this.preview(input);
    if (preview.confirmationHash !== input.confirmationHash) {
      throw new BadRequestException(
        "Данные изменились после проверки. Проверьте таблицу ещё раз.",
      );
    }
    if (!preview.canImport) {
      if (preview.issues.some((issue) => issue.field === "slug")) {
        throw new ConflictException(
          "Набор с таким адресом уже существует. Обновите список наборов.",
        );
      }
      throw new BadRequestException(
        "В таблице есть ошибки. Исправьте их и повторите проверку.",
      );
    }
    try {
      // One nested write is atomic. Never overwrite another set or partially import rows.
      const created = await this.prisma.materialSet.create({
        data: {
          title: input.title.trim(),
          slug: input.slug.trim(),
          brand: input.brand.trim(),
          line: input.line?.trim() || null,
          kind: input.kind,
          colors: { createMany: { data: preview.colors } },
        },
        select: summarySelect,
      });
      return mapSummary(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Набор уже добавлен. Обновите список наборов.",
        );
      }
      throw error;
    }
  }
}
