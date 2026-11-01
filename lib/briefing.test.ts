import {afterEach,expect,it,vi} from 'vitest';
import {GET} from '../app/api/briefing/route';
import {display,finite,weatherLabel} from './briefing';
afterEach(()=>vi.restoreAllMocks());
it('preserves missing readings instead of turning them into zero',()=>{expect(finite(null)).toBeNull();expect(finite('0')).toBeNull();expect(finite(0)).toBe(0);expect(display(null,'m')).toBe('Not available');expect(weatherLabel(null)).toBe('Not available');});
it('rejects invalid coordinates before contacting providers',async()=>{const spy=vi.spyOn(globalThis,'fetch');const response=await GET(new Request('http://localhost/api/briefing?latitude=99&longitude=0'));expect(response.status).toBe(400);expect(spy).not.toHaveBeenCalled();});
it('joins by valid time and retains model grid/source provenance',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({latitude:50.7,longitude:-1.2,hourly:{time:['2026-11-01T12:00'],wind_speed_10m:[0],visibility:[null]}})).mockResolvedValueOnce(Response.json({latitude:50.8,longitude:-1.1,hourly:{time:['2026-11-01T13:00'],wave_height:[0.4],sea_level_height_msl:[-0.2]}}));const response=await GET(new Request('http://localhost/api/briefing?latitude=50.70&longitude=-1.20'));const data=await response.json();expect(data.rows).toHaveLength(2);expect(data.rows[0].wind).toBe(0);expect(data.rows[0].wave).toBeNull();expect(data.rows[1].seaLevel).toBe(-0.2);expect(data.sources[1].longitude).toBe(-1.1);expect(data.sources[0].retrievedAt).toBeTruthy();});
it('keeps weather usable when marine provider fails',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({latitude:51,longitude:1,hourly:{time:['2026-11-01T12:00'],wind_speed_10m:[12]}})).mockRejectedValueOnce(new Error('offline'));const r=await GET(new Request('http://localhost/api/briefing?latitude=51&longitude=1'));const data=await r.json();expect(r.status).toBe(200);expect(data.errors).toHaveLength(1);expect(data.rows[0].wave).toBeNull();});
import { forecastAt, type ForecastRow } from './briefing';
it('selects the current hour and never silently substitutes for an unavailable arrival', () => {
  const rows = [{time:'2026-11-01T15:00Z'}, {time:'2026-11-01T17:00Z'}] as ForecastRow[];
  expect(forecastAt(rows, null, Date.parse('2026-11-01T15:59:00Z'))?.time).toBe(rows[0].time);
  expect(forecastAt(rows, '2026-11-01T17:00:00.000Z')?.time).toBe(rows[1].time);
  expect(forecastAt(rows, '2026-11-01T16:00Z')).toBeUndefined();
  expect(forecastAt(rows, null, Date.parse('2026-11-02T15:00Z'))).toBeUndefined();
});
it('requests sea cells and separates wind waves, swell and precipitation probability', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({latitude:49,longitude:-3,hourly:{time:['2026-11-01T15:00'],precipitation_probability:[70],precipitation:[0.3],visibility:[1852]}})).mockResolvedValueOnce(Response.json({latitude:49,longitude:-3,hourly:{time:['2026-11-01T15:00'],wave_height:[1.2],wind_wave_height:[0.7],swell_wave_height:[0.8],swell_wave_direction:[240],swell_wave_period:[8]}}));
  const result = await GET(new Request('http://localhost/api/briefing?latitude=49&longitude=-3'));
  const data = await result.json();
  expect(data.rows[0]).toMatchObject({rainChance:70,rain:0.3,visibility:1852,wave:1.2,windWave:0.7,swell:0.8,swellDirection:240,swellPeriod:8});
  for (const call of spy.mock.calls) expect(new URL(String(call[0])).searchParams.get('cell_selection')).toBe('sea');
});
