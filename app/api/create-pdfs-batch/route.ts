import { NextRequest, NextResponse } from "next/server";
import { ReportSchema } from "@/lib/schema";
import { generatePdf } from "@/lib/generatePdf";
import { generateDocx } from "@/lib/generateDocx";
import fs from "fs/promises";
import path from "path";

import os from "os";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reports, batchTimestamp } = body as {
      reports: Array<{ patientId: string; report: any }>;
      batchTimestamp: string;
    };

    if (!reports || reports.length === 0) {
      return NextResponse.json(
        { error: "No reports provided" },
        { status: 400 }
      );
    }

    if (!batchTimestamp) {
      return NextResponse.json(
        { error: "Batch timestamp is required" },
        { status: 400 }
      );
    }

    // Determine the target directory: ~/homePtReports/YYYY-MM-DD
    const homeDir = os.homedir();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const reportsDir = path.join(homeDir, "homePtReports", today);

    // Create directory recursively (handles parent folders and existing folders automatically)
    await fs.mkdir(reportsDir, { recursive: true });

    const results: Array<{
      patientId: string;
      patientName: string;
      pdfPath: string;
      pdfFilename: string;
      docxPath?: string;
      docxFilename?: string;
      status: "success" | "error";
      error?: string;
    }> = [];

    // Process reports serially
    for (const { patientId, report } of reports) {
      try {
        // Validate the report with Zod
        const validatedReport = ReportSchema.parse(report);

        // Generate PDF
        const pdfBytes = await generatePdf(validatedReport);

        // Generate DOCX
        const docxBuffer = await generateDocx(validatedReport);

        // Generate filename with patient name and batch timestamp
        const patientName = validatedReport.patientInformation.name
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .substring(0, 50);

        const pdfFilename = `${patientName}_${batchTimestamp}.pdf`;
        const pdfFilepath = path.join(reportsDir, pdfFilename);

        const docxFilename = `${patientName}_${batchTimestamp}.docx`;
        const docxFilepath = path.join(reportsDir, docxFilename);

        // Save files to file system
        await fs.writeFile(pdfFilepath, pdfBytes);
        await fs.writeFile(docxFilepath, docxBuffer);

        console.log(`PDF saved: ${pdfFilepath}`);
        console.log(`DOCX saved: ${docxFilepath}`);

        results.push({
          patientId,
          patientName: validatedReport.patientInformation.name,
          pdfPath: pdfFilepath,
          pdfFilename: pdfFilename,
          docxPath: docxFilepath,
          docxFilename: docxFilename,
          status: "success",
        });

      } catch (err: any) {
        console.error(`Error creating PDF for patient ${patientId}:`, err);
        results.push({
          patientId,
          patientName: report?.patientInformation?.name || "Unknown",
          pdfPath: "",
          pdfFilename: "",
          status: "error",
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error: any) {
    console.error("Error creating PDFs batch:", error);
    return NextResponse.json(
      {
        error: "Failed to create PDFs",
        message: error.message
      },
      { status: 500 }
    );
  }
}
