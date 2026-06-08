import { describe, it, expect } from 'vitest';

import openapi from '~openapi';

interface OperationLike {
  operationId?: string;
  responses?: Record<string, unknown>;
}

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace']);

describe('public/openapi.json', () => {
  it('info.title 是 i18n-studio API', () => {
    expect((openapi as { info: { title: string } }).info.title).toMatch(/i18n-studio/i);
  });

  it('paths 至少包含若干预期 path', () => {
    const paths = (openapi as { paths: Record<string, unknown> }).paths;
    const expected = [
      '/api/namespaces',
      '/api/namespaces/{slug}',
      '/api/namespaces/{slug}/entries',
      '/api/namespaces/{slug}/entries/{key}',
      '/snapshot/{slug}',
    ];
    for (const p of expected) {
      expect(paths).toHaveProperty(p);
    }
  });

  it('每个 operation 都含 operationId 与 responses', () => {
    const paths = (openapi as { paths: Record<string, Record<string, OperationLike>> }).paths;
    const seenIds = new Set<string>();
    for (const [pathKey, methods] of Object.entries(paths)) {
      for (const [methodKey, op] of Object.entries(methods)) {
        // 跳过 path-level 的非 operation 字段(parameters / summary / description 等)。
        if (!HTTP_METHODS.has(methodKey.toLowerCase())) continue;
        if (typeof op !== 'object' || op === null) continue;
        expect(op.operationId, `${methodKey.toUpperCase()} ${pathKey} 缺 operationId`).toBeDefined();
        expect(op.responses, `${methodKey.toUpperCase()} ${pathKey} 缺 responses`).toBeDefined();
        if (op.operationId) {
          expect(seenIds.has(op.operationId), `operationId 重复: ${op.operationId}`).toBe(false);
          seenIds.add(op.operationId);
        }
      }
    }
    expect(seenIds.size).toBeGreaterThan(0);
  });

  it('包含三个 securityScheme', () => {
    const sch = (openapi as { components: { securitySchemes: Record<string, unknown> } }).components.securitySchemes;
    expect(Object.keys(sch).sort()).toEqual(['cookieSession', 'readonlyBearer', 'taskBearer'].sort());
  });
});
