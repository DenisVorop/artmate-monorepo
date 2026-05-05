import { BadRequestException, Injectable } from "@nestjs/common";

import type {
  AiBlogDraftOutline,
  AiGeneratedBlogDraft,
  AiTopicSuggestions,
} from "./content-assistant.types";

type InlineKeyboardButton = {
  callback_data: string;
  text: string;
};

type TelegramSendMessageBody = {
  chat_id: string;
  reply_markup?: {
    inline_keyboard: InlineKeyboardButton[][];
  };
  text: string;
};

@Injectable()
export class TelegramApprovalService {
  async sendTopicReview(runId: string, suggestions: AiTopicSuggestions) {
    await this.sendMessage(
      buildTopicReviewText(suggestions),
      suggestions.topics.map((topic, index) => [
        {
          callback_data: `ai|topic|${runId}|${index}`,
          text: `Утвердить ${index + 1}`,
        },
      ]),
    );
  }

  async sendOutlineReview(runId: string, outline: AiBlogDraftOutline) {
    await this.sendMessage(buildOutlineReviewText(outline), [
      [
        {
          callback_data: `ai|outline|${runId}|approve`,
          text: "Утвердить структуру",
        },
      ],
      [{ callback_data: `ai|reject|${runId}`, text: "Отклонить" }],
    ]);
  }

  async sendDraftReview(runId: string, draft: AiGeneratedBlogDraft) {
    await this.sendMessage(buildDraftReviewText(draft), [
      [{ callback_data: `ai|draft|${runId}|create`, text: "Создать draft" }],
      [{ callback_data: `ai|reject|${runId}`, text: "Отклонить" }],
    ]);
  }

  async sendDraftCreated({
    adminUrl,
    title,
  }: {
    adminUrl: string;
    title: string;
  }) {
    await this.sendMessage(
      [
        "Draft создан в блоге.",
        "",
        title,
        adminUrl ? `Открыть в админке: ${adminUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  async sendRejected(runId: string) {
    await this.sendMessage(`AI draft run ${runId} отклонен.`);
  }

  async sendFailure(runId: string, message: string) {
    await this.sendMessage(
      [`AI draft run ${runId} завершился с ошибкой.`, "", message].join("\n"),
    );
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    await this.postTelegram("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    });
  }

  private async sendMessage(
    text: string,
    inlineKeyboard?: InlineKeyboardButton[][],
  ) {
    const chatId = process.env.CONTENT_ASSISTANT_TELEGRAM_APPROVAL_CHAT_ID;

    if (!chatId) {
      throw new BadRequestException(
        "CONTENT_ASSISTANT_TELEGRAM_APPROVAL_CHAT_ID is not configured",
      );
    }

    await this.postTelegram("sendMessage", {
      chat_id: chatId,
      reply_markup: inlineKeyboard
        ? {
            inline_keyboard: inlineKeyboard,
          }
        : undefined,
      text: trimTelegramMessage(text),
    } satisfies TelegramSendMessageBody);
  }

  private async postTelegram(method: string, body: Record<string, unknown>) {
    const token = process.env.CONTENT_ASSISTANT_TELEGRAM_BOT_TOKEN;

    if (!token) {
      throw new BadRequestException(
        "CONTENT_ASSISTANT_TELEGRAM_BOT_TOKEN is not configured",
      );
    }

    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        `Telegram API request failed with status ${response.status}`,
      );
    }
  }
}

function buildTopicReviewText(suggestions: AiTopicSuggestions) {
  const topics = suggestions.topics.map((topic, index) =>
    [
      `${index + 1}. ${topic.title}`,
      `Угол: ${topic.angle}`,
      `Почему сейчас: ${topic.rationale}`,
      `CTA: ${topic.cta}`,
      topic.sourceUrls.length > 0
        ? `Источники: ${topic.sourceUrls.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return ["Темы для будущего draft в блоге:", "", ...topics].join("\n\n");
}

function buildOutlineReviewText(outline: AiBlogDraftOutline) {
  const sections = outline.sections.map(
    (section, index) =>
      `${index + 1}. [${section.blockType}] ${section.heading}\n${section.notes}`,
  );

  return ["Структура статьи:", "", outline.title, "", ...sections].join("\n");
}

function buildDraftReviewText(draft: AiGeneratedBlogDraft) {
  return [
    "Черновик готов к созданию draft:",
    "",
    draft.title,
    "",
    draft.excerpt,
    "",
    `Slug: ${draft.slug}`,
    `Блоков: ${draft.content.blocks.length}`,
    "",
    "После подтверждения запись появится в админке со статусом draft.",
  ].join("\n");
}

function trimTelegramMessage(text: string) {
  const maxTelegramMessageLength = 4096;

  if (text.length <= maxTelegramMessageLength) {
    return text;
  }

  return `${text.slice(0, maxTelegramMessageLength - 20)}\n\n...`;
}
