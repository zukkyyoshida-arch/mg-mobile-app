import { describe, it, expect, vi, afterEach } from 'vitest';
import { pushPlayer, setPushBlocked, PushBlockedError, fetchPlayerRecord } from '../../src/sync/client.js';

afterEach(() => { setPushBlocked(false); vi.unstubAllGlobals(); });

describe('sync client', () => {
  it('保存データ破損中は push せず fetch も呼ばない。pull は可能', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ version: 1, data: {}, backup: null }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    setPushBlocked(true);
    await expect(pushPlayer('r', 'p', {}, undefined)).rejects.toBeInstanceOf(PushBlockedError);
    expect(f).not.toHaveBeenCalled();
    await expect(fetchPlayerRecord('r', 'p')).resolves.toMatchObject({ version: 1 });
  });
  it('409 は conflict として server を返す', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'version_conflict', server: { version: 3, data: {}, backup: null } }), { status: 409 })));
    const r = await pushPlayer('r', 'p', {}, undefined, 1);
    expect(r.conflict).toBe(true); expect(r.server.version).toBe(3);
  });
});
