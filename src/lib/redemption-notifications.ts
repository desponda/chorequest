import type { Redemption } from './types'

export function classifyRedemptionChanges(
  previousPendingIds: string[],
  current: Pick<Redemption, 'id' | 'status'>[],
  locallyCancelledIds: ReadonlySet<string> = new Set(),
): { approvedIds: string[]; deniedIds: string[]; pendingIds: string[] } {
  const pendingIds = current.filter((redemption) => redemption.status === 'pending').map((redemption) => redemption.id)
  const pendingSet = new Set(pendingIds)
  const deniedSet = new Set(
    current.filter((redemption) => redemption.status === 'denied').map((redemption) => redemption.id),
  )

  const deniedIds = previousPendingIds.filter((id) => deniedSet.has(id))
  const approvedIds = previousPendingIds.filter((id) =>
    !pendingSet.has(id) && !deniedSet.has(id) && !locallyCancelledIds.has(id),
  )

  return { approvedIds, deniedIds, pendingIds }
}
