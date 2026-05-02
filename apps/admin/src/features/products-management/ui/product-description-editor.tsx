"use client";

import {
  useEffect,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Bold,
  CornerDownLeft,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  RemoveFormatting,
  Undo2,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui";

type ProductDescriptionEditorProps = {
  readonly defaultValue?: string;
  readonly name: string;
  readonly onValueChange?: (_value: string) => void;
  readonly placeholder?: string;
  readonly value?: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, "disabled">;

export function ProductDescriptionEditor({
  defaultValue = "",
  disabled,
  name,
  onValueChange,
  placeholder = "Описание товара",
  value: controlledValue,
}: ProductDescriptionEditorProps) {
  const initialContent = useMemo(
    () => toEditorHtml(controlledValue ?? defaultValue),
    [controlledValue, defaultValue],
  );
  const [value, setValue] = useState(initialContent);

  const editor = useEditor({
    content: initialContent,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "min-h-48 rounded-b-lg px-2.5 py-2 text-sm leading-6 outline-none [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:ml-5 [&_ul]:list-disc",
      },
    },
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
        strike: false,
        underline: false,
      }),
    ],
    immediatelyRender: false,
    onUpdate: ({ editor: updatedEditor }) => {
      const nextValue = normalizeEditorHtml(updatedEditor.getHTML());

      setValue(nextValue);
      onValueChange?.(nextValue);
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    setValue(initialContent);
    editor?.commands.setContent(initialContent, { emitUpdate: false });
    onValueChange?.(initialContent);
  }, [editor, initialContent, onValueChange]);

  useEffect(() => {
    const form = editor?.view.dom.closest("form");

    if (!form) {
      return;
    }

    function handleReset() {
      setValue(initialContent);
      editor?.commands.setContent(initialContent, { emitUpdate: false });
      onValueChange?.(initialContent);
    }

    form.addEventListener("reset", handleReset);

    return () => form.removeEventListener("reset", handleReset);
  }, [editor, initialContent, onValueChange]);

  const isEmpty = !editor || editor.isEmpty;

  return (
    <div className="grid gap-2">
      <input name={name} readOnly type="hidden" value={value} />
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          disabled && "opacity-50",
        )}
      >
        <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/30 p-1">
          <ToolbarButton
            active={editor?.isActive("bold")}
            disabled={disabled}
            editor={editor}
            label="Жирный"
            onClick={(activeEditor) => activeEditor.chain().focus().toggleBold().run()}
          >
            <Bold aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("italic")}
            disabled={disabled}
            editor={editor}
            label="Курсив"
            onClick={(activeEditor) => activeEditor.chain().focus().toggleItalic().run()}
          >
            <Italic aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("bulletList")}
            disabled={disabled}
            editor={editor}
            label="Маркированный список"
            onClick={(activeEditor) => activeEditor.chain().focus().toggleBulletList().run()}
          >
            <List aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("orderedList")}
            disabled={disabled}
            editor={editor}
            label="Нумерованный список"
            onClick={(activeEditor) => activeEditor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            disabled={disabled}
            editor={editor}
            label="Обычный абзац"
            onClick={(activeEditor) => activeEditor.chain().focus().setParagraph().run()}
          >
            <Pilcrow aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            disabled={disabled}
            editor={editor}
            label="Перенос строки"
            onClick={(activeEditor) => activeEditor.chain().focus().setHardBreak().run()}
          >
            <CornerDownLeft aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            disabled={disabled}
            editor={editor}
            label="Очистить форматирование"
            onClick={(activeEditor) =>
              activeEditor.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            <RemoveFormatting aria-hidden="true" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            disabled={disabled || !editor?.can().undo()}
            editor={editor}
            label="Отменить"
            onClick={(activeEditor) => activeEditor.chain().focus().undo().run()}
          >
            <Undo2 aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            disabled={disabled || !editor?.can().redo()}
            editor={editor}
            label="Повторить"
            onClick={(activeEditor) => activeEditor.chain().focus().redo().run()}
          >
            <Redo2 aria-hidden="true" />
          </ToolbarButton>
        </div>
        <div className="relative">
          <EditorContent editor={editor} />
          {isEmpty && (
            <span className="pointer-events-none absolute top-2 left-2.5 text-sm text-muted-foreground">
              {placeholder}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

type ToolbarButtonProps = {
  readonly active?: boolean;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly editor: Editor | null;
  readonly label: string;
  readonly onClick: (_editor: Editor) => void;
};

function ToolbarButton({
  active,
  children,
  disabled,
  editor,
  label,
  onClick,
}: ToolbarButtonProps) {
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      className={cn(active && "bg-background text-foreground shadow-xs")}
      disabled={disabled || !editor}
      onClick={() => {
        if (editor) {
          onClick(editor);
        }
      }}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  );
}

function toEditorHtml(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function normalizeEditorHtml(value: string) {
  return value === "<p></p>" ? "" : value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
