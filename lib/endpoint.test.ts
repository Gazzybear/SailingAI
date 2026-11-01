import {afterEach,expect,it,vi} from 'vitest';
import {POST} from '../app/api/extract/route';
afterEach(()=>vi.unstubAllEnvs());
const request=(body:unknown)=>new Request('http://localhost/api/extract',{method:'POST',body:JSON.stringify(body)});
it('fails closed when public live calls are disabled',async()=>{vi.stubEnv('LIVE_AI_ENABLED','false');const r=await POST(request({observation:'Crew well'}));expect(r.status).toBe(503);expect((await r.json()).error).toContain('disabled');});
it('explains missing credentials without losing the manual fallback',async()=>{vi.stubEnv('LIVE_AI_ENABLED','true');vi.stubEnv('OPENAI_API_KEY','');const r=await POST(request({observation:'Crew well'}));expect(r.status).toBe(503);expect((await r.json()).error).toContain('manually');});
it('rejects invalid bodies before making any chargeable request',async()=>{vi.stubEnv('LIVE_AI_ENABLED','true');vi.stubEnv('OPENAI_API_KEY','test-placeholder');const r=await POST(request({observation:''}));expect(r.status).toBe(400);});
