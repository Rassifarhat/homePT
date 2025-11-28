import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

const EXTRACTION_PROMPT = `Extract patient demographic information from this image.

Return a JSON object with these exact fields:
- name: Patient's full name
- dateOfBirth: Date of birth (format as shown in image)
- gender: Patient's gender
- mrn: Medical record number
- dateOfReport: Date shown on the document (or today's date if not visible)

If any field is not readable or not present, use "Unknown" as the value.

Return ONLY valid JSON, no explanations or markdown.`;

async function fileToBase64DataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = file.type || "image/jpeg";
  return `data:${mimeType};base64,${base64}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("patientImages") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No patient images provided" },
        { status: 400 }
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 patient images allowed" },
        { status: 400 }
      );
    }

    // Process all images in parallel for much faster extraction
    const extractionPromises = files.map(async (file, i) => {
      const imageDataUrl = await fileToBase64DataUrl(file);

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: EXTRACTION_PROMPT,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageDataUrl,
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "patient_info_extraction",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  dateOfBirth: { type: "string" },
                  gender: { type: "string" },
                  mrn: { type: "string" },
                  dateOfReport: { type: "string" },
                },
                required: ["name", "dateOfBirth", "gender", "mrn", "dateOfReport"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No response from OpenAI");
        }

        const patientInfo = JSON.parse(content);

        return {
          id: `patient-${i}-${Date.now()}`,
          ...patientInfo,
          hospital: "Emirates International Hospital",
          imageIndex: i,
        };

      } catch (err: any) {
        // If extraction fails for one image, include error info
        return {
          id: `patient-${i}-${Date.now()}`,
          name: `Patient ${i + 1} (Extraction Failed)`,
          dateOfBirth: "Unknown",
          gender: "Unknown",
          mrn: "Unknown",
          dateOfReport: new Date().toISOString().split('T')[0],
          hospital: "Emirates International Hospital",
          imageIndex: i,
          extractionError: err.message,
        };
      }
    });

    const extractedPatients = await Promise.all(extractionPromises);

    return NextResponse.json({
      success: true,
      patients: extractedPatients,
    });

  } catch (error: any) {
    console.error("Error extracting patient info:", error);
    return NextResponse.json(
      {
        error: "Failed to extract patient information",
        message: error.message
      },
      { status: 500 }
    );
  }
}
