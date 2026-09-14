"use client";
import { useEffect, useRef, useState } from "react";
import { useUploadPage } from "../model/use-upload-page";
export function useUploadBatch(projectId: string) {
  const upload = useUploadPage(projectId);
  const stopped = useRef(false);
  const running = useRef(false);
  const [progress, setProgress] = useState({
    total: 0,
    finished: 0,
    running: false,
  });
  const [errors, setErrors] = useState<{ file: File; message: string }[]>([]);
  useEffect(
    () => () => {
      stopped.current = true;
    },
    [],
  );
  async function start(files: File[]) {
    if (running.current) return;
    running.current = true;
    stopped.current = false;
    setErrors([]);
    setProgress({ total: files.length, finished: 0, running: true });
    try {
      for (const file of files) {
        if (stopped.current) break;
        try {
          await upload.mutateAsync(file);
        } catch (error) {
          setErrors((prev) => [
            ...prev,
            {
              file,
              message: `${file.name}: ${error instanceof Error ? error.message : "Ошибка загрузки"}`,
            },
          ]);
        }
        setProgress((prev) => ({ ...prev, finished: prev.finished + 1 }));
      }
    } finally {
      running.current = false;
      setProgress((prev) => ({ ...prev, running: false }));
    }
  }
  return {
    start,
    progress,
    errors,
    retry: () => start(errors.map((item) => item.file)),
    stop: () => {
      stopped.current = true;
    },
  };
}
