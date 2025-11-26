import { NextRequest, NextResponse } from "next/server";
import { ReportSchema } from "@/lib/schema";
import { generatePdf } from "@/lib/generatePdf";
import fs from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the incoming JSON with Zod
    const validatedReport = ReportSchema.parse(body);

    // Generate PDF from the validated report
    const pdfBytes = await generatePdf(validatedReport);

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), "reports");
    await fs.mkdir(reportsDir, { recursive: true });

    // Generate filename with timestamp and patient name
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const patientName = validatedReport.patientInformation.name
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 30);
    const filename = `${patientName}_${timestamp}.pdf`;
    const filepath = path.join(reportsDir, filename);

    // Save PDF to file system
    await fs.writeFile(filepath, pdfBytes);

    console.log(`PDF saved to: ${filepath}`);

    return NextResponse.json({
      success: true,
      pdfPath: filepath,
      pdfFilename: filename,
    });

  } catch (error: any) {
    console.error("Error creating PDF:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        {
          error: "Invalid report structure",
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create PDF",
        message: error.message
      },
      { status: 500 }
    );
  }
}
