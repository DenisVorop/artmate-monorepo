import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Param,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { AdminMaterialsGuard } from "./admin-materials.guard";
import {
  ImportMaterialSetRequestDTO,
  MaterialImportPreviewDTO,
  MaterialSetSummaryDTO,
  MaterialSetDetailDTO,
  PreviewMaterialImportRequestDTO,
} from "./dto/material-import.dto";
import { MaterialSetsService } from "./material-sets.service";

@ApiTags("Material sets")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Authentication required" })
@ApiForbiddenResponse({ description: "Admin role and CSRF header required" })
@UseGuards(AuthGuard, AdminMaterialsGuard)
@Controller("admin/material-sets")
export class AdminMaterialSetsController {
  constructor(private readonly materials: MaterialSetsService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "List material sets" })
  @ApiOkResponse({ type: [MaterialSetSummaryDTO] })
  @ValidateResponse(MaterialSetSummaryDTO, { isArray: true })
  list() {
    return this.materials.list();
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Get material set colors for variant assignment" })
  @ApiOkResponse({ type: MaterialSetDetailDTO })
  @ValidateResponse(MaterialSetDetailDTO)
  get(@Param("id") id: string) {
    return this.materials.get(id);
  }

  @Post("import/preview")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Validate a new material set CSV without writing data",
  })
  @ApiOkResponse({ type: MaterialImportPreviewDTO })
  @ApiBadRequestResponse()
  @ValidateResponse(MaterialImportPreviewDTO)
  preview(@Body() input: PreviewMaterialImportRequestDTO) {
    return this.materials.preview(input);
  }

  @Post("import")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Create a new material set from the confirmed CSV" })
  @ApiCreatedResponse({ type: MaterialSetSummaryDTO })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ValidateResponse(MaterialSetSummaryDTO)
  import(@Body() input: ImportMaterialSetRequestDTO) {
    return this.materials.import(input);
  }
}
