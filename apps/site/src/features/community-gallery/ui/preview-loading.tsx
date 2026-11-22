import { ResponsiveMediaViewer } from "@/shared/ui";
import { Skeleton } from "@/shared/ui/skeleton";
import type { useImagePreview } from "../lib/use-image-preview";

export function PreviewLoading({ preview }: { preview: ReturnType<typeof useImagePreview> }) {
  return (
    <ResponsiveMediaViewer
      open={preview.isOpen}
      onOpenChange={preview.onOpenChange}
      returnFocusRef={preview.triggerRef}
      title={
        (preview.selectedWork?.source === "contest"
          ? preview.selectedWork.title
          : preview.selectedWork?.official.coloring.title) ?? "Работа участника"
      }
      description="Просмотр фотографии"
    >
      <div role="status" className="flex min-h-0 flex-1 flex-col gap-5 p-5">
        <Skeleton className="min-h-40 flex-1 rounded-xl" />
        <p className="text-center text-sm text-stone-600">Открываем фотографию…</p>
      </div>
    </ResponsiveMediaViewer>
  );
}
