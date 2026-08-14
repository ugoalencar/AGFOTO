export function createOperationStore() {
  const operations = new Map();

  return {
    requireOperationId(req) {
      const id = req.body?.operationId || req.headers?.['x-operation-id'];
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        throw new Error('operationId is required');
      }
      return id.trim();
    },

    begin(operationId, action) {
      const existing = operations.get(operationId);
      if (existing?.status === 'started') {
        throw new Error(`operationId already in progress: ${operationId}`);
      }
      if (existing?.status === 'completed') {
        if (existing.action !== action) {
          throw new Error(`operationId already completed for a different action: ${operationId}`);
        }
        return existing;
      }

      const record = {
        operationId,
        action,
        status: 'started',
        startedAt: new Date().toISOString(),
        completedAt: null,
        result: null
      };
      operations.set(operationId, record);
      return record;
    },

    complete(operationId, result) {
      const record = operations.get(operationId);
      if (!record) throw new Error(`operationId not started: ${operationId}`);

      record.status = 'completed';
      record.completedAt = new Date().toISOString();
      record.result = result;
      operations.set(operationId, record);
      return record;
    },

    get(operationId) {
      return operations.get(operationId) || null;
    }
  };
}
