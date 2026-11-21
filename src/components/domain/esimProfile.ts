
import { listEntities } from '../../services/entityOps';

// Mock GSMA SGP.22-style activation string (LPA:1$smdp-address$matching-id) - not a real SM-DP+ call, see SimTypeStep on not fabricating an eSIM
// provisioning API. Random per issuance so the QR code is distinct each time.
function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let matchingId = '';
  for (let i = 0; i < 16; i++) matchingId += chars[Math.floor(Math.random() * chars.length)];
  return `LPA:1$smdp.vodafone.qa$${matchingId}`;
}

// A new ICCID in the same numbering as the stock's (8974412009900 + 6 digits), different from every one in `taken`.
function generateIccid(taken: ReadonlySet<string>): string {
  for (;;) {
    const iccid = `8974412009900${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`;
    if (!taken.has(iccid)) return iccid;
  }
}

/**
 * Selects an eSIM: a profile with a new activation code. It takes its ICCID from the eSIM stock (a stocked, unassigned "Printed eSIM"), never one in
 * `usedIccids` (another SIM of the same order). With none in stock a new ICCID is generated - every eSIM has its own serial number, never one already in stock, never one
 * used by another SIM of the order. The one definition every eSIM selection uses.
 */

/**
 * Selects an eSIM: a profile with a new activation code. It takes its ICCID from the eSIM stock (a stocked, unassigned "Printed eSIM"), never one in
 * `usedIccids` (another SIM of the same order). With none in stock a new ICCID is generated - every eSIM has its own serial number, never one already in stock, never one
 * used by another SIM of the order. The one definition every eSIM selection uses.
 */
export async function issueEsimProfile(usedIccids: readonly string[] = []): Promise<{ iccid?: string; activationCode: string }> {
  await new Promise((r) => setTimeout(r, 500));
  const stock = await listEntities<{ iccid: string; simSerial?: string; type?: string; stockStatus: string; prePaired?: boolean }>('sims').catch(() => []);
  const profile = stock.find((x) => x.type === 'Printed eSIM' && x.stockStatus === 'Available' && !x.prePaired && !usedIccids.includes(x.iccid));
  if (profile) return { iccid: profile.iccid, activationCode: generateActivationCode() };
  return { iccid: generateIccid(new Set([...usedIccids, ...stock.flatMap((x) => [x.iccid, x.simSerial ?? ''])])), activationCode: generateActivationCode() };
}
