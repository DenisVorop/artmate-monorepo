import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { AdminMaterialsGuard } from "./admin-materials.guard";
import { AdminMaterialSetsController } from "./material-sets.controller";
import { MaterialSetsService } from "./material-sets.service";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AdminMaterialSetsController],
  providers: [AdminMaterialsGuard, MaterialSetsService],
})
export class MaterialsModule {}
