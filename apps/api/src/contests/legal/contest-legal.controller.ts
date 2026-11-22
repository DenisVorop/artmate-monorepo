import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Req,
  StreamableFile,
} from "@nestjs/common";
import { AuthService } from "../../auth/auth.service";
import { UsersService } from "../../users/users.service";
import { PrismaService } from "../../prisma/prisma.service";
import { mapLegalDocument } from "./contest-legal-documents";

@Controller("contests/:slug/legal/:documentId")
export class ContestLegalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}
  private async find(
    slug: string,
    id: string,
    req: { headers: { authorization?: string; cookie?: string } },
  ) {
    const document = await this.prisma.contestLegalDocument.findFirst({
      where: { id, contest: { slug } },
    });
    if (!document) throw new NotFoundException("Документ не найден");
    if (!document.publishedAt) {
      try {
        const token = this.auth.getTokenFromRequest(
          req.headers.authorization,
          req.headers.cookie,
        );
        if (!token) throw new Error();
        this.users.assertRole(
          await this.auth.verifyAccessToken(token),
          "admin",
        );
      } catch {
        throw new NotFoundException("Документ не найден");
      }
    }
    return document;
  }
  @Get()
  @Header("Cache-Control", "private, no-store")
  async metadata(
    @Param("slug") slug: string,
    @Param("documentId") id: string,
    @Req() req: { headers: { authorization?: string; cookie?: string } },
  ) {
    return mapLegalDocument(slug, await this.find(slug, id, req));
  }
  @Get("file")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  async file(
    @Param("slug") slug: string,
    @Param("documentId") id: string,
    @Req() req: { headers: { authorization?: string; cookie?: string } },
  ) {
    const document = await this.find(slug, id, req);
    return new StreamableFile(Buffer.from(document.pdf), {
      type: "application/pdf",
      length: document.pdf.byteLength,
      disposition: `inline; filename="contest-conditions-${document.id}.pdf"`,
    });
  }
}
