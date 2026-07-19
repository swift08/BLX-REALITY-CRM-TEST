// ============================================================
// Meta Lead Ads Field Mapping Configuration
// Description: Map Meta (Facebook/Instagram) form field names to CRM customer fields.
// ============================================================

export const metaLeadFieldMapping: Record<string, string> = {
  // Common Facebook/Instagram default keys to CRM Customer columns
  full_name: "name",
  name: "name",
  phone_number: "phone",
  phone: "phone",
  email: "email",
  city: "city",

  // Custom form questions to CRM Opportunity budget / project_id
  budget: "budget",
  project_interested: "project_id",
  project: "project_id",

  // Case variations for fallback safety
  "Full Name": "name",
  "Phone Number": "phone",
  Phone: "phone",
  Email: "email",
  City: "city",
  Budget: "budget",
  Project: "project_id",
};
