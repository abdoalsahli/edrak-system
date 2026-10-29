import type { DocStatus } from "@/lib/casePlans/options";
import type { CycleSummary } from "@/lib/casePlans/CycleService";

export type { CycleSummary };

export type Review = {
  status: DocStatus;
  submittedAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: { name: string } | null;
};

export type PlanGoal = { id: string; text: string; sortOrder: number; achievement: "ACHIEVED" | "PARTIAL" | "NOT_ACHIEVED" | null };

export type FollowUpReport = Review & {
  id: string;
  reportDate: string;
  diagnosis: string;
  progressLevel: string;
  changes: string[];
  parentCommitment: string;
  obstacles: string[];
  recommendations: string;
  updatedAt: string;
};

export type TreatmentPlan = Review & {
  id: string;
  planDate: string;
  caseSummary: string;
  longTermGoals: string;
  methods: string;
  focusAreas: string[];
  notes: string | null;
  goals: PlanGoal[];
  report: FollowUpReport | null;
  updatedAt: string;
};

export type PlanDraft = {
  caseSummary: string;
  longTermGoals: string;
  methods: string;
  focusAreas: string[];
  notes: string | null;
  goals: string[];
};

export type CycleDetail = {
  program: {
    id: string;
    status: string;
    patient: { id: string; fullName: string; patientType: string };
    therapist: { id: string; fullName: string };
    service: { name: string };
  };
  cycle: CycleSummary;
  cycleCount: number;
  plan: TreatmentPlan | null;
  report: FollowUpReport | null;
  previous: { cycleNumber: number; plan: PlanDraft; recommendations: string | null; diagnosis: string | null } | null;
  sessions: { id: string; sequence: number; status: string; notes: string | null; date: string | null; startTime: string | null }[];
  canEditPlan: boolean;
  canEditReport: boolean;
  canReview: boolean;
};
