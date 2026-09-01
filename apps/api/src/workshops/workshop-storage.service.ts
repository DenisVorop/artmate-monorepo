import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";

import { writeImmutableFile } from "../colorings/immutable-file-storage";
import { WorkshopMediaService } from "./workshop-media.service";

export const workshopStorageRootToken = "WORKSHOP_STORAGE_ROOT";

export type WorkshopStorageEntry = {
  key: string;
  buffer: Buffer;
  checksum: string;
};

@Injectable()
export class WorkshopStorageService {
  private readonly logger = new Logger(WorkshopStorageService.name);

  constructor(
    private readonly media: WorkshopMediaService,
    @Optional()
    @Inject(workshopStorageRootToken)
    private readonly configuredRoot?: string,
  ) {}

  async writeAssets(entries: WorkshopStorageEntry[]) {
    const stored: Array<{ key: string; created: boolean }> = [];

    try {
      for (const entry of entries) {
        this.resolveKey(entry.key);
        stored.push(
          await writeImmutableFile({
            root: this.root(),
            key: entry.key,
            buffer: entry.buffer,
            checksum: entry.checksum,
            sha256: (value) => this.sha256(value),
            conflictMessage: "Workshop storage key already exists",
            errorMessage: "Workshop storage write failed",
            onTemporaryCleanupError: () =>
              this.logger.warn("Failed to clean temporary workshop asset"),
          }),
        );
      }

      return stored;
    } catch (error) {
      await this.cleanup(stored.filter(({ created }) => created).map(({ key }) => key));
      throw error;
    }
  }

  async read(
    key: string,
    expected: { checksum: string; width: number; height: number },
  ) {
    try {
      const path = this.resolveKey(key);
      await this.assertSafePath(path);
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);

      try {
        const opened = await handle.stat();
        await this.assertSafePath(path);
        const current = await lstat(path);

        if (
          !opened.isFile() ||
          !current.isFile() ||
          opened.dev !== current.dev ||
          opened.ino !== current.ino
        ) {
          throw new Error("Unsafe workshop storage path");
        }

        const buffer = await handle.readFile();
        await this.media.verifyDerivative(buffer, expected);
        return buffer;
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new NotFoundException("Workshop asset not found");
      }

      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new NotFoundException("Workshop asset not found");
      }

      throw error;
    }
  }

  async cleanup(keys: string[]) {
    await Promise.all(
      keys.map(async (key) => {
        try {
          const path = this.resolveKey(key);
          await this.assertSafePath(path);
          await unlink(path);
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
            this.logger.warn(`Failed to clean workshop asset ${key}`);
          }
        }
      }),
    );
  }

  private resolveKey(key: string) {
    if (
      !/^[0-9a-f]{32}\/[0-9a-f]{32}\/(?:normalized|web|thumb)-[0-9a-f]{64}\.webp$/.test(
        key,
      )
    ) {
      throw new BadRequestException("Workshop storage key is invalid");
    }

    const root = resolve(this.root());
    const path = resolve(root, key);

    if (!path.startsWith(`${root}${sep}`)) {
      throw new BadRequestException("Workshop storage key is invalid");
    }

    return path;
  }

  private async assertSafePath(path: string) {
    const root = resolve(this.root());
    const relativePath = relative(root, path);

    if (
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new Error("Unsafe workshop storage path");
    }

    let current = root;

    for (const component of ["", ...relativePath.split(sep)]) {
      current = component ? join(current, component) : current;
      const stat = await lstat(current);

      if (stat.isSymbolicLink()) {
        throw new Error("Unsafe workshop storage path");
      }
    }
  }

  private root() {
    return this.configuredRoot ?? join(process.cwd(), "private", "workshops");
  }

  private sha256(buffer: Buffer) {
    return createHash("sha256").update(buffer).digest("hex");
  }
}
