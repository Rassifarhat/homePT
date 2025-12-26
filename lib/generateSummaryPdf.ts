import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from "pdf-lib";
import type { ReportData } from "./schema";

/**
 * Sanitize text for WinAnsi encoding used by pdf-lib's standard fonts.
 * Replaces Unicode characters that cannot be encoded with ASCII equivalents.
 */
function sanitizeForWinAnsi(text: string): string {
  const replacements: Record<string, string> = {
    // Mathematical symbols
    '≤': '<=',
    '≥': '>=',
    '≠': '!=',
    '±': '+/-',
    '×': 'x',
    '÷': '/',
    '∞': 'infinity',
    '√': 'sqrt',
    '∑': 'sum',
    '∏': 'product',
    '∫': 'integral',
    '≈': '~',
    '≡': '===',
    '∈': 'in',
    '∉': 'not in',
    '⊂': 'subset',
    '⊃': 'superset',
    '∪': 'union',
    '∩': 'intersection',
    '∧': 'and',
    '∨': 'or',
    '¬': 'not',
    // Arrows
    '→': '->',
    '←': '<-',
    '↔': '<->',
    '⇒': '=>',
    '⇐': '<=',
    '⇔': '<=>',
    // Greek letters commonly used in medical context
    'α': 'alpha',
    'β': 'beta',
    'γ': 'gamma',
    'δ': 'delta',
    'μ': 'micro',
    // Degree and temperature
    '°': ' degrees',
    // Fractions
    '½': '1/2',
    '¼': '1/4',
    '¾': '3/4',
    '⅓': '1/3',
    '⅔': '2/3',
    // Quotes and dashes (using Unicode escapes to avoid parser issues)
    '\u201C': '"',  // Left double quotation mark "
    '\u201D': '"',  // Right double quotation mark "
    '\u2018': "'",  // Left single quotation mark '
    '\u2019': "'",  // Right single quotation mark '
    '\u2013': '-',  // En dash –
    '\u2014': '-',  // Em dash —
    '\u2026': '...', // Ellipsis …
    // Bullets and special chars
    '•': '*',
    '·': '.',
    '※': '*',
    // Medical symbols
    '♂': '(male)',
    '♀': '(female)',
  };

  let result = text;
  for (const [unicode, ascii] of Object.entries(replacements)) {
    result = result.split(unicode).join(ascii);
  }

  // Remove any remaining non-WinAnsi characters (keep basic ASCII + extended Latin)
  // WinAnsi can handle codes 32-126 (basic ASCII) and 128-255 (extended Latin-1)
  result = result.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');

  return result;
}

interface TextConfig {
  text: string;
  x: number;
  y: number;
  size: number;
  font: PDFFont;
  maxWidth?: number;
  lineHeight?: number;
}

interface PageContext {
  pdfDoc: PDFDocument;
  pageHeight: number;
  topPadding: number;
  bottomPadding: number;
}

function wrapText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number
): string[] {
  // Sanitize text for WinAnsi encoding before processing
  const sanitizedText = sanitizeForWinAnsi(text);
  const words = sanitizedText.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawText(
  page: PDFPage,
  config: TextConfig,
  ctx: PageContext
): { yPosition: number; page: PDFPage } {
  const {
    text,
    x,
    y,
    size,
    font,
    maxWidth = 500,
    lineHeight = size * 1.5,
  } = config;

  const lines = wrapText(text, maxWidth, font, size);
  let currentY = y;
  let currentPage = page;

  for (const line of lines) {
    // Check if this line will fit on the current page
    if (currentY < ctx.bottomPadding) {
      currentPage = ctx.pdfDoc.addPage([595, 842]);
      currentY = ctx.pageHeight - ctx.topPadding;
    }

    currentPage.drawText(line, {
      x,
      y: currentY,
      size,
      font,
      color: rgb(0, 0, 0),
    });
    currentY -= lineHeight;
  }

  return { yPosition: currentY, page: currentPage };
}

function ensureSpaceForSection(
  currentPage: PDFPage,
  yPosition: number,
  minSpace: number,
  ctx: PageContext
): { yPosition: number; page: PDFPage } {
  if (yPosition - minSpace < ctx.bottomPadding) {
    const newPage = ctx.pdfDoc.addPage([595, 842]);
    return { yPosition: ctx.pageHeight - ctx.topPadding, page: newPage };
  }
  return { yPosition, page: currentPage };
}

/**
 * Generates a summary PDF containing:
 * 1. Patient name and date
 * 2. ICD-10 diagnosis codes
 * 3. Summary of patient history (why patient came to see doctor, their pain)
 * 4. Treatment plan with referral to home physical therapy
 */
export async function generateSummaryPdf(report: ReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 size

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const topPadding = 100; // Less top padding for this simpler document
  const bottomPadding = 80;
  const margin = 50;
  const maxWidth = pageWidth - 2 * margin;

  // Minimum space requirements for section headers
  const MAJOR_SECTION_MIN_SPACE = 74;

  // Page context for helper functions
  const ctx: PageContext = { pdfDoc, pageHeight, topPadding, bottomPadding };

  let yPosition = pageHeight - topPadding;

  // Title: "Patient Summary" - centered, bold, 18pt
  const titleText = "Patient Summary";
  const titleWidth = boldFont.widthOfTextAtSize(titleText, 18);
  page.drawText(titleText, {
    x: (pageWidth - titleWidth) / 2,
    y: yPosition,
    size: 18,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  yPosition -= 36; // Space after title

  // Patient Name and Date
  ({ yPosition, page } = drawText(page, {
    text: `Patient: ${report.patientInformation.name}`,
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  ({ yPosition, page } = drawText(page, {
    text: `Date: ${report.patientInformation.dateOfReport}`,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  yPosition -= 20; // Space before ICD-10 section

  // ICD-10 Diagnosis Codes Section
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, MAJOR_SECTION_MIN_SPACE, ctx));
  page.drawText("ICD-10 Diagnosis Codes:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  for (const diagnosis of report.diagnoses) {
    ({ yPosition, page } = drawText(page, {
      text: `${diagnosis.code} - ${diagnosis.label}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    }, ctx));
  }

  yPosition -= 20; // Space before history section

  // History Summary Section (Clinical History - why patient came to see doctor)
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, MAJOR_SECTION_MIN_SPACE, ctx));
  page.drawText("History Summary:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  ({ yPosition, page } = drawText(page, {
    text: report.clinicalHistory,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  yPosition -= 20; // Space before plan section

  // Treatment Plan Section with Home PT Referral
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, MAJOR_SECTION_MIN_SPACE, ctx));
  page.drawText("Plan:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  // Medications
  ({ yPosition, page } = drawText(page, {
    text: "Medications:",
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  for (const med of report.treatmentPlan.medications) {
    ({ yPosition, page } = drawText(page, {
      text: `  - ${med}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    }, ctx));
  }

  yPosition -= 12;

  // Home Physical Therapy Referral - always included and highlighted
  ({ yPosition, page } = drawText(page, {
    text: "Referral to Home Physical Therapy:",
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  ({ yPosition, page } = drawText(page, {
    text: `  - Frequency: ${report.treatmentPlan.homePhysio.frequency}`,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  ({ yPosition, page } = drawText(page, {
    text: `  - Duration: ${report.treatmentPlan.homePhysio.duration}`,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  yPosition -= 12;

  // Short-term goals
  ({ yPosition, page } = drawText(page, {
    text: "Short-Term Goals:",
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  for (const goal of report.treatmentPlan.shortTermGoals) {
    ({ yPosition, page } = drawText(page, {
      text: `  - ${goal}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    }, ctx));
  }

  yPosition -= 12;

  // Long-term goals
  ({ yPosition, page } = drawText(page, {
    text: "Long-Term Goals:",
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  for (const goal of report.treatmentPlan.longTermGoals) {
    ({ yPosition, page } = drawText(page, {
      text: `  - ${goal}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    }, ctx));
  }

  yPosition -= 24;

  // Signature
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, 100, ctx));

  page.drawText(sanitizeForWinAnsi(report.signature.doctorName), {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  page.drawText(sanitizeForWinAnsi(report.signature.title), {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  page.drawText(sanitizeForWinAnsi(report.signature.dohLicense), {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
