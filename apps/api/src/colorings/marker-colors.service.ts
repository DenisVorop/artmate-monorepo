import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const markerColorSelect = {
  id: true,
  colorNumber: true,
  pantone: true,
  hex: true,
  catalogPosition: true,
  markerNumber: true,
} satisfies Prisma.MarkerColorSelect;

@Injectable()
export class MarkerColorsService {
  constructor(private readonly prisma: PrismaService) {}

  getMarkerColors() {
    return this.prisma.markerColor.findMany({
      select: markerColorSelect,
      orderBy: { catalogPosition: "asc" },
    });
  }
}
