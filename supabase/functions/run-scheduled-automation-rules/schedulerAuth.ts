export async function validSchedulerSignature(req: Request, key: string, now = Date.now()): Promise<boolean> {
  const timestamp = req.headers.get("x-scheduler-timestamp") ?? "";
  const signature = req.headers.get("x-scheduler-signature") ?? "";
  if (!key || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(`run-scheduled-automation-rules:${timestamp}`));
  const expected = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return difference === 0;
}