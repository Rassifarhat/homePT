import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { CombinedResponseSchema } from "@/lib/schema";

const SYSTEM_PROMPT = `You are an assistant that writes professional orthopedic medical reports as structured data.

IMPORTANT CONTEXT:
- This is a medical REPORT ONLY, not medical advice.
- The report is to be presented to Thiqa (insurance for Emirati citizens in the UAE).
- The purpose is to obtain approval for HOME PHYSICAL THERAPY.
- Reports must follow Department of Health (DOH) Abu Dhabi style and formal medical language.
- You receive patient demographic data (already extracted) and clinical data (from text and/or images).
- You must output ONLY structured JSON (no Markdown, no HTML, no comments).

Your job:
- Use the provided patient information exactly as given.
- Interpret the clinical data to write the medical report.
- Apply the following medical/reporting rules.
- Return a single JSON object that respects the exact schema described below.

DETAILED RULES:

1. patientInformation
   - Use the exact values provided in the input for: name, dateOfBirth, gender, mrn, dateOfReport, hospital.
   - Do NOT modify these values.

2. clinicalHistory (string)
   - One or more paragraphs describing:
     - Symptoms, onset, duration, functional limitations, aggravating/relieving factors.
   - Extract the EXACT pain score from the clinical documents/images provided (e.g., if the document states 6/10, use 6/10).
   - Use descriptive qualifiers that match the pain level (e.g., "mild" for 1-3/10, "moderate" for 4-6/10, "severe" for 7-9/10, "unbearable" for 10/10).
   - Example phrasing: "The patient reports severe right knee pain with intensity 8/10..." (adjust intensity based on actual documented pain score).
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
       - "Diclofenac gel topical"
       - "Paracetamol 650 mg"
     - Format: medication name and dosage ONLY, with no additional comments, qualifiers, or contraindication notes.
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
- Ensure the pain score extracted from the clinical documents is consistent across clinicalHistory and clinicalNotes.
- Ensure homePhysio.frequency and homePhysio.duration exactly match:
  - "3 times per week"
  - "6 months"
- Never create contradictions between sections.
- The signature section MUST always contain the exact constant values specified above.

OUTPUT FORMAT:
- Return ONLY a valid JSON object matching the schema above.
- No explanations, no backticks, no extra text before or after the JSON.

ADDITIONALLY, you must generate data for the DOH Home Healthcare Referral Form (FTF form):

FTF FORM DATA RULES:
11. ftfFormData (object)
   - name: Use exact patient name from patientInformation
   - date: Convert dateOfReport from YYYY-MM-DD format to DD/MM/YYYY format
     Example: "2024-11-25" becomes "25/11/2024"
   - homebound_check: Always "on"
   - reason_homebound_check: Always "on"
   - reason_1: Extract primary pain points and symptoms from clinicalHistory and diagnoses
     Format: Brief 1-2 sentence statement of main orthopedic complaints
     Example: "Severe bilateral knee osteoarthritis causing significant pain and limiting mobility."
   - findings_1: Explain why patient cannot leave home based on clinicalNotes
     Format: 2-3 sentence statement on mobility limitations, ROM restrictions, weakness that confine patient to home
     Example: "Patient demonstrates severe ROM restriction with knee flexion limited to 90 degrees bilaterally and extension deficit of -10 degrees. Muscle strength is reduced to 3/5 in bilateral lower extremities. Ambulation is severely compromised requiring assistive device and causing taxing effort, rendering patient homebound."
   - reason_2: MUST BE IDENTICAL to reason_1
   - findings_2: MUST BE IDENTICAL to findings_1
   - risk_factors: List from pastMedicalHistory as comma-separated string
     If no past medical history: "None reported"
     Example: "Hypertension, Type 2 diabetes, Osteoporosis"
   - session_week_1: Always "3/week"
   - session_week_1_check: Always "on"
   - session_week_2: Always "3/week"
   - duration_pt: Always "6 months"
   - treatment_details: Summarize shortTermGoals and longTermGoals in 2-3 sentences
     Format: "Short-term goals (4-8 weeks): [summary]. Long-term goals (6 months): [summary]."
     Example: "Short-term goals (4-8 weeks): Reduce pain intensity, improve knee ROM to 110 degrees flexion, improve transfers and bed mobility. Long-term goals (6 months): Achieve independent ambulation with assistive device, improve lower extremity strength to 4/5, reduce reliance on pain medications, improve ADL independence."

CRITICAL: The response must contain TWO top-level objects:
1. medicalReport - containing all the medical report data as described in rules 1-10
2. ftfFormData - containing all the FTF form data as described in rule 11

Both must be included in a single JSON response with these exact keys.`;

interface PatientInfo {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  mrn: string;
  dateOfReport: string;
  hospital: string;
}

interface ClinicalFile {
  base64: string;
  type: "image" | "pdf";
  filename: string;
  mimeType: string;
}

interface PatientData {
  patientInfo: PatientInfo;
  clinicalText: string;
  clinicalFiles?: ClinicalFile[];
}

async function generateSingleReport(patientData: PatientData) {
  const { patientInfo, clinicalText, clinicalFiles } = patientData;

  // Validate total file size if files are present
  if (clinicalFiles && clinicalFiles.length > 0) {
    let totalSize = 0;
    for (const file of clinicalFiles) {
      // Estimate file size from base64 (base64 is ~1.37x original)
      const estimatedSize = (file.base64.length * 0.75) / (1024 * 1024); // MB
      totalSize += estimatedSize;
    }
    if (totalSize > 30) {
      throw new Error(`Total file size too large (${totalSize.toFixed(1)}MB). Maximum is 30MB.`);
    }
  }

  // Build user content
  const userContent: Array<any> = [];

  // Add patient information as text
  userContent.push({
    type: "text",
    text: `Patient Information (use these exact values):
Name: ${patientInfo.name}
Date of Birth: ${patientInfo.dateOfBirth}
Gender: ${patientInfo.gender}
MRN: ${patientInfo.mrn}
Date of Report: ${patientInfo.dateOfReport}
Hospital: ${patientInfo.hospital}`,
  });

  // Add clinical text
  if (clinicalText) {
    userContent.push({
      type: "text",
      text: `Clinical Description:\n${clinicalText}`,
    });
  }

  // Add clinical files (images and PDFs) if provided
  if (clinicalFiles && clinicalFiles.length > 0) {
    for (const file of clinicalFiles) {
      if (file.type === "pdf") {
        // For PDFs, use the new "file" content type (OpenAI March 2025 format)
        userContent.push({
          type: "file",
          file: {
            file_data: `data:application/pdf;base64,${file.base64}`,
            filename: file.filename,
          },
        });

        userContent.push({
          type: "text",
          text: `The above PDF document "${file.filename}" contains clinical notes, findings, or medical records. Please extract all relevant clinical information from all pages.`,
        });
      } else {
        // For images, use image_url content type
        userContent.push({
          type: "image_url",
          image_url: {
            url: `data:${file.mimeType};base64,${file.base64}`,
          },
        });

        userContent.push({
          type: "text",
          text: `The above image "${file.filename}" contains clinical notes or findings.`,
        });
      }
    }
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "combined_medical_and_ftf_data",
        strict: true,
        schema: {
          type: "object",
          properties: {
            medicalReport: {
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
              ftfFormData: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  date: { type: "string" },
                  homebound_check: { type: "string", enum: ["on"] },
                  reason_homebound_check: { type: "string", enum: ["on"] },
                  reason_1: { type: "string" },
                  findings_1: { type: "string" },
                  reason_2: { type: "string" },
                  findings_2: { type: "string" },
                  risk_factors: { type: "string" },
                  session_week_1: { type: "string", enum: ["3/week"] },
                  session_week_1_check: { type: "string", enum: ["on"] },
                  session_week_2: { type: "string", enum: ["3/week"] },
                  duration_pt: { type: "string", enum: ["6 months"] },
                  treatment_details: { type: "string" },
                },
                required: [
                  "name",
                  "date",
                  "homebound_check",
                  "reason_homebound_check",
                  "reason_1",
                  "findings_1",
                  "reason_2",
                  "findings_2",
                  "risk_factors",
                  "session_week_1",
                  "session_week_1_check",
                  "session_week_2",
                  "duration_pt",
                  "treatment_details",
                ],
                additionalProperties: false,
              },
            },
            required: ["medicalReport", "ftfFormData"],
            additionalProperties: false,
          },
        },
      },
    });

  const reportText = response.choices[0]?.message?.content;
  if (!reportText) {
    throw new Error("No response from OpenAI");
  }

  const combinedData = JSON.parse(reportText);
  const validatedData = CombinedResponseSchema.parse(combinedData);

  return validatedData;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patients } = body as { patients: PatientData[] };

    if (!patients || patients.length === 0) {
      return NextResponse.json(
        { error: "No patients data provided" },
        { status: 400 }
      );
    }

    const results: Array<{
      patientId: string;
      patientName: string;
      report: any;
      status: "success" | "error";
      error?: string;
    }> = [];

    // Process 2 patients at a time
    for (let i = 0; i < patients.length; i += 2) {
      const chunk = patients.slice(i, i + 2);

      const chunkResults = await Promise.all(
        chunk.map(async (patientData) => {
          try {
            const combinedData = await generateSingleReport(patientData);
            return {
              patientId: patientData.patientInfo.id,
              patientName: patientData.patientInfo.name,
              report: combinedData, // Now includes both medicalReport and ftfFormData
              status: "success" as const,
            };
          } catch (err: any) {
            return {
              patientId: patientData.patientInfo.id,
              patientName: patientData.patientInfo.name,
              report: null,
              status: "error" as const,
              error: err.message,
            };
          }
        })
      );

      results.push(...chunkResults);
    }

    return NextResponse.json({
      success: true,
      reports: results,
    });

  } catch (error: any) {
    console.error("Error generating reports batch:", error);
    return NextResponse.json(
      {
        error: "Failed to generate reports",
        message: error.message
      },
      { status: 500 }
    );
  }
}
