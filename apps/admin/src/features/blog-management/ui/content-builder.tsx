"use client";

import {
  ArrowDown,
  ArrowUp,
  Copy,
  Heading2,
  Image,
  ListChecks,
  MessageSquareQuote,
  MousePointerClick,
  Pilcrow,
  Plus,
  Quote,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";

import type { BlogPostBlock, BlogPostContent } from "@/entities/blog";
import { Button, Input } from "@/shared/ui";

import {
  createBlogPostBlock,
  createHighlightItem,
  createStepItem,
  duplicateBlogPostBlock,
  normalizeBlogPostContent,
} from "../lib";
import { fieldClassName, LabeledField, textareaClassName } from "./form-controls";
import { BlogImageUploadControl } from "./image-upload-control";

type BlogPostContentBuilderProps = {
  readonly onValueChange: (value: BlogPostContent) => void;
  readonly value?: BlogPostContent | null;
};

type BlockTypeOption = {
  readonly label: string;
  readonly type: BlogPostBlock["type"];
  readonly Icon: typeof Pilcrow;
};

const blockTypes: readonly BlockTypeOption[] = [
  { label: "Заголовок", type: "heading", Icon: Heading2 },
  { label: "Текст", type: "paragraph", Icon: Pilcrow },
  { label: "Изображение", type: "image", Icon: Image },
  { label: "Цитата", type: "quote", Icon: MessageSquareQuote },
  { label: "Карточки", type: "highlights", Icon: Sparkles },
  { label: "Шаги", type: "steps", Icon: ListChecks },
  { label: "CTA", type: "cta", Icon: MousePointerClick },
];

export function BlogPostContentBuilder({
  onValueChange,
  value,
}: BlogPostContentBuilderProps) {
  const content = normalizeBlogPostContent(value);

  const updateBlocks = (blocks: BlogPostBlock[]) => {
    onValueChange({
      schemaVersion: 1,
      blocks,
    });
  };
  const addBlock = (type: BlogPostBlock["type"]) => {
    updateBlocks([...content.blocks, createBlogPostBlock(type)]);
  };
  const updateBlock = (index: number, block: BlogPostBlock) => {
    updateBlocks(
      content.blocks.map((currentBlock, currentIndex) =>
        currentIndex === index ? block : currentBlock,
      ),
    );
  };
  const deleteBlock = (index: number) => {
    updateBlocks(content.blocks.filter((_, currentIndex) => currentIndex !== index));
  };
  const duplicateBlock = (index: number) => {
    const block = content.blocks[index];

    if (!block) {
      return;
    }

    updateBlocks([
      ...content.blocks.slice(0, index + 1),
      duplicateBlogPostBlock(block),
      ...content.blocks.slice(index + 1),
    ]);
  };
  const moveBlock = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= content.blocks.length) {
      return;
    }

    const blocks = [...content.blocks];
    const block = blocks[index];

    if (!block) {
      return;
    }

    blocks.splice(index, 1);
    blocks.splice(nextIndex, 0, block);
    updateBlocks(blocks);
  };

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex flex-wrap gap-2">
          {blockTypes.map(({ Icon, label, type }) => (
            <Button
              key={type}
              onClick={() => addBlock(type)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Icon data-icon="inline-start" aria-hidden="true" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)] xl:items-start">
        <div className="grid gap-3">
          {content.blocks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Блоки статьи пока не добавлены
            </div>
          ) : (
            content.blocks.map((block, index) => (
              <BlockEditor
                key={block.id}
                block={block}
                canMoveDown={index < content.blocks.length - 1}
                canMoveUp={index > 0}
                index={index}
                onDelete={() => deleteBlock(index)}
                onDuplicate={() => duplicateBlock(index)}
                onMoveDown={() => moveBlock(index, 1)}
                onMoveUp={() => moveBlock(index, -1)}
                onUpdate={(nextBlock) => updateBlock(index, nextBlock)}
              />
            ))
          )}
        </div>

        <BlogPostContentPreview content={content} />
      </div>
    </div>
  );
}

function BlogPostContentPreview({
  content,
}: {
  readonly content: BlogPostContent;
}) {
  return (
    <aside className="rounded-lg border bg-background xl:sticky xl:top-4">
      <div className="border-b p-4">
        <h3 className="text-base font-medium text-foreground">Предпросмотр</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {content.blocks.length} блоков
        </p>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-4">
        {content.blocks.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Добавьте блоки, чтобы увидеть статью
          </div>
        ) : (
          <article className="grid gap-5">
            {content.blocks.map((block) => (
              <PreviewBlock key={block.id} block={block} />
            ))}
          </article>
        )}
      </div>
    </aside>
  );
}

function PreviewBlock({ block }: { readonly block: BlogPostBlock }) {
  switch (block.type) {
    case "heading": {
      const text = block.text.trim() || "Заголовок";

      if (block.level === 3) {
        return <h4 className="text-lg font-semibold leading-snug text-foreground">{text}</h4>;
      }

      return <h3 className="text-xl font-semibold leading-snug text-foreground">{text}</h3>;
    }
    case "paragraph":
      return (
        <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {block.text.trim() || "Текст абзаца"}
        </p>
      );
    case "image":
      return (
        <figure className="overflow-hidden rounded-lg border bg-muted/30">
          {block.src.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={block.alt || "Изображение статьи"}
              className="aspect-video w-full object-cover"
              src={block.src}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
              URL изображения не указан
            </div>
          )}
          {block.caption?.trim() ? (
            <figcaption className="border-t px-3 py-2 text-xs leading-5 text-muted-foreground">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    case "quote":
      return (
        <blockquote className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
          <Quote className="mb-2 size-4 text-rose-500" />
          <p className="text-sm leading-6 text-foreground italic">
            {block.text.trim() || "Текст цитаты"}
          </p>
          {block.author?.trim() ? (
            <cite className="mt-2 block text-xs text-muted-foreground not-italic">
              {block.author}
            </cite>
          ) : null}
        </blockquote>
      );
    case "highlights":
      return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {block.items.map((item, index) => (
            <div key={index} className="rounded-lg border p-3">
              <div className="flex gap-2">
                {item.emoji?.trim() ? (
                  <span className="text-lg leading-none">{item.emoji}</span>
                ) : null}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {item.title.trim() || "Заголовок карточки"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.description.trim() || "Описание карточки"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    case "steps":
      return (
        <div className="grid gap-2">
          {block.items.map((item, index) => (
            <div key={index} className="flex gap-3 rounded-lg border p-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 via-rose-400 to-orange-400 text-xs font-semibold text-white">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {item.title.trim() || "Заголовок шага"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.description.trim() || "Описание шага"}
                </p>
              </div>
            </div>
          ))}
        </div>
      );
    case "cta":
      return (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="font-medium text-foreground">
            {block.title.trim() || "Заголовок CTA"}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {block.description.trim() || "Описание CTA"}
          </p>
          <span className="mt-3 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
            {block.label.trim() || "Кнопка"}
          </span>
        </div>
      );
  }
}

type BlockEditorProps = {
  readonly block: BlogPostBlock;
  readonly canMoveDown: boolean;
  readonly canMoveUp: boolean;
  readonly index: number;
  readonly onDelete: () => void;
  readonly onDuplicate: () => void;
  readonly onMoveDown: () => void;
  readonly onMoveUp: () => void;
  readonly onUpdate: (block: BlogPostBlock) => void;
};

function BlockEditor({
  block,
  canMoveDown,
  canMoveUp,
  index,
  onDelete,
  onDuplicate,
  onMoveDown,
  onMoveUp,
  onUpdate,
}: BlockEditorProps) {
  return (
    <section className="rounded-lg border bg-background">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-base font-medium text-foreground">
          {index + 1}. {getBlockTitle(block)}
        </h3>
        <div className="flex items-start gap-1">
          <Button
            aria-label="Переместить блок выше"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            size="icon-sm"
            title="Переместить выше"
            type="button"
            variant="ghost"
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            aria-label="Переместить блок ниже"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            size="icon-sm"
            title="Переместить ниже"
            type="button"
            variant="ghost"
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button
            aria-label="Дублировать блок"
            onClick={onDuplicate}
            size="icon-sm"
            title="Дублировать"
            type="button"
            variant="ghost"
          >
            <Copy aria-hidden="true" />
          </Button>
          <Button
            aria-label="Удалить блок"
            onClick={onDelete}
            size="icon-sm"
            title="Удалить"
            type="button"
            variant="destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="border-t p-4">{renderBlockFields(block, onUpdate)}</div>
    </section>
  );
}

function renderBlockFields(
  block: BlogPostBlock,
  onUpdate: (block: BlogPostBlock) => void,
) {
  switch (block.type) {
    case "heading":
      return (
        <div className="grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)_minmax(10rem,0.6fr)]">
          <LabeledField label="Уровень">
            <select
              className={fieldClassName}
              onChange={(event) =>
                onUpdate({
                  ...block,
                  level: Number(event.target.value) === 3 ? 3 : 2,
                })
              }
              value={block.level}
            >
              <option value={2}>H2</option>
              <option value={3}>H3</option>
            </select>
          </LabeledField>
          <LabeledField label="Текст">
            <Input
              onChange={(event) =>
                onUpdate({
                  ...block,
                  text: event.target.value,
                })
              }
              value={block.text}
            />
          </LabeledField>
          <LabeledField label="Anchor">
            <Input
              onChange={(event) =>
                onUpdate({
                  ...block,
                  anchor: event.target.value,
                })
              }
              value={block.anchor ?? ""}
            />
          </LabeledField>
        </div>
      );
    case "paragraph":
      return (
        <LabeledField label="Текст">
          <textarea
            className={textareaClassName}
            onChange={(event) =>
              onUpdate({
                ...block,
                text: event.target.value,
              })
            }
            value={block.text}
          />
        </LabeledField>
      );
    case "image":
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)]">
            <LabeledField label="URL">
              <Input
                onChange={(event) =>
                  onUpdate({
                    ...block,
                    src: event.target.value,
                  })
                }
                value={block.src}
              />
            </LabeledField>
            <LabeledField label="Загрузить файл">
              <BlogImageUploadControl
                onUploaded={(url) =>
                  onUpdate({
                    ...block,
                    src: url,
                  })
                }
              />
            </LabeledField>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <LabeledField label="Alt">
              <Input
                onChange={(event) =>
                  onUpdate({
                    ...block,
                    alt: event.target.value,
                  })
                }
                value={block.alt}
              />
            </LabeledField>
            <LabeledField label="Подпись">
              <Input
                onChange={(event) =>
                  onUpdate({
                    ...block,
                    caption: event.target.value,
                  })
                }
                value={block.caption ?? ""}
              />
            </LabeledField>
          </div>
        </div>
      );
    case "quote":
      return (
        <div className="grid gap-3">
          <LabeledField label="Текст">
            <textarea
              className={textareaClassName}
              onChange={(event) =>
                onUpdate({
                  ...block,
                  text: event.target.value,
                })
              }
              value={block.text}
            />
          </LabeledField>
          <LabeledField label="Автор">
            <Input
              onChange={(event) =>
                onUpdate({
                  ...block,
                  author: event.target.value,
                })
              }
              value={block.author ?? ""}
            />
          </LabeledField>
        </div>
      );
    case "highlights":
      return (
        <Repeater
          addLabel="Карточка"
          items={block.items}
          onAdd={() =>
            onUpdate({
              ...block,
              items: [...block.items, createHighlightItem()],
            })
          }
          onDelete={(itemIndex) =>
            onUpdate({
              ...block,
              items: block.items.filter((_, index) => index !== itemIndex),
            })
          }
          renderItem={(item, itemIndex) => (
            <div className="grid gap-3 md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1.3fr)]">
              <LabeledField label="Emoji">
                <Input
                  onChange={(event) =>
                    onUpdate({
                      ...block,
                      items: block.items.map((currentItem, index) =>
                        index === itemIndex
                          ? { ...currentItem, emoji: event.target.value }
                          : currentItem,
                      ),
                    })
                  }
                  value={item.emoji ?? ""}
                />
              </LabeledField>
              <LabeledField label="Заголовок">
                <Input
                  onChange={(event) =>
                    onUpdate({
                      ...block,
                      items: block.items.map((currentItem, index) =>
                        index === itemIndex
                          ? { ...currentItem, title: event.target.value }
                          : currentItem,
                      ),
                    })
                  }
                  value={item.title}
                />
              </LabeledField>
              <LabeledField label="Описание">
                <Input
                  onChange={(event) =>
                    onUpdate({
                      ...block,
                      items: block.items.map((currentItem, index) =>
                        index === itemIndex
                          ? {
                              ...currentItem,
                              description: event.target.value,
                            }
                          : currentItem,
                      ),
                    })
                  }
                  value={item.description}
                />
              </LabeledField>
            </div>
          )}
        />
      );
    case "steps":
      return (
        <Repeater
          addLabel="Шаг"
          items={block.items}
          onAdd={() =>
            onUpdate({
              ...block,
              items: [...block.items, createStepItem()],
            })
          }
          onDelete={(itemIndex) =>
            onUpdate({
              ...block,
              items: block.items.filter((_, index) => index !== itemIndex),
            })
          }
          renderItem={(item, itemIndex) => (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <LabeledField label="Заголовок">
                <Input
                  onChange={(event) =>
                    onUpdate({
                      ...block,
                      items: block.items.map((currentItem, index) =>
                        index === itemIndex
                          ? { ...currentItem, title: event.target.value }
                          : currentItem,
                      ),
                    })
                  }
                  value={item.title}
                />
              </LabeledField>
              <LabeledField label="Описание">
                <Input
                  onChange={(event) =>
                    onUpdate({
                      ...block,
                      items: block.items.map((currentItem, index) =>
                        index === itemIndex
                          ? {
                              ...currentItem,
                              description: event.target.value,
                            }
                          : currentItem,
                      ),
                    })
                  }
                  value={item.description}
                />
              </LabeledField>
            </div>
          )}
        />
      );
    case "cta":
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <LabeledField label="Заголовок">
              <Input
                onChange={(event) =>
                  onUpdate({
                    ...block,
                    title: event.target.value,
                  })
                }
                value={block.title}
              />
            </LabeledField>
            <LabeledField label="Кнопка">
              <Input
                onChange={(event) =>
                  onUpdate({
                    ...block,
                    label: event.target.value,
                  })
                }
                value={block.label}
              />
            </LabeledField>
          </div>
          <LabeledField label="Описание">
            <textarea
              className={textareaClassName}
              onChange={(event) =>
                onUpdate({
                  ...block,
                  description: event.target.value,
                })
              }
              value={block.description}
            />
          </LabeledField>
          <LabeledField label="Ссылка">
            <Input
              onChange={(event) =>
                onUpdate({
                  ...block,
                  href: event.target.value,
                })
              }
              value={block.href}
            />
          </LabeledField>
        </div>
      );
  }
}

type RepeaterProps<TItem> = {
  readonly addLabel: string;
  readonly items: readonly TItem[];
  readonly onAdd: () => void;
  readonly onDelete: (index: number) => void;
  readonly renderItem: (item: TItem, index: number) => ReactNode;
};

function Repeater<TItem>({
  addLabel,
  items,
  onAdd,
  onDelete,
  renderItem,
}: RepeaterProps<TItem>) {
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {addLabel} {index + 1}
            </p>
            <Button
              aria-label={`Удалить ${addLabel.toLowerCase()} ${index + 1}`}
              disabled={items.length <= 1}
              onClick={() => onDelete(index)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
          {renderItem(item, index)}
        </div>
      ))}
      <div>
        <Button onClick={onAdd} size="sm" type="button" variant="outline">
          <Plus data-icon="inline-start" aria-hidden="true" />
          Добавить
        </Button>
      </div>
    </div>
  );
}

function getBlockTitle(block: BlogPostBlock) {
  switch (block.type) {
    case "heading":
      return "Заголовок";
    case "paragraph":
      return "Текст";
    case "image":
      return "Изображение";
    case "quote":
      return "Цитата";
    case "highlights":
      return "Карточки";
    case "steps":
      return "Шаги";
    case "cta":
      return "CTA";
  }
}
