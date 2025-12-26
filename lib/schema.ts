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

// FTF (Face-to-Face) Home Healthcare Referral Form Schema
export const FTFFormSchema = z.object({
  name: z.string(),
  date: z.string(), // Format: DD/MM/YYYY
  homebound_check: z.literal("on"),
  reason_homebound_check: z.literal("on"),
  reason_1: z.string(), // Pain points/clinical reason
  findings_1: z.string(), // Homebound status justification
  reason_2: z.string(), // Duplicate of reason_1
  findings_2: z.string(), // Duplicate of findings_1
  risk_factors: z.string(), // Chronic conditions as comma-separated string
  session_week_1: z.literal("3/week"),
  session_week_1_check: z.literal("on"),
  session_week_2: z.literal("3/week"),
  duration_pt: z.literal("6 months"),
  treatment_details: z.string(), // Summary of PT goals
});

export type FTFFormData = z.infer<typeof FTFFormSchema>;

// Combined response schema for medical report + FTF form data
export const CombinedResponseSchema = z.object({
  medicalReport: ReportSchema,
  ftfFormData: FTFFormSchema,
});

export type CombinedResponseData = z.infer<typeof CombinedResponseSchema>;
