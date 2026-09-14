export function payoutIdToMemoHex(payoutId: string): string {
  return Buffer.from(payoutId, "utf8").toString("hex");
}
