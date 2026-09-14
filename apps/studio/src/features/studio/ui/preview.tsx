"use client";
import { useState } from "react";
import Image from "next/image";
import {
  Minus,
  Plus,
  Image as ImageIcon,
  ScanLine,
  Paintbrush,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { Job, Page } from "@/entities/project";
export function Preview({ page, result }: { page: Page; result?: Job }) {
  const [mode, setMode] = useState<"original" | "colored" | "outline">(
    "colored",
  );
  const [zoom, setZoom] = useState(1);
  const effectiveMode = result ? mode : "original";
  const src =
    effectiveMode === "original"
      ? `/api/studio/pages/${page.id}/source`
      : `/api/studio/pages/${page.id}/files/${effectiveMode === "colored" ? "colored-page.svg" : "page.svg"}?job_id=${result!.id}&number=${page.number}`;
  return (
    <section className="preview-panel" aria-label="Предпросмотр">
      <div className="preview-toolbar">
        <div className="view-tabs" role="group" aria-label="Вид изображения">
          {[
            { id: "original", label: "Исходник", icon: ImageIcon },
            { id: "colored", label: "Цвет", icon: Paintbrush },
            { id: "outline", label: "Контуры", icon: ScanLine },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              aria-pressed={effectiveMode === tab.id}
              disabled={!result && tab.id !== "original"}
              onClick={() => setMode(tab.id as typeof mode)}
            >
              <tab.icon />
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="zoom-controls">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Уменьшить"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          >
            <Minus />
          </Button>
          <span>{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Увеличить"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
          >
            <Plus />
          </Button>
        </div>
      </div>
      <div className="canvas-scroll">
        <div className="paper" style={{ width: `${460 * zoom}px` }}>
          <Image
            key={src}
            src={src}
            alt={`${effectiveMode === "original" ? "Исходное изображение" : effectiveMode === "colored" ? "Цветная раскраска" : "Контурная раскраска"}: ${page.name}`}
            width={effectiveMode === "original" ? page.width : 612}
            height={effectiveMode === "original" ? page.height : 859}
            unoptimized
            priority
            className="paper-image"
          />
        </div>
      </div>
      <div className="preview-caption">
        <span>
          {effectiveMode === "original"
            ? `${page.width} × ${page.height} px`
            : "Готовый печатный лист"}
        </span>
        <span>
          {result ? "Векторные контуры и символы" : "Задайте параметры справа"}
        </span>
      </div>
    </section>
  );
}
