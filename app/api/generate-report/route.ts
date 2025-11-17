import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { ReportSchema } from "@/lib/schema";
import { generatePdf } from "@/lib/generatePdf";
import fs from "fs/promises";
import path from "path";

const SYSTEM_PROMPT = `You are an assistant that writes professional orthopedic medical reports as structured data.

IMPORTANT CONTEXT:
- This is a medical REPORT ONLY, not medical advice.
- The report is to be presented to Thiqa (insurance for Emirati citizens in the UAE).
- The purpose is to obtain approval for HOME PHYSICAL THERAPY.
- Reports must follow Department of Health (DOH) Abu Dhabi style and formal medical language.
- You receive patient demographic data (from an image) and clinical data (from text and/or images).
- You must output ONLY structured JSON (no Markdown, no HTML, no comments).

Your job:
- Interpret the provided information about the patient.
- Apply the following medical/reporting rules.
- Return a single JSON object that respects the exact schema described below.

DETAILED RULES:

1. patientInformation
   - Extract:
     - name, dateOfBirth, gender, mrn (medical record number), dateOfReport
       from the patient information screenshot/image.
     - hospital MUST ALWAYS be: "Emirates International Hospital".
   - If some field is not readable, use a reasonable placeholder and keep it clearly generic (e.g. "Unknown").

2. clinicalHistory (string)
   - One or more paragraphs describing:
     - Symptoms, onset, duration, functional limitations, aggravating/relieving factors.
   - MUST include pain score > 8/10 (e.g. 9/10).
   - Example phrasing: "The patient reports severe right knee pain with intensity 9/10..."
   - No bullet points; this is narrative text.

3. pastMedicalHistory (string[])
   - Each element is a single condition (e.g. "Hypertension", "Type 2 diabetes").
   - If no relevant history provided, use: ["No significant past medical history reported."].

4. vitalSigns (string[])
   - Each string is one measurement, e.g. "Blood Pressure: stable", "Heart Rate: stable".
   - If exact numbers are not given, describe as stable rather than invent precise numbers.

5. clinicalNotes (string)
   - Narrative text describing:
     - Physical findings, gait, posture, tenderness, swelling, deformity, and pain characteristics.
   - MUST include:
     - Range of motion (ROM) restriction.
     - Weakness description.

   ROM RULES:
   - If ailment appears minor/moderate → mild or moderate ROM restriction (e.g. knee flexion ~110–120°, extension -5° to -10°).
   - If ailment appears major → more pronounced restriction.
   - If severity unclear → describe mild restriction, e.g.
     "There is mild restriction of knee ROM, with flexion around 120 degrees and extension to -5 degrees."

   WEAKNESS RULES:
   - Always mention weakness of the affected region.
   - If no specific strength grade is given:
     - use phrases like "reduced strength of the affected limb" or "weakness in the involved muscle groups".
   - If the ailment is clearly severe:
     - you may specify "strength approximately 3/5" for the affected muscles.
   - NEVER state strength as 4/5 or higher.

6. diagnoses (array of objects)
   - Each item:
     - "label": the diagnosis name.
     - "code": appropriate ICD-10 code.
     - "description": a short description.
   - Use best reasonable ICD-10 codes based on the case.

7. treatmentPlan (object)
   - medications (string[])
     - MUST ALWAYS include:
       - "Diclofenac gel topical, as needed, unless contraindicated."
       - "Paracetamol 650 mg, as needed for pain, unless contraindicated."
   - homePhysio (object)
     - frequency: MUST ALWAYS be "3 times per week".
     - duration: MUST ALWAYS be "6 months".
   - shortTermGoals (string[])
     - Detailed, time-bound goals (e.g. 4–8 weeks) tailored to the case:
       examples: reduction of pain, improvement of ROM, improved transfers, safer ambulation, etc.
   - longTermGoals (string[])
     - Detailed goals consistent with a 6-month home PT program:
       examples: independent ambulation, improved strength, reduced reliance on aids, improved ADL function.

8. prognosis (string[])
   - List-style lines describing:
     - Expected improvement with adherence to the plan.
     - Risks of non-compliance.
     - Overall prognosis (e.g. "good", "guarded") with justification.

9. conclusion (string)
   - One or two paragraphs summarizing:
     - Current condition and limitations.
     - Clear statement that the patient will benefit from HOME PHYSICAL THERAPY
       at a frequency of 3 sessions per week for a total duration of 6 months.
     - Emphasize prevention of deterioration, maintenance/improvement of function, and pain control.

10. signature (object)
   - This section MUST contain the exact constant values as specified:
     - greeting: MUST be "Sincerely,"
     - doctorName: MUST be "Dr. Farhat El Rassi"
     - title: MUST be "Consultant Orthopedic Surgeon"
     - dohLicense: MUST be "DOH License No.: GD36956"
     - facility: MUST be "Facility: Emirates International Hospital, Abu Dhabi, UAE"
     - date: MUST be "Date: " (followed by the same date as in patientInformation.dateOfReport)
     - signatureStamp: MUST be "Signature & Stamp:"

GENERAL RULES:
- Use formal medical English.
- Do not address the patient directly; describe in third person.
- Ensure pain score > 8/10 is consistent across clinicalHistory and clinicalNotes.
- Ensure homePhysio.frequency and homePhysio.duration exactly match:
  - "3 times per week"
  - "6 months"
- Never create contradictions between sections.
- The signature section MUST always contain the exact constant values specified above.

OUTPUT FORMAT:
- Return ONLY a valid JSON object matching the schema above.
- No explanations, no backticks, no extra text before or after the JSON.`;

async function fileToBase64DataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = file.type || "image/jpeg";
  return `data:${mimeType};base64,${base64}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const patientInfoImage = formData.get("patientInfoImage") as File | null;
    const clinicalImage = formData.get("clinicalImage") as File | null;
    const clinicalText = formData.get("clinicalText") as string | null;

    if (!patientInfoImage) {
      return NextResponse.json(
        { error: "Patient information image is required" },
        { status: 400 }
      );
    }

    if (!clinicalText && !clinicalImage) {
      return NextResponse.json(
        { error: "At least one of clinical text or clinical image is required" },
        { status: 400 }
      );
    }

    // Build the user content array
    const userContent: Array<any> = [];

    // Add clinical text first if provided
    if (clinicalText) {
      userContent.push({
        type: "text",
        text: `Clinical Description:\n${clinicalText}`,
      });
    }

    // Add patient info image
    const patientInfoDataUrl = await fileToBase64DataUrl(patientInfoImage);
    userContent.push({
      type: "image_url",
      image_url: {
        url: patientInfoDataUrl,
      },
    });
    userContent.push({
      type: "text",
      text: "The above image contains patient demographic information.",
    });

    // Add clinical image if provided
    if (clinicalImage) {
      const clinicalImageDataUrl = await fileToBase64DataUrl(clinicalImage);
      userContent.push({
        type: "image_url",
        image_url: {
          url: clinicalImageDataUrl,
        },
      });
      userContent.push({
        type: "text",
        text: "The above image contains clinical notes or findings.",
      });
    }

    // Call OpenAI Chat Completions API with structured output
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userContent as any,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "thiqa_medical_report",
          strict: true,
          schema: {
            type: "object",
            properties: {
              patientInformation: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  dateOfBirth: { type: "string" },
                  gender: { type: "string" },
                  mrn: { type: "string" },
                  dateOfReport: { type: "string" },
                  hospital: { type: "string" },
                },
                required: ["name", "dateOfBirth", "gender", "mrn", "dateOfReport", "hospital"],
                additionalProperties: false,
              },
              clinicalHistory: { type: "string" },
              pastMedicalHistory: {
                type: "array",
                items: { type: "string" },
              },
              vitalSigns: {
                type: "array",
                items: { type: "string" },
              },
              clinicalNotes: { type: "string" },
              diagnoses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    code: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["label", "code", "description"],
                  additionalProperties: false,
                },
              },
              treatmentPlan: {
                type: "object",
                properties: {
                  medications: {
                    type: "array",
                    items: { type: "string" },
                  },
                  homePhysio: {
                    type: "object",
                    properties: {
                      frequency: { type: "string" },
                      duration: { type: "string" },
                    },
                    required: ["frequency", "duration"],
                    additionalProperties: false,
                  },
                  shortTermGoals: {
                    type: "array",
                    items: { type: "string" },
                  },
                  longTermGoals: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["medications", "homePhysio", "shortTermGoals", "longTermGoals"],
                additionalProperties: false,
              },
              prognosis: {
                type: "array",
                items: { type: "string" },
              },
              conclusion: { type: "string" },
              signature: {
                type: "object",
                properties: {
                  greeting: { type: "string" },
                  doctorName: { type: "string" },
                  title: { type: "string" },
                  dohLicense: { type: "string" },
                  facility: { type: "string" },
                  date: { type: "string" },
                  signatureStamp: { type: "string" },
                },
                required: ["greeting", "doctorName", "title", "dohLicense", "facility", "date", "signatureStamp"],
                additionalProperties: false,
              },
            },
            required: [
              "patientInformation",
              "clinicalHistory",
              "pastMedicalHistory",
              "vitalSigns",
              "clinicalNotes",
              "diagnoses",
              "treatmentPlan",
              "prognosis",
              "conclusion",
              "signature",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    // Extract the JSON from the response
    const reportText = response.choices[0]?.message?.content;

    if (!reportText) {
      throw new Error("No response content received from OpenAI");
    }

    // Parse and validate with Zod
    const reportData = JSON.parse(reportText);
    const validatedReport = ReportSchema.parse(reportData);

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
      report: validatedReport,
      pdfPath: filepath,
      pdfFilename: filename,
    });

  } catch (error: any) {
    console.error("Error generating report:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        {
          error: "Invalid report structure",
          details: error.errors
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate report",
        message: error.message
      },
      { status: 500 }
    );
  }
}
