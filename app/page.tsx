"use client";

import { useState } from "react";
import type { ReportData } from "@/lib/schema";

export default function Home() {
  const [patientInfoImage, setPatientInfoImage] = useState<File | null>(null);
  const [clinicalImage, setClinicalImage] = useState<File | null>(null);
  const [clinicalText, setClinicalText] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [pdfInfo, setPdfInfo] = useState<{ path: string; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);
    setPdfInfo(null);

    try {
      const formData = new FormData();

      if (patientInfoImage) {
        formData.append("patientInfoImage", patientInfoImage);
      }

      if (clinicalImage) {
        formData.append("clinicalImage", clinicalImage);
      }

      if (clinicalText) {
        formData.append("clinicalText", clinicalText);
      }

      const response = await fetch("/api/generate-report", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate report");
      }

      setReport(data.report);
      setPdfInfo({
        path: data.pdfPath,
        filename: data.pdfFilename,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPatientInfoImage(null);
    setClinicalImage(null);
    setClinicalText("");
    setReport(null);
    setPdfInfo(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Thiqa Medical Report Generator
          </h1>
          <p className="text-lg text-gray-600">
            Generate DOH-compliant home physical therapy reports
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="patientInfoImage"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Patient Information Image <span className="text-red-500">*</span>
              </label>
              <input
                id="patientInfoImage"
                type="file"
                accept="image/*"
                required
                onChange={(e) =>
                  setPatientInfoImage(e.target.files?.[0] || null)
                }
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {patientInfoImage && (
                <p className="mt-1 text-sm text-green-600">
                  Selected: {patientInfoImage.name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="clinicalImage"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Clinical Notes Image <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                id="clinicalImage"
                type="file"
                accept="image/*"
                onChange={(e) => setClinicalImage(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {clinicalImage && (
                <p className="mt-1 text-sm text-green-600">
                  Selected: {clinicalImage.name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="clinicalText"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Clinical Description <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                id="clinicalText"
                rows={6}
                value={clinicalText}
                onChange={(e) => setClinicalText(e.target.value)}
                placeholder="Enter clinical description, symptoms, findings, etc..."
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-indigo-500 focus:border-indigo-500 p-3"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading || !patientInfoImage}
                className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Generating Report...
                  </>
                ) : (
                  "Generate Report"
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors duration-200"
              >
                Reset
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-semibold">Error:</p>
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        {report && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Generated Report
              </h2>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(report, null, 2));
                  alert("Report JSON copied to clipboard!");
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                Copy JSON
              </button>
            </div>

            {pdfInfo && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-semibold mb-1">PDF Generated Successfully!</p>
                <p className="text-green-700 text-sm">
                  <span className="font-medium">Filename:</span> {pdfInfo.filename}
                </p>
                <p className="text-green-700 text-sm">
                  <span className="font-medium">Saved to:</span> {pdfInfo.path}
                </p>
              </div>
            )}

            <div className="space-y-6">
              <section>
                <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">
                  Patient Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Name:</span>{" "}
                    {report.patientInformation.name}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">DOB:</span>{" "}
                    {report.patientInformation.dateOfBirth}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Gender:</span>{" "}
                    {report.patientInformation.gender}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">MRN:</span>{" "}
                    {report.patientInformation.mrn}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Date of Report:</span>{" "}
                    {report.patientInformation.dateOfReport}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Hospital:</span>{" "}
                    {report.patientInformation.hospital}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">
                  Clinical History
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {report.clinicalHistory}
                </p>
              </section>

              <section>
                <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">
                  Past Medical History
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {report.pastMedicalHistory.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">
                  Vital Signs
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {report.vitalSigns.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">
                  Clinical Notes
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {report.clinicalNotes}
                </p>
              </section>

              <section>
                <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">
                  Diagnoses
                </h3>
                <div className="space-y-3">
                  {report.diagnoses.map((diagnosis, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 p-3 rounded-lg border border-gray-200"
                    >
                      <div className="font-medium text-gray-800">
                        {diagnosis.label}
                        <span className="ml-2 text-indigo-600 text-sm">
                          ({diagnosis.code})
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {diagnosis.description}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">
                  Treatment Plan
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Medications:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {report.treatmentPlan.medications.map((med, index) => (
                        <li key={index}>{med}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Home Physiotherapy:</h4>
                    <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Frequency:</span>{" "}
                        {report.treatmentPlan.homePhysio.frequency}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Duration:</span>{" "}
                        {report.treatmentPlan.homePhysio.duration}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Short-Term Goals:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {report.treatmentPlan.shortTermGoals.map((goal, index) => (
                        <li key={index}>{goal}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Long-Term Goals:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {report.treatmentPlan.longTermGoals.map((goal, index) => (
                        <li key={index}>{goal}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">
                  Prognosis
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {report.prognosis.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">
                  Conclusion
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {report.conclusion}
                </p>
              </section>

              <section>
                <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">
                  Signature
                </h3>
                <div className="text-sm text-gray-700 space-y-1">
                  <p>{report.signature.greeting}</p>
                  <p className="mt-2">{report.signature.doctorName}</p>
                  <p>{report.signature.title}</p>
                  <p>{report.signature.dohLicense}</p>
                  <p>{report.signature.facility}</p>
                  <p>{report.signature.date}</p>
                  <p className="mt-2">{report.signature.signatureStamp}</p>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
