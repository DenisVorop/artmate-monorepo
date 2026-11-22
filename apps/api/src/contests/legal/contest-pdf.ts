import PDFDocument from "pdfkit";
import { resolve } from "node:path";
import { legalAssets, type LegalText } from "./contest-legal.constants";

/** The same A4 / 12 pt / plain centered headings as the site's legal documents. */
export async function renderContestPdf(content: LegalText) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { left: 85.04, right: 42.52, top: 56.69, bottom: 56.69 },
    info: { Title: content.title, Author: "Artmate" },
    autoFirstPage: true,
  });
  doc.registerFont("Legal", resolve(legalAssets, "LiberationSans-Regular.ttf"));
  doc.font("Legal").fontSize(12);
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolveResult, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolveResult(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  function paragraph(text: string, centered = false, heading = false) {
    const options = {
      align: centered ? ("center" as const) : ("justify" as const),
      lineGap: 1.1,
      paragraphGap: 7,
    };
    if (
      heading &&
      doc.y + doc.heightOfString(text, options) + 45 >
        doc.page.height - doc.page.margins.bottom
    )
      doc.addPage();
    doc.text(text.replace(/(\d) (?=₽|лет|календарных)/g, "$1\u00a0"), options);
  }
  paragraph(content.title, true, true);
  paragraph(content.lead);
  for (const section of content.sections) {
    paragraph(section.title, true, true);
    for (const text of section.paragraphs) paragraph(text);
  }
  const signature =
    "Индивидуальный предприниматель Воропаев Денис Юрьевич\nИНН 772459963613\nОГРНИП 324774600166803\nЭлектронная почта: support@artmate.ru";
  const edition = "Редакция от 22 ноября 2026 года";
  const footerHeight =
    doc.heightOfString(signature, { lineGap: 1.1 }) +
    doc.heightOfString(edition, { lineGap: 1.1 }) +
    16;
  if (doc.y + footerHeight > doc.page.height - doc.page.margins.bottom)
    doc.addPage();
  paragraph(signature);
  paragraph(edition);
  doc.end();
  return result;
}
