import { Inject, Injectable, Optional } from "@nestjs/common";
import { join } from "node:path";
import { UserPhotoMediaService } from "../user-photos/user-photo-media.service";
import { UserPhotoStorageService } from "../user-photos/user-photo-storage.service";
export const workshopStorageRootToken = "WORKSHOP_STORAGE_ROOT";
@Injectable()
export class WorkshopStorageService extends UserPhotoStorageService {
  constructor(
    media: UserPhotoMediaService,
    @Optional() @Inject(workshopStorageRootToken) root?: string,
  ) {
    super(media, root ?? join(process.cwd(), "private", "workshops"));
  }
}
