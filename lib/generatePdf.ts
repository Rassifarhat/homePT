import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from "pdf-lib";
import type { ReportData } from "./schema";

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
  const words = text.split(" ");
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

export async function generatePdf(report: ReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 size

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const topPadding = 230;
  const bottomPadding = 100;
  const margin = 50;
  const maxWidth = pageWidth - 2 * margin;

  // Minimum space requirements for section headers (header + 2 lines of content)
  const MAJOR_SECTION_MIN_SPACE = 74; // 14pt header + 24pt spacing + 2×18pt lines
  const SUBSECTION_MIN_SPACE = 66; // 12pt header + 18pt spacing + 2×18pt lines

  // Page context for helper functions
  const ctx: PageContext = { pdfDoc, pageHeight, topPadding, bottomPadding };

  let yPosition = pageHeight - topPadding;

  // Title: "Medical Report" - centered, bold, 20pt (only on first page)
  const titleText = "Medical Report";
  const titleWidth = boldFont.widthOfTextAtSize(titleText, 20);
  page.drawText(titleText, {
    x: (pageWidth - titleWidth) / 2,
    y: yPosition,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  yPosition -= 40; // Space after title

  // Patient Information Section
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, MAJOR_SECTION_MIN_SPACE, ctx));
  page.drawText("Patient Information:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  const patientInfo = report.patientInformation;
  const patientFields = [
    `Name: ${patientInfo.name}`,
    `Date of Birth: ${patientInfo.dateOfBirth}`,
    `Gender: ${patientInfo.gender}`,
    `MRN: ${patientInfo.mrn}`,
    `Date of Report: ${patientInfo.dateOfReport}`,
    `Hospital: ${patientInfo.hospital}`,
  ];

  for (const field of patientFields) {
    ({ yPosition, page } = drawText(page, {
      text: field,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    }, ctx));
  }

  yPosition -= 12; // Single blank line

  // Clinical History Section
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, MAJOR_SECTION_MIN_SPACE, ctx));
  page.drawText("Clinical History:", {
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

  yPosition -= 12;

  // Past Medical History Section
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, MAJOR_SECTION_MIN_SPACE, ctx));
  page.drawText("Past Medical History:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  for (const item of report.pastMedicalHistory) {
    ({ yPosition, page } = drawText(page, {
      text: `• ${item}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    }, ctx));
  }

  yPosition -= 12;

  // Vital Signs Section
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, MAJOR_SECTION_MIN_SPACE, ctx));
  page.drawText("Vital Signs:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  for (const item of report.vitalSigns) {
    ({ yPosition, page } = drawText(page, {
      text: `• ${item}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    }, ctx));
  }

  yPosition -= 12;

  // Clinical Notes Section
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, MAJOR_SECTION_MIN_SPACE, ctx));
  page.drawText("Clinical Notes:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  ({ yPosition, page } = drawText(page, {
    text: report.clinicalNotes,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  yPosition -= 12;

  // Diagnoses Section
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, MAJOR_SECTION_MIN_SPACE, ctx));
  page.drawText("Diagnoses:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  for (const diagnosis of report.diagnoses) {
    ({ yPosition, page } = drawText(page, {
      text: `• ${diagnosis.label} (${diagnosis.code}): ${diagnosis.description}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    }, ctx));
  }

  yPosition -= 12;

  // Treatment Plan Section
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, MAJOR_SECTION_MIN_SPACE, ctx));
  page.drawText("Treatment Plan:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  // Medications
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, SUBSECTION_MIN_SPACE, ctx));
  page.drawText("Medications:", {
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  for (const med of report.treatmentPlan.medications) {
    ({ yPosition, page } = drawText(page, {
      text: `• ${med}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    }, ctx));
  }

  yPosition -= 12;

  // Home Physiotherapy
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, SUBSECTION_MIN_SPACE, ctx));
  page.drawText("Home Physiotherapy:", {
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  ({ yPosition, page } = drawText(page, {
    text: `Frequency: ${report.treatmentPlan.homePhysio.frequency}`,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  ({ yPosition, page } = drawText(page, {
    text: `Duration: ${report.treatmentPlan.homePhysio.duration}`,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  yPosition -= 12;

  // Short-Term Goals
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, SUBSECTION_MIN_SPACE, ctx));
  page.drawText("Short-Term Goals:", {
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  for (const goal of report.treatmentPlan.shortTermGoals) {
    ({ yPosition, page } = drawText(page, {
      text: `• ${goal}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    }, ctx));
  }

  yPosition -= 12;

  // Long-Term Goals
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, SUBSECTION_MIN_SPACE, ctx));
  page.drawText("Long-Term Goals:", {
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  for (const goal of report.treatmentPlan.longTermGoals) {
    ({ yPosition, page } = drawText(page, {
      text: `• ${goal}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    }, ctx));
  }

  yPosition -= 12;

  // Prognosis Section
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, MAJOR_SECTION_MIN_SPACE, ctx));
  page.drawText("Prognosis:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  for (const item of report.prognosis) {
    ({ yPosition, page } = drawText(page, {
      text: `• ${item}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    }, ctx));
  }

  yPosition -= 12;

  // Conclusion Section
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, MAJOR_SECTION_MIN_SPACE, ctx));
  page.drawText("Conclusion:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  ({ yPosition, page } = drawText(page, {
    text: report.conclusion,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  }, ctx));

  yPosition -= 24; // Space before signature

  // Signature Section - ensure enough space for entire signature block (~150pt)
  ({ yPosition, page } = ensureSpaceForSection(page, yPosition, 150, ctx));
  page.drawText(report.signature.greeting, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  page.drawText(report.signature.doctorName, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  page.drawText(report.signature.title, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  page.drawText(report.signature.dohLicense, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  page.drawText(report.signature.facility, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  page.drawText(report.signature.date, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  page.drawText(report.signature.signatureStamp, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
