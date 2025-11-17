import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { ReportData } from "./schema";

interface TextConfig {
  text: string;
  x: number;
  y: number;
  size: number;
  font: any;
  maxWidth?: number;
  lineHeight?: number;
  isBold?: boolean;
}

function wrapText(
  text: string,
  maxWidth: number,
  font: any,
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

function drawText(page: any, config: TextConfig): number {
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

  for (const line of lines) {
    page.drawText(line, {
      x,
      y: currentY,
      size,
      font,
      color: rgb(0, 0, 0),
    });
    currentY -= lineHeight;
  }

  return currentY;
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

  let yPosition = pageHeight - topPadding; // Top padding of 180

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

  const checkNewPage = () => {
    if (yPosition < bottomPadding) {
      // Bottom padding of 80
      page = pdfDoc.addPage([595, 842]);
      yPosition = pageHeight - topPadding; // Top padding of 180 for each new page
    }
  };

  // Patient Information Section
  checkNewPage();
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
    checkNewPage();
    yPosition = drawText(page, {
      text: field,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    });
  }

  yPosition -= 12; // Single blank line

  // Clinical History Section
  checkNewPage();
  page.drawText("Clinical History:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  checkNewPage();
  yPosition = drawText(page, {
    text: report.clinicalHistory,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  });

  yPosition -= 12;

  // Past Medical History Section
  checkNewPage();
  page.drawText("Past Medical History:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  for (const item of report.pastMedicalHistory) {
    checkNewPage();
    yPosition = drawText(page, {
      text: `• ${item}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    });
  }

  yPosition -= 12;

  // Vital Signs Section
  checkNewPage();
  page.drawText("Vital Signs:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  for (const item of report.vitalSigns) {
    checkNewPage();
    yPosition = drawText(page, {
      text: `• ${item}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    });
  }

  yPosition -= 12;

  // Clinical Notes Section
  checkNewPage();
  page.drawText("Clinical Notes:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  checkNewPage();
  yPosition = drawText(page, {
    text: report.clinicalNotes,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  });

  yPosition -= 12;

  // Diagnoses Section
  checkNewPage();
  page.drawText("Diagnoses:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  for (const diagnosis of report.diagnoses) {
    checkNewPage();
    yPosition = drawText(page, {
      text: `• ${diagnosis.label} (${diagnosis.code}): ${diagnosis.description}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    });
  }

  yPosition -= 12;

  // Treatment Plan Section
  checkNewPage();
  page.drawText("Treatment Plan:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  // Medications
  checkNewPage();
  page.drawText("Medications:", {
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  for (const med of report.treatmentPlan.medications) {
    checkNewPage();
    yPosition = drawText(page, {
      text: `• ${med}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    });
  }

  yPosition -= 12;

  // Home Physiotherapy
  checkNewPage();
  page.drawText("Home Physiotherapy:", {
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  checkNewPage();
  yPosition = drawText(page, {
    text: `Frequency: ${report.treatmentPlan.homePhysio.frequency}`,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  });

  checkNewPage();
  yPosition = drawText(page, {
    text: `Duration: ${report.treatmentPlan.homePhysio.duration}`,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  });

  yPosition -= 12;

  // Short-Term Goals
  checkNewPage();
  page.drawText("Short-Term Goals:", {
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  for (const goal of report.treatmentPlan.shortTermGoals) {
    checkNewPage();
    yPosition = drawText(page, {
      text: `• ${goal}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    });
  }

  yPosition -= 12;

  // Long-Term Goals
  checkNewPage();
  page.drawText("Long-Term Goals:", {
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  for (const goal of report.treatmentPlan.longTermGoals) {
    checkNewPage();
    yPosition = drawText(page, {
      text: `• ${goal}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    });
  }

  yPosition -= 12;

  // Prognosis Section
  checkNewPage();
  page.drawText("Prognosis:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  for (const item of report.prognosis) {
    checkNewPage();
    yPosition = drawText(page, {
      text: `• ${item}`,
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      maxWidth,
      lineHeight: 18,
    });
  }

  yPosition -= 12;

  // Conclusion Section
  checkNewPage();
  page.drawText("Conclusion:", {
    x: margin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  checkNewPage();
  yPosition = drawText(page, {
    text: report.conclusion,
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    maxWidth,
    lineHeight: 18,
  });

  yPosition -= 24; // Space before signature

  // Signature Section
  checkNewPage();
  page.drawText(report.signature.greeting, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  checkNewPage();
  page.drawText(report.signature.doctorName, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  checkNewPage();
  page.drawText(report.signature.title, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  checkNewPage();
  page.drawText(report.signature.dohLicense, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  checkNewPage();
  page.drawText(report.signature.facility, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  checkNewPage();
  page.drawText(report.signature.date, {
    x: margin,
    y: yPosition,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 24;

  checkNewPage();
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
