const snapshots = new Map()
const MAX_SNAPSHOTS = 8

export function getProfileSnapshot(key) {
  if (!key) return null
  const snapshot = snapshots.get(key)
  if (!snapshot) return null
  snapshots.delete(key)
  snapshots.set(key, snapshot)
  return snapshot
}

export function saveProfileSnapshot(key, profile) {
  if (!key || !profile?.user) return
  snapshots.delete(key)
  snapshots.set(key, profile)
  while (snapshots.size > MAX_SNAPSHOTS) snapshots.delete(snapshots.keys().next().value)
}

export function clearProfileSnapshot(key) {
  if (key) snapshots.delete(key)
}
