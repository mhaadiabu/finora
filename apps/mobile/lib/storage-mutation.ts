const queues = new Map<string, Promise<unknown>>();

/** Serialize read-modify-write operations for one namespaced store. */
export function serializeStorageMutation<T>(key: string, operation: () => Promise<T>) {
  const previous = queues.get(key) ?? Promise.resolve();
  const current = previous.then(operation, operation);
  queues.set(
    key,
    current.finally(() => {
      if (queues.get(key) === current) queues.delete(key);
    }),
  );
  return current;
}

export async function waitForStorageMutations() {
  await Promise.allSettled(queues.values());
}
