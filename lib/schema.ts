import { z } from "zod";

export const ReportSchema = z.object({
  patientInformation: z.object({
    name: z.string(),
    dateOfBirth: z.string(),
    gender: z.string(),
    mrn: z.string(),
    dateOfReport: z.string(),
    hospital: z.string(),
  }),
  clinicalHistory: z.string(),
  pastMedicalHistory: z.array(z.string()),
  vitalSigns: z.array(z.string()),
  clinicalNotes: z.string(),
  diagnoses: z.array(
    z.object({
      label: z.string(),
      code: z.string(),
      description: z.string(),
    })
  ),
  treatmentPlan: z.object({
    medications: z.array(z.string()),
    homePhysio: z.object({
      frequency: z.string(),
      duration: z.string(),
    }),
    shortTermGoals: z.array(z.string()),
    longTermGoals: z.array(z.string()),
  }),
  prognosis: z.array(z.string()),
  conclusion: z.string(),
  signature: z.object({
    greeting: z.string(),
    doctorName: z.string(),
    title: z.string(),
    dohLicense: z.string(),
    facility: z.string(),
    date: z.string(),
    signatureStamp: z.string(),
  }),
});

export type ReportData = z.infer<typeof ReportSchema>;
