export interface SecurityConfig {
  watermarking: boolean;
  contentProtection: boolean;
  clipboardBlocking: boolean;
  printBlocking: boolean;
  idleTimeout: boolean;
  idleTimeoutMs: number;
  sessionLimits: boolean;
  deviceBinding: boolean;
  exportRestrictions: boolean;
  auditVerbosity: "low" | "medium" | "high";
}

export const securityConfig: SecurityConfig = {
  watermarking: true,
  contentProtection: true,
  clipboardBlocking: true,
  printBlocking: true,
  idleTimeout: true,
  idleTimeoutMs: 15 * 60 * 1000, // 15 minutes
  sessionLimits: true,
  deviceBinding: true,
  exportRestrictions: true,
  auditVerbosity: "high",
};
