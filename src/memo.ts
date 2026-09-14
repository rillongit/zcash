export function payoutIdToMemoHex(payoutId: string): string {
  return Buffer.from(payoutId, "utf8").toString("hex");
}

/** ZIP-321 memo query value: UTF-8 id as unpadded base64url. */
export function payoutIdToMemoBase64Url(payoutId: string): string {
  return Buffer.from(payoutId, "utf8").toString("base64url");
}

export function memoBase64UrlToPayoutId(memo: string): string {
  return Buffer.from(memo, "base64url").toString("utf8");
}
