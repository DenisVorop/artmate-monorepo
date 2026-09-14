"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { uploadSchema, type UploadValues } from "../lib/schema";
import { useUploadBatch } from "../lib/use-upload-batch";
export function Upload({ projectId }: { projectId: string }) {
  const batch = useUploadBatch(projectId);
  const form = useForm<UploadValues>({ resolver: zodResolver(uploadSchema) });
  return (
    <form
      className="batch-upload"
      onSubmit={form.handleSubmit(async ({ images }) => {
        await batch.start(Array.from(images));
        form.reset();
      })}
    >
      <Label htmlFor="images">
        <ImagePlus size={19} /> Добавить страницы
      </Label>
      <Input
        id="images"
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        disabled={batch.progress.running}
        {...form.register("images")}
      />
      <Button variant="outline" disabled={batch.progress.running}>
        {batch.progress.running ? (
          <LoaderCircle className="animate-spin" />
        ) : null}
        {batch.progress.running
          ? `Загружено ${batch.progress.finished} из ${batch.progress.total}`
          : "Загрузить выбранные"}
      </Button>
      {batch.progress.running && (
        <Button type="button" variant="ghost" onClick={batch.stop}>
          Остановить загрузку
        </Button>
      )}
      <small>
        Можно выбрать сразу 25 изображений. PNG, JPG, WebP — до 25 МиБ каждое.
      </small>
      {form.formState.errors.images && (
        <p role="alert" className="error">
          {form.formState.errors.images.message}
        </p>
      )}
      {!batch.progress.running && batch.progress.total > 0 && (
        <p role="status">
          Загружено: {batch.progress.finished - batch.errors.length} из{" "}
          {batch.progress.total}.
        </p>
      )}
      {!!batch.errors.length && !batch.progress.running && (
        <Button type="button" variant="outline" onClick={batch.retry}>
          Повторить неудачные загрузки ({batch.errors.length})
        </Button>
      )}
      {!!batch.errors.length && (
        <div role="alert" className="error">
          {batch.errors.map((error, i) => (
            <p key={i}>{error.message}</p>
          ))}
        </div>
      )}
    </form>
  );
}
