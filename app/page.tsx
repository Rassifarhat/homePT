"use client";

import { useState } from "react";
import type { ReportData } from "@/lib/schema";

interface PatientInfo {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  mrn: string;
  dateOfReport: string;
  hospital: string;
  extractionError?: string;
}

interface PatientWithClinicalData extends PatientInfo {
  clinicalText: string;
  clinicalImage: File | null;
}

interface ReportResult {
  patientId: string;
  patientName: string;
  report: ReportData | null;
  jsonString: string;
  status: "success" | "error";
  error?: string;
}

interface PdfResult {
  patientId: string;
  patientName: string;
  pdfPath: string;
  pdfFilename: string;
  docxPath?: string;
  docxFilename?: string;
  status: "success" | "error";
  error?: string;
}

type WorkflowStep = "upload" | "clinical-data" | "review" | "pdf-results";

export default function Home() {
  // Workflow state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("upload");

  // Step 1: Upload state
  const [patientImages, setPatientImages] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);

  // Step 2: Clinical data state
  const [patients, setPatients] = useState<PatientWithClinicalData[]>([]);
  const [generating, setGenerating] = useState(false);

  // Step 3: Review state
  const [reports, setReports] = useState<ReportResult[]>([]);
  const [creatingPdfs, setCreatingPdfs] = useState(false);

  // Step 4: PDF results state
  const [pdfResults, setPdfResults] = useState<PdfResult[]>([]);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Step 1: Extract patient info from images
  const handleExtractPatients = async () => {
    if (patientImages.length === 0) return;

    setExtracting(true);
    setError(null);

    try {
      const formData = new FormData();
      patientImages.forEach((file) => {
        formData.append("patientImages", file);
      });

      const response = await fetch("/api/extract-patients", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to extract patient information");
      }

      // Convert to patients with clinical data fields
      const patientsWithClinical: PatientWithClinicalData[] = data.patients.map(
        (p: PatientInfo) => ({
          ...p,
          clinicalText: "",
          clinicalImage: null,
        })
      );

      setPatients(patientsWithClinical);
      setCurrentStep("clinical-data");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  // Step 2: Generate reports for all patients
  const handleGenerateReports = async () => {
    setGenerating(true);
    setError(null);

    try {
      // Convert clinical images to base64
      const patientsData = await Promise.all(
        patients.map(async (patient) => {
          let clinicalImageBase64: string | undefined;

          if (patient.clinicalImage) {
            const buffer = await patient.clinicalImage.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            const mimeType = patient.clinicalImage.type || "image/jpeg";
            clinicalImageBase64 = `data:${mimeType};base64,${base64}`;
          }

          return {
            patientInfo: {
              id: patient.id,
              name: patient.name,
              dateOfBirth: patient.dateOfBirth,
              gender: patient.gender,
              mrn: patient.mrn,
              dateOfReport: patient.dateOfReport,
              hospital: patient.hospital,
            },
            clinicalText: patient.clinicalText,
            clinicalImageBase64,
          };
        })
      );

      const response = await fetch("/api/generate-reports-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ patients: patientsData }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate reports");
      }

      // Convert to report results with JSON strings
      const reportResults: ReportResult[] = data.reports.map((r: any) => ({
        patientId: r.patientId,
        patientName: r.patientName,
        report: r.report,
        jsonString: r.report ? JSON.stringify(r.report, null, 2) : "",
        status: r.status,
        error: r.error,
      }));

      setReports(reportResults);
      setCurrentStep("review");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Step 3: Create PDFs for all reports
  const handleCreatePdfs = async () => {
    setCreatingPdfs(true);
    setError(null);

    try {
      // Generate batch timestamp
      const now = new Date();
      const batchTimestamp = now.toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .split(".")[0];

      // Parse JSON strings and filter successful reports
      const reportsToProcess = reports
        .filter((r) => r.status === "success")
        .map((r) => {
          try {
            const parsedReport = JSON.parse(r.jsonString);
            return {
              patientId: r.patientId,
              report: parsedReport,
            };
          } catch {
            return null;
          }
        })
        .filter((r) => r !== null);

      if (reportsToProcess.length === 0) {
        throw new Error("No valid reports to process");
      }

      const response = await fetch("/api/create-pdfs-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reports: reportsToProcess,
          batchTimestamp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create PDFs");
      }

      setPdfResults(data.results);
      setCurrentStep("pdf-results");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingPdfs(false);
    }
  };

  // Update patient name
  const updatePatientName = (patientId: string, newName: string) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, name: newName } : p))
    );
  };

  // Update patient clinical text
  const updateClinicalText = (patientId: string, text: string) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, clinicalText: text } : p))
    );
  };

  // Update patient clinical image
  const updateClinicalImage = (patientId: string, file: File | null) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, clinicalImage: file } : p))
    );
  };

  // Update report JSON
  const updateReportJson = (patientId: string, jsonString: string) => {
    setReports((prev) =>
      prev.map((r) => (r.patientId === patientId ? { ...r, jsonString } : r))
    );
  };

  // Reset to start
  const handleReset = () => {
    setCurrentStep("upload");
    setPatientImages([]);
    setPatients([]);
    setReports([]);
    setPdfResults([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">
            Thiqa Medical Report Generator
          </h1>
          <p className="text-lg text-black">
            Batch processing for multiple patients
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {["upload", "clinical-data", "review", "pdf-results"].map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === step
                    ? "bg-indigo-600 text-white"
                    : index < ["upload", "clinical-data", "review", "pdf-results"].indexOf(currentStep)
                      ? "bg-green-500 text-white"
                      : "bg-gray-300 text-black"
                    }`}
                >
                  {index + 1}
                </div>
                {index < 3 && (
                  <div
                    className={`w-24 h-1 mx-2 ${index < ["upload", "clinical-data", "review", "pdf-results"].indexOf(currentStep)
                      ? "bg-green-500"
                      : "bg-gray-300"
                      }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-black">
            <span>Upload</span>
            <span>Clinical Data</span>
            <span>Review</span>
            <span>PDFs</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-semibold">Error:</p>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Step 1: Upload Patient Images */}
        {currentStep === "upload" && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-bold text-black mb-4">
              Step 1: Upload Patient Information Images
            </h2>
            <p className="text-black mb-6">
              Upload up to 10 patient information images. The system will extract patient details from each image.
            </p>

            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setPatientImages(Array.from(e.target.files || []))}
              className="block w-full text-sm text-black border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />

            {patientImages.length > 0 && (
              <p className="mt-2 text-sm text-green-600">
                {patientImages.length} image(s) selected
              </p>
            )}

            <button
              onClick={handleExtractPatients}
              disabled={extracting || patientImages.length === 0}
              className="mt-6 w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
            >
              {extracting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Extracting Patient Information...
                </>
              ) : (
                "Extract Patient Information"
              )}
            </button>
          </div>
        )}

        {/* Step 2: Enter Clinical Data */}
        {currentStep === "clinical-data" && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-bold text-black mb-4">
              Step 2: Enter Clinical Data
            </h2>
            <p className="text-black mb-6">
              Review patient names and enter clinical information for each patient.
            </p>

            <div className="space-y-6 max-h-[600px] overflow-y-auto">
              {patients.map((patient, index) => (
                <div key={patient.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-black">
                      Patient {index + 1}
                    </span>
                    {patient.extractionError && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                        Extraction warning
                      </span>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-black mb-1">
                      Patient Name
                    </label>
                    <input
                      type="text"
                      value={patient.name}
                      onChange={(e) => updatePatientName(patient.id, e.target.value)}
                      className="w-full p-2 text-black placeholder:text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-black mb-1">
                      Clinical Description
                    </label>
                    <textarea
                      rows={4}
                      value={patient.clinicalText}
                      onChange={(e) => updateClinicalText(patient.id, e.target.value)}
                      placeholder="Enter clinical symptoms, history, findings..."
                      className="w-full p-2 text-black placeholder:text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Clinical Image (Optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => updateClinicalImage(patient.id, e.target.files?.[0] || null)}
                      className="block w-full text-sm text-black border border-gray-300 rounded-lg cursor-pointer bg-gray-50"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={() => setCurrentStep("upload")}
                className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-black hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleGenerateReports}
                disabled={generating}
                className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating Reports...
                  </>
                ) : (
                  "Generate Reports"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review Reports */}
        {currentStep === "review" && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-bold text-black mb-4">
              Step 3: Review & Edit Reports
            </h2>
            <p className="text-black mb-6">
              Review and edit the generated reports before creating PDFs.
            </p>

            <div className="space-y-6 max-h-[600px] overflow-y-auto">
              {reports.map((report) => (
                <div key={report.patientId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-black">
                      {report.patientName}
                    </h3>
                    {report.status === "error" ? (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        Error: {report.error}
                      </span>
                    ) : (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        Success
                      </span>
                    )}
                  </div>

                  {report.status === "success" && (
                    <textarea
                      rows={12}
                      value={report.jsonString}
                      onChange={(e) => updateReportJson(report.patientId, e.target.value)}
                      className="w-full p-3 font-mono text-sm !text-black bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      style={{ color: '#000000' }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={() => setCurrentStep("clinical-data")}
                className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-black hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleCreatePdfs}
                disabled={creatingPdfs || reports.filter((r) => r.status === "success").length === 0}
                className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
              >
                {creatingPdfs ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating PDFs...
                  </>
                ) : (
                  "Generate PDFs & DOCX"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: PDF Results */}
        {currentStep === "pdf-results" && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-bold text-black mb-4">
              Step 4: Documents Generation Complete
            </h2>
            <p className="text-black mb-6">
              {pdfResults.filter((r) => r.status === "success").length} of {pdfResults.length} document sets created successfully.
            </p>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {pdfResults.map((result) => (
                <div
                  key={result.patientId}
                  className={`p-4 rounded-lg border ${result.status === "success"
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                    }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-black">{result.patientName}</p>
                      {result.status === "success" ? (
                        <>
                          <p className="text-sm text-black">
                            <span className="font-medium">PDF:</span> {result.pdfFilename}
                          </p>
                          {result.docxFilename && (
                            <p className="text-sm text-black">
                              <span className="font-medium">DOCX:</span> {result.docxFilename}
                            </p>
                          )}
                          <p className="text-sm text-black mt-1 text-xs text-gray-500">
                            Saved to: {result.pdfPath.split('/').slice(0, -1).join('/')}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-red-600">Error: {result.error}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${result.status === "success"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                        }`}
                    >
                      {result.status === "success" ? "Created" : "Failed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <button
                onClick={handleReset}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors duration-200"
              >
                Process New Batch
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
