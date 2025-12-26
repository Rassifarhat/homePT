import { NextRequest, NextResponse } from "next/server";
import { ReportSchema, FTFFormSchema } from "@/lib/schema";
import { generatePdf } from "@/lib/generatePdf";
import { generateDocx } from "@/lib/generateDocx";
import { fillFtfPdf } from "@/lib/fillFtfPdf";
import { generateSummaryPdf } from "@/lib/generateSummaryPdf";
import fs from "fs/promises";
import path from "path";

import os from "os";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reports, batchTimestamp } = body as {
      reports: Array<{
        patientId: string;
        report: any;
        ftfFormData: any;
      }>;
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
      ftfPdfPath?: string;
      ftfPdfFilename?: string;
      summaryPdfPath?: string;
      summaryPdfFilename?: string;
      status: "success" | "error";
      error?: string;
    }> = [];

    // Process reports serially
    for (const { patientId, report, ftfFormData } of reports) {
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

        // Generate and save FTF PDF if ftfFormData is provided
        let ftfPdfFilepath: string | undefined;
        let ftfPdfFilename: string | undefined;

        if (ftfFormData) {
          try {
            // Validate FTF form data
            const validatedFtfData = FTFFormSchema.parse(ftfFormData);

            // Generate FTF PDF
            const ftfPdfBytes = await fillFtfPdf(validatedFtfData);

            // Create FTF PDF filename
            ftfPdfFilename = `${patientName}_${batchTimestamp}_FTF.pdf`;
            ftfPdfFilepath = path.join(reportsDir, ftfPdfFilename);

            // Save FTF PDF
            await fs.writeFile(ftfPdfFilepath, ftfPdfBytes);

            console.log(`FTF PDF saved: ${ftfPdfFilepath}`);
          } catch (ftfError: any) {
            console.error(`Error creating FTF PDF for patient ${patientId}:`, ftfError);
            // Continue without FTF PDF - don't fail the entire process
          }
        }

        // Generate Summary PDF (ICD-10, History, Plan with Home PT Referral)
        let summaryPdfFilepath: string | undefined;
        let summaryPdfFilename: string | undefined;

        try {
          const summaryPdfBytes = await generateSummaryPdf(validatedReport);

          summaryPdfFilename = `${patientName}_${batchTimestamp}_Summary.pdf`;
          summaryPdfFilepath = path.join(reportsDir, summaryPdfFilename);

          await fs.writeFile(summaryPdfFilepath, summaryPdfBytes);

          console.log(`Summary PDF saved: ${summaryPdfFilepath}`);
        } catch (summaryError: any) {
          console.error(`Error creating Summary PDF for patient ${patientId}:`, summaryError);
          // Continue without Summary PDF - don't fail the entire process
        }

        results.push({
          patientId,
          patientName: validatedReport.patientInformation.name,
          pdfPath: pdfFilepath,
          pdfFilename: pdfFilename,
          docxPath: docxFilepath,
          docxFilename: docxFilename,
          ftfPdfPath: ftfPdfFilepath,
          ftfPdfFilename: ftfPdfFilename,
          summaryPdfPath: summaryPdfFilepath,
          summaryPdfFilename: summaryPdfFilename,
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
