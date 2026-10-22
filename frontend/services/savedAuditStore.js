export const AUDITS_KEY = 'ecoloco.savedAudits.v1';

export function createAuditStore(storage) {
  let pending = Promise.resolve();

  async function read() {
    const raw = await storage.getItem(AUDITS_KEY);
    if (raw == null) return [];
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.audits) || data.audits.some(a =>
      !a.id || typeof a.name !== 'string' || !a.request || !Array.isArray(a.request.plants) || !a.plan?.summary
    )) throw new Error('Could not read saved audits.');
    return data.audits;
  }

  function change(update) {
    const result = pending.then(async () => {
      const audits = await read();
      const { next, value } = update(audits);
      await storage.setItem(AUDITS_KEY, JSON.stringify({ version: 1, audits: next }));
      return value;
    });
    pending = result.catch(() => {});
    return result;
  }

  return {
    async list() {
      await pending;
      return (await read()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    save(input) {
      const name = input.name.trim();
      if (!name || name.length > 80 || !/^\d{5}$/.test(input.zipCode) || !input.request.plants.length || !input.plan?.summary) {
        return Promise.reject(new Error('Give this audit a name and finish checking its plants first.'));
      }
      const snapshot = JSON.parse(JSON.stringify({
        id: input.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        name,
        zipCode: input.zipCode,
        request: {
          ...input.request,
          plants: input.request.plants.map(({ _id, plant_name, scientific_name, status }) => ({ _id, plant_name, scientific_name, status })),
        },
        plan: input.plan,
        nearby: input.nearby || [],
        letter: input.letter || '',
      }));
      return change(audits => {
        const now = new Date().toISOString();
        const previous = audits.find(a => a.id === snapshot.id);
        const audit = { ...snapshot, createdAt: previous?.createdAt || now, updatedAt: now };
        return { next: [audit, ...audits.filter(a => a.id !== audit.id)], value: audit };
      });
    },

    remove(id) {
      return change(audits => ({ next: audits.filter(a => a.id !== id) }));
    },
  };
}
