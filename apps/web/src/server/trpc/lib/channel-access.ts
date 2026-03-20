import { prisma } from '@line-oa/db';

/**
 * Resolve accessible LINE account IDs for the current admin.
 *
 * Policy (deny-by-default):
 * - SUPER_ADMIN → null (no filter, sees everything)
 * - ADMIN with channel access records → string[] of assigned channel IDs
 * - ADMIN with NO records → [] (empty = sees NOTHING)
 *
 * If a SUPER_ADMIN hasn't assigned any channels to an admin,
 * that admin cannot access any chats, contacts, or overview data.
 */
export async function getAccessibleChannelIds(adminUserId: string): Promise<string[] | null> {
  const user = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  });

  // SUPER_ADMIN bypasses all access control
  if (user?.role === 'SUPER_ADMIN') return null;

  const accessRecords = await prisma.adminChannelAccess.findMany({
    where: { adminUserId },
    select: { lineAccountId: true },
  });

  // No records → deny all (empty array = no accessible channels)
  if (accessRecords.length === 0) return [];

  return accessRecords.map((r) => r.lineAccountId);
}

/**
 * Build a Prisma `where` clause for lineAccountId with access control.
 * @param accessibleIds - from getAccessibleChannelIds()
 * @param selectedId - optional user-selected lineAccountId
 * @returns Prisma where condition for lineAccountId, or null if no filter needed
 */
export function buildChannelWhere(
  accessibleIds: string[] | null,
  selectedId?: string
): Record<string, unknown> | null {
  // Empty array = admin has no assigned channels → deny everything
  if (accessibleIds && accessibleIds.length === 0) {
    return { __denied: true };
  }

  if (selectedId) {
    // User selected a specific channel — verify access
    if (accessibleIds && !accessibleIds.includes(selectedId)) {
      return { __denied: true }; // Sentinel: access denied
    }
    return { lineAccountId: selectedId };
  }

  if (accessibleIds) {
    return { lineAccountId: { in: accessibleIds } };
  }

  return null; // No filter needed (SUPER_ADMIN)
}
