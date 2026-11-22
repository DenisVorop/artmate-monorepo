import { Inject, Injectable, Optional } from "@nestjs/common";
import { join } from "node:path";
import { UserPhotoMediaService } from "../user-photos/user-photo-media.service";
import { UserPhotoStorageService } from "../user-photos/user-photo-storage.service";
export const contestPhotoStorageRootToken = "CONTEST_PHOTO_STORAGE_ROOT";
@Injectable()
export class ContestPhotoStorageService extends UserPhotoStorageService {
  constructor(
    media: UserPhotoMediaService,
    @Optional() @Inject(contestPhotoStorageRootToken) root?: string,
  ) {
    super(media, root ?? join(process.cwd(), "private", "contests"));
  }
}
