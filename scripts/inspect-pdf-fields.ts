import { PDFDocument } from "pdf-lib";
import { readFile } from "fs/promises";

async function inspectPdfFields() {
  try {
    const pdfBytes = await readFile("public/ftf_fillable.pdf");
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log("\n=== FTF PDF Form Fields ===\n");
    console.log(`Total fields: ${fields.length}\n`);

    fields.forEach((field, index) => {
      const name = field.getName();
      const type = field.constructor.name;
      console.log(`${index + 1}. ${name}`);
      console.log(`   Type: ${type}`);
    });

    console.log("\n=== End of Fields ===\n");
  } catch (error) {
    console.error("Error inspecting PDF:", error);
  }
}

inspectPdfFields();
