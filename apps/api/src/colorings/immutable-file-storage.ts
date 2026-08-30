import { randomBytes } from "node:crypto";
import { constants, type Stats } from "node:fs";
import {
  copyFile,
  link,
  lstat,
  mkdir,
  open,
  unlink,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";

type ImmutableFileInput = {
  root: string;
  key: string;
  buffer: Buffer;
  checksum: string;
  sha256: (buffer: Buffer) => string;
  conflictMessage?: string;
  errorMessage?: string;
  onTemporaryCleanupError?: () => void;
};

export async function writeImmutableFile({
  root,
  key,
  buffer,
  checksum,
  sha256,
  conflictMessage = "Immutable storage key already exists",
  errorMessage = "Immutable storage write failed",
  onTemporaryCleanupError,
}: ImmutableFileInput) {
  if (
    sha256(buffer) !== checksum ||
    !key.endsWith(`-${checksum}.webp`)
  ) {
    throw new BadRequestException("Immutable file checksum mismatch");
  }

  const destination = resolveContainedPath(root, key);
  const directory = dirname(destination);
  const temporary = `${destination}.tmp-${randomBytes(8).toString("hex")}`;
  let temporaryCreated = false;
  let temporaryStat: Stats | undefined;

  try {
    await assertSafePath(root, directory, true);
    await mkdir(directory, { recursive: true });
    await assertSafePath(root, directory, false);
    await assertSafePath(root, destination, true);
    const temporaryHandle = await open(
      temporary,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        constants.O_NOFOLLOW,
      0o600,
    );
    temporaryCreated = true;

    try {
      temporaryStat = await assertOpenFile(root, temporary, temporaryHandle);
      await temporaryHandle.writeFile(buffer);
      await temporaryHandle.sync();
    } finally {
      await temporaryHandle.close();
    }

    try {
      await assertPathIdentity(root, temporary, temporaryStat);
      await assertSafePath(root, destination, true);

      try {
        await link(temporary, destination);
      } catch (error) {
        if (!isFileError(error, "EPERM") && !isFileError(error, "EXDEV")) {
          throw error;
        }

        try {
          await copyFile(temporary, destination, constants.COPYFILE_EXCL);
          await syncPathSafe(root, destination);
        } catch (copyError) {
          if (!isFileError(copyError, "EEXIST")) {
            await unlinkSafe(root, destination).catch(() => undefined);
          }

          throw copyError;
        }
      }

      await assertSafePath(root, destination, false);

      return { key, created: true };
    } catch (error) {
      if (isFileError(error, "EEXIST")) {
        const existing = await readPathSafe(root, destination).catch(
          () => undefined,
        );

        if (existing && sha256(existing) === checksum) {
          return { key, created: false };
        }

        throw new ConflictException(conflictMessage);
      }

      throw error;
    }
  } catch (error) {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException
    ) {
      throw error;
    }

    throw new InternalServerErrorException(errorMessage);
  } finally {
    if (temporaryCreated) {
      try {
        await unlinkSafe(root, temporary);
      } catch (error) {
        if (!isFileError(error, "ENOENT")) {
          onTemporaryCleanupError?.();
        }
      }
    }
  }
}

function resolveContainedPath(root: string, key: string) {
  if (!key || isAbsolute(key)) {
    throw new Error("Unsafe immutable storage key");
  }

  const absoluteRoot = resolve(root);
  const absolutePath = resolve(absoluteRoot, key);

  if (!absolutePath.startsWith(`${absoluteRoot}${sep}`)) {
    throw new Error("Unsafe immutable storage key");
  }

  return absolutePath;
}

async function readPathSafe(root: string, path: string) {
  await assertSafePath(root, path, true);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);

  try {
    await assertOpenFile(root, path, handle);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function syncPathSafe(root: string, path: string) {
  await assertSafePath(root, path, true);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);

  try {
    await assertOpenFile(root, path, handle);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function unlinkSafe(root: string, path: string) {
  await assertSafePath(root, path, true);
  await unlink(path);
}

async function assertOpenFile(
  root: string,
  path: string,
  handle: Awaited<ReturnType<typeof open>>,
) {
  const handleStat = await handle.stat();
  await assertPathIdentity(root, path, handleStat);

  return handleStat;
}

async function assertPathIdentity(
  root: string,
  path: string,
  expectedStat: Stats | undefined,
) {
  const pathStat = await assertSafePath(root, path, false);

  if (
    !expectedStat ||
    !pathStat?.isFile() ||
    pathStat.dev !== expectedStat.dev ||
    pathStat.ino !== expectedStat.ino
  ) {
    throw new Error("Unsafe immutable storage path");
  }
}

async function assertSafePath(
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
    throw new Error("Unsafe immutable storage path");
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
      if (allowMissing && isFileError(error, "ENOENT")) {
        return undefined;
      }

      throw error;
    }

    if (stat.isSymbolicLink()) {
      throw new Error("Unsafe immutable storage path");
    }
  }

  return stat;
}

function isFileError(
  error: unknown,
  code: NodeJS.ErrnoException["code"],
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
