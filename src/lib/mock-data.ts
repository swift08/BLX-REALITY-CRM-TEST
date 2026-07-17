export type LeadStage =
  | "New"
  | "Contacted"
  | "Connected"
  | "Interested"
  | "Site Visit"
  | "Negotiation"
  | "Booking"
  | "Converted"
  | "Lost";

export type Temperature = "Hot" | "Warm" | "Cold";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  project: string;
  budget: string;
  source: string;
  owner: string;
  stage: LeadStage;
  temperature: Temperature;
  updated: string;
}

export const stages: LeadStage[] = [
  "New",
  "Contacted",
  "Interested",
  "Site Visit",
  "Negotiation",
  "Booking",
  "Converted",
];

export const leads: Lead[] = [];

export const followUps: any[] = [];

export const projects: any[] = [];

export const salesTeam: any[] = [];
