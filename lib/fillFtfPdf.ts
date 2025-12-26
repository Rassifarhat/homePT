import { PDFDocument } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";
import type { FTFFormData } from "./schema";

/**
 * Fills the FTF (Face-to-Face) Home Healthcare Referral Form PDF
 * with the provided data.
 *
 * @param data - FTF form data to fill into the PDF
 * @returns PDF bytes as Uint8Array
 */
export async function fillFtfPdf(data: FTFFormData): Promise<Uint8Array> {
  // Load the template PDF
  const pdfPath = path.join(process.cwd(), "public", "ftf_fillable.pdf");
  const pdfBytes = await readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();

  // Fill text fields
  try {
    const textFields = {
      name: data.name,
      date: data.date,
      reason_1: data.reason_1,
      findings_1: data.findings_1,
      reason_2: data.reason_2,
      findings_2: data.findings_2,
      risk_factors: data.risk_factors,
      session_week_1: data.session_week_1,
      session_week_2: data.session_week_2,
      duration_pt: data.duration_pt,
    };

    for (const [fieldName, value] of Object.entries(textFields)) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value);
      } catch (e) {
        console.warn(`Could not find or fill text field "${fieldName}":`, e);
      }
    }

    // The treatment_details field is not in the PDF based on our inspection
    // It might be part of another section or may need to be added manually
    // For now, we'll skip it
  } catch (e) {
    console.error("Error filling text fields:", e);
  }

  // Check checkboxes
  try {
    const checkboxes = {
      homebound_check: data.homebound_check === "on",
      reason_homebound_check: data.reason_homebound_check === "on",
      session_week_1_check: data.session_week_1_check === "on",
    };

    for (const [fieldName, shouldCheck] of Object.entries(checkboxes)) {
      try {
        if (shouldCheck) {
          const checkbox = form.getCheckBox(fieldName);
          checkbox.check();
        }
      } catch (e) {
        console.warn(`Could not find or check checkbox "${fieldName}":`, e);
      }
    }
  } catch (e) {
    console.error("Error checking checkboxes:", e);
  }

  // Save and return the filled PDF
  return await pdfDoc.save();
}
