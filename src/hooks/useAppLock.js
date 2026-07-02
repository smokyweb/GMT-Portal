/**
 * useAppLock - returns true when an application is in a read-only (locked) state.
 * Locked statuses: Closed, Archived
 * Usage: const locked = useAppLock(application);
 *        <Input disabled={locked} />
 *        <Button disabled={locked || otherCondition}>Save</Button>
 */
export const LOCKED_STATUSES = ['Closed', 'Archived'];

export function useAppLock(application) {
  if (!application) return false;
  return LOCKED_STATUSES.includes(application.status);
}

export function isAppLocked(application) {
  if (!application) return false;
  return LOCKED_STATUSES.includes(application.status);
}