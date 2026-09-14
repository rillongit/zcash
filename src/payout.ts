/** Custodial shielded hop. Merchants never hold keys. Last mile stays Wave, MTN, or SPI. */

export type LastMileRail = "wave" | "mtn" | "spi";

export type ZcashPayout = {
  payout_id: string;
  last_mile_rail: LastMileRail;
};

export type ZcashPayoutStatus = "pending" | "shielded" | "reconciled" | "failed";
