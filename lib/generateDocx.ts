import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
} from "docx";
import type { ReportData } from "./schema";

export async function generateDocx(report: ReportData): Promise<Buffer> {
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    // Title
                    new Paragraph({
                        text: "Medical Report",
                        heading: HeadingLevel.TITLE,
                        alignment: AlignmentType.CENTER,
                        spacing: {
                            after: 400,
                        },
                    }),

                    // Patient Information
                    new Paragraph({
                        text: "Patient Information:",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            after: 200,
                        },
                    }),
                    ...createPatientInfo(report.patientInformation),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // Clinical History
                    new Paragraph({
                        text: "Clinical History:",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            after: 200,
                        },
                    }),
                    new Paragraph({
                        text: report.clinicalHistory,
                        spacing: {
                            after: 200,
                        },
                    }),

                    // Past Medical History
                    new Paragraph({
                        text: "Past Medical History:",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            after: 200,
                        },
                    }),
                    ...createBulletList(report.pastMedicalHistory),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // Vital Signs
                    new Paragraph({
                        text: "Vital Signs:",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            after: 200,
                        },
                    }),
                    ...createBulletList(report.vitalSigns),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // Clinical Notes
                    new Paragraph({
                        text: "Clinical Notes:",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            after: 200,
                        },
                    }),
                    new Paragraph({
                        text: report.clinicalNotes,
                        spacing: {
                            after: 200,
                        },
                    }),

                    // Diagnoses
                    new Paragraph({
                        text: "Diagnoses:",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            after: 200,
                        },
                    }),
                    ...createDiagnosesList(report.diagnoses),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // Treatment Plan
                    new Paragraph({
                        text: "Treatment Plan:",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            after: 200,
                        },
                    }),

                    // Medications
                    new Paragraph({
                        text: "Medications:",
                        heading: HeadingLevel.HEADING_3,
                        spacing: {
                            after: 100,
                        },
                    }),
                    ...createBulletList(report.treatmentPlan.medications),
                    new Paragraph({ text: "", spacing: { after: 100 } }),

                    // Home Physiotherapy
                    new Paragraph({
                        text: "Home Physiotherapy:",
                        heading: HeadingLevel.HEADING_3,
                        spacing: {
                            after: 100,
                        },
                    }),
                    new Paragraph({
                        text: `Frequency: ${report.treatmentPlan.homePhysio.frequency}`,
                    }),
                    new Paragraph({
                        text: `Duration: ${report.treatmentPlan.homePhysio.duration}`,
                        spacing: {
                            after: 100,
                        },
                    }),

                    // Short-Term Goals
                    new Paragraph({
                        text: "Short-Term Goals:",
                        heading: HeadingLevel.HEADING_3,
                        spacing: {
                            after: 100,
                        },
                    }),
                    ...createBulletList(report.treatmentPlan.shortTermGoals),
                    new Paragraph({ text: "", spacing: { after: 100 } }),

                    // Long-Term Goals
                    new Paragraph({
                        text: "Long-Term Goals:",
                        heading: HeadingLevel.HEADING_3,
                        spacing: {
                            after: 100,
                        },
                    }),
                    ...createBulletList(report.treatmentPlan.longTermGoals),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // Prognosis
                    new Paragraph({
                        text: "Prognosis:",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            after: 200,
                        },
                    }),
                    ...createBulletList(report.prognosis),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // Conclusion
                    new Paragraph({
                        text: "Conclusion:",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            after: 200,
                        },
                    }),
                    new Paragraph({
                        text: report.conclusion,
                        spacing: {
                            after: 400,
                        },
                    }),

                    // Signature
                    new Paragraph({
                        text: report.signature.greeting,
                        spacing: { after: 200 },
                    }),
                    new Paragraph({
                        text: report.signature.doctorName,
                        spacing: { after: 100 },
                    }),
                    new Paragraph({
                        text: report.signature.title,
                        spacing: { after: 100 },
                    }),
                    new Paragraph({
                        text: report.signature.dohLicense,
                        spacing: { after: 100 },
                    }),
                    new Paragraph({
                        text: report.signature.facility,
                        spacing: { after: 100 },
                    }),
                    new Paragraph({
                        text: report.signature.date,
                        spacing: { after: 200 },
                    }),
                    new Paragraph({
                        text: report.signature.signatureStamp,
                        spacing: { after: 100 },
                    }),
                ],
            },
        ],
    });

    return await Packer.toBuffer(doc);
}

function createPatientInfo(info: any): Paragraph[] {
    const fields = [
        `Name: ${info.name}`,
        `Date of Birth: ${info.dateOfBirth}`,
        `Gender: ${info.gender}`,
        `MRN: ${info.mrn}`,
        `Date of Report: ${info.dateOfReport}`,
        `Hospital: ${info.hospital}`,
    ];

    return fields.map(
        (field) =>
            new Paragraph({
                text: field,
                spacing: {
                    after: 100,
                },
            })
    );
}

function createBulletList(items: string[]): Paragraph[] {
    return items.map(
        (item) =>
            new Paragraph({
                text: item,
                bullet: {
                    level: 0,
                },
            })
    );
}

function createDiagnosesList(diagnoses: any[]): Paragraph[] {
    return diagnoses.map(
        (d) =>
            new Paragraph({
                text: `${d.label} (${d.code}): ${d.description}`,
                bullet: {
                    level: 0,
                },
            })
    );
}
