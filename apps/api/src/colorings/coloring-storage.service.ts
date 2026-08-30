import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { lstat, open, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";

import { ColoringMediaService } from "./coloring-media.service";
import { writeImmutableFile } from "./immutable-file-storage";

export type ColoringStorageRoots = {
  privateRoot: string;
  publicRoot: string;
};

export type ColoringStorageEntry = {
  key: string;
  buffer: Buffer;
  checksum: string;
};

export type StoredColoringFile = {
  key: string;
  created: boolean;
};

type ExpectedDerivative = {
  key: string;
  checksum: string;
  width: number;
  height: number;
};

export const coloringStorageRootsToken = "COLORING_STORAGE_ROOTS";

@Injectable()
export class ColoringStorageService {
  private readonly logger = new Logger(ColoringStorageService.name);

  constructor(
    private readonly mediaService: ColoringMediaService,
    @Optional()
    @Inject(coloringStorageRootsToken)
    private readonly configuredRoots?: ColoringStorageRoots,
  ) {}

  async writePrivatePair(
    entries: ColoringStorageEntry[],
  ): Promise<StoredColoringFile[]> {
    const stored: StoredColoringFile[] = [];

    try {
      for (const entry of entries) {
        stored.push(
          await this.writeAtomic(
            this.getRoots().privateRoot,
            entry.key,
            entry.buffer,
            entry.checksum,
          ),
        );
      }

      return stored;
    } catch (error) {
      await this.cleanupCreated(this.getRoots().privateRoot, stored);
      throw error;
    }
  }

  async materializePublicPair(
    entries: ExpectedDerivative[],
  ): Promise<StoredColoringFile[]> {
    const stored: StoredColoringFile[] = [];

    try {
      for (const entry of entries) {
        const buffer = await this.readPrivateOrPublic(entry.key);
        await this.mediaService.verifyDerivative(buffer, entry);
        stored.push(
          await this.writeAtomic(
            this.getRoots().publicRoot,
            entry.key,
            buffer,
            entry.checksum,
          ),
        );
      }

      return stored;
    } catch (error) {
      await this.cleanupCreated(this.getRoots().publicRoot, stored);
      throw error;
    }
  }

  async readProtected(key: string, expected: Omit<ExpectedDerivative, "key">) {
    let buffer: Buffer;

    try {
      buffer = await this.readFromRoot(this.getRoots().privateRoot, key);
    } catch (error) {
      if (!this.isMissingFile(error)) {
        throw error;
      }

      try {
        buffer = await this.readFromRoot(this.getRoots().publicRoot, key);
      } catch (publicError) {
        if (this.isMissingFile(publicError)) {
          throw new NotFoundException("Coloring revision asset not found");
        }

        throw publicError;
      }
    }

    await this.mediaService.verifyDerivative(buffer, expected);

    return buffer;
  }

  async readPublic(key: string, expected: Omit<ExpectedDerivative, "key">) {
    try {
      const buffer = await this.readFromRoot(this.getRoots().publicRoot, key);

      if (this.sha256(buffer) !== expected.checksum) {
        throw new Error("Coloring derivative checksum mismatch");
      }

      // Publication fully decodes each immutable derivative before exposing it.
      // Re-hashing proves these are the same bytes without libvips work on public GETs.

      return buffer;
    } catch {
      throw new ServiceUnavailableException(
        "Coloring asset is temporarily unavailable",
      );
    }
  }

  async cleanupPrivate(keys: string[]) {
    await Promise.all(
      keys.map(async (key) => {
        try {
          const root = this.getRoots().privateRoot;
          await this.unlinkSafe(root, this.resolveKey(root, key));
        } catch (error) {
          if (!this.isMissingFile(error)) {
            this.logger.warn(`Failed to clean private coloring asset ${key}`);
          }
        }
      }),
    );
  }

  async cleanupPublic(files: StoredColoringFile[]) {
    await this.cleanupCreated(this.getRoots().publicRoot, files);
  }

  private async writeAtomic(
    root: string,
    key: string,
    buffer: Buffer,
    checksum: string,
  ): Promise<StoredColoringFile> {
    this.resolveKey(root, key);

    return writeImmutableFile({
      root,
      key,
      buffer,
      checksum,
      sha256: (value) => this.sha256(value),
      conflictMessage: "Coloring storage key already exists",
      errorMessage: "Coloring storage write failed",
      onTemporaryCleanupError: () => {
        this.logger.warn("Failed to clean temporary coloring asset");
      },
    });
  }

  private async readPrivateOrPublic(key: string) {
    try {
      return await this.readFromRoot(this.getRoots().privateRoot, key);
    } catch (error) {
      if (!this.isMissingFile(error)) {
        throw error;
      }

      return this.readFromRoot(this.getRoots().publicRoot, key);
    }
  }

  private async readFromRoot(root: string, key: string) {
    return this.readPathSafe(root, this.resolveKey(root, key));
  }

  private async cleanupCreated(root: string, files: StoredColoringFile[]) {
    await Promise.all(
      files
        .filter(({ created }) => created)
        .map(async ({ key }) => {
          try {
            await this.unlinkSafe(root, this.resolveKey(root, key));
          } catch (error) {
            if (!this.isMissingFile(error)) {
              this.logger.warn(`Failed to roll back coloring asset ${key}`);
            }
          }
        }),
    );
  }

  private resolveKey(root: string, key: string) {
    if (
      !/^[a-z0-9_-]{1,32}\/[0-9a-f]{32}\/(?:outline|colored|card)-[0-9a-f]{64}\.webp$/.test(
        key,
      )
    ) {
      throw new BadRequestException("Coloring storage key is invalid");
    }

    const absoluteRoot = resolve(root);
    const absolutePath = resolve(absoluteRoot, key);

    if (!absolutePath.startsWith(`${absoluteRoot}${sep}`)) {
      throw new BadRequestException("Coloring storage key is invalid");
    }

    return absolutePath;
  }

  private async readPathSafe(root: string, path: string) {
    await this.assertSafePath(root, path, true);
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);

    try {
      await this.assertOpenFile(root, path, handle);
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  }

  private async unlinkSafe(root: string, path: string) {
    await this.assertSafePath(root, path, true);
    await unlink(path);
  }

  private async assertOpenFile(
    root: string,
    path: string,
    handle: Awaited<ReturnType<typeof open>>,
  ) {
    const handleStat = await handle.stat();
    await this.assertPathIdentity(root, path, handleStat);

    return handleStat;
  }

  private async assertPathIdentity(
    root: string,
    path: string,
    expectedStat: Stats | undefined,
  ) {
    const pathStat = await this.assertSafePath(root, path, false);

    if (
      !expectedStat ||
      !pathStat?.isFile() ||
      pathStat.dev !== expectedStat.dev ||
      pathStat.ino !== expectedStat.ino
    ) {
      throw new Error("Unsafe coloring storage path");
    }
  }

  private async assertSafePath(
    root: string,
    path: string,
    allowMissing: boolean,
  ): Promise<Stats | undefined> {
    const absoluteRoot = resolve(root);
    const absolutePath = resolve(path);
    const relativePath = relative(absoluteRoot, absolutePath);

    if (
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new Error("Unsafe coloring storage path");
    }

    const paths = [absoluteRoot];
    let current = absoluteRoot;

    if (relativePath) {
      for (const component of relativePath.split(sep)) {
        current = join(current, component);
        paths.push(current);
      }
    }

    let stat: Stats | undefined;

    for (const currentPath of paths) {
      try {
        stat = await lstat(currentPath);
      } catch (error) {
        if (allowMissing && this.isMissingFile(error)) {
          return undefined;
        }

        throw error;
      }

      if (stat.isSymbolicLink()) {
        throw new Error("Unsafe coloring storage path");
      }
    }

    return stat;
  }

  private getRoots(): ColoringStorageRoots {
    return (
      this.configuredRoots ?? {
        privateRoot: join(process.cwd(), "private", "colorings"),
        publicRoot: join(process.cwd(), "uploads", "colorings"),
      }
    );
  }

  private sha256(buffer: Buffer) {
    return createHash("sha256").update(buffer).digest("hex");
  }

  private isMissingFile(error: unknown): error is NodeJS.ErrnoException {
    return this.isFileError(error, "ENOENT");
  }

  private isFileError(
    error: unknown,
    code: NodeJS.ErrnoException["code"],
  ): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error && error.code === code;
  }
}
