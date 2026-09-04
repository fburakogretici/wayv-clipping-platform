/**
 * Application-wide constants.
 * Eliminates magic numbers scattered across the codebase.
 */

/** Number of views that constitute one payout unit */
export const VIEWS_PER_PAYOUT_UNIT = 1000;

/** Maximum number of days to display on the daily views chart */
export const CHART_MAX_DAYS = 14;

/** Milliseconds in a single day */
export const MS_PER_DAY = 86_400_000;

/** Ingest script: minimum growth factor per run (5%) */
export const INGEST_GROWTH_MIN = 1.05;

/** Ingest script: additional random growth range (up to 10%) */
export const INGEST_GROWTH_RANGE = 0.10;

/** Ingest script: default base views for submissions with no prior metrics */
export const INGEST_DEFAULT_BASE_VIEWS = 1000;
