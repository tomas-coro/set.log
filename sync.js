// createPusher: orchestratore di debounce + retry/backoff per push verso lo store.
// Indipendente dal DOM, testabile con mock.timers di node:test.

export function createPusher({
  getData,
  getVersion,
  setVersion,
  setDirty,
  store,
  debounceMs = 2000,
  backoffSchedule = [10000, 30000, 60000, 60000, 60000],
  onConflict = null,       // async (err) => void (chiamato per ConflictError)
  onAuthError = null,      // async (err) => void
  onStatus = null,         // (state) => void: "pending"|"ok"|"error"
}) {
  let debounceHandle = null;
  let backoffHandle = null;
  let backoffIdx = 0;
  let inflight = false;

  async function attemptOnce() {
    if (inflight) return;
    inflight = true;
    try {
      const newVersion = await store.save(getData(), getVersion());
      setVersion(newVersion);
      setDirty(false);
      backoffIdx = 0;
      onStatus?.("ok");
    } catch (err) {
      onStatus?.("error");
      if (err && err.name === "ConflictError") {
        await onConflict?.(err);
        return;
      }
      if (err && err.name === "AuthError") {
        await onAuthError?.(err);
        return;
      }
      // Network/altro: schedula backoff.
      const delay = backoffSchedule[Math.min(backoffIdx, backoffSchedule.length - 1)];
      backoffIdx++;
      clearTimeout(backoffHandle);
      backoffHandle = setTimeout(attemptOnce, delay);
    } finally {
      inflight = false;
    }
  }

  return {
    schedule() {
      clearTimeout(debounceHandle);
      onStatus?.("pending");
      debounceHandle = setTimeout(attemptOnce, debounceMs);
    },
    async flush() {
      clearTimeout(debounceHandle);
      clearTimeout(backoffHandle);
      await attemptOnce();
    },
    cancel() {
      clearTimeout(debounceHandle);
      clearTimeout(backoffHandle);
      backoffIdx = 0;
    },
  };
}
