/**
 * Shared error codes used across server and client.
 * Avoids brittle string comparisons like `error.message === "BUDGET_EXCEEDED"`.
 */
export const ErrorCodes = {
  BUDGET_EXCEEDED: "BUDGET_EXCEEDED",
  CAMPAIGN_NOT_ACTIVE: "CAMPAIGN_NOT_ACTIVE",
  CAMPAIGN_COMPLETED: "CAMPAIGN_COMPLETED",
  SUBMISSION_NOT_FOUND: "SUBMISSION_NOT_FOUND",
  SUBMISSION_ALREADY_PROCESSED: "SUBMISSION_ALREADY_PROCESSED",
  DUPLICATE_URL: "DUPLICATE_URL",
  INVALID_PLATFORM: "INVALID_PLATFORM",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
