import { adminService } from './adminService';
import { landingMockPresets, landingMockRecords, LANDING_TESTIMONIALS, LANDING_MOCK_OPTIONS } from '../mock/landing';
import type { PublicTracking, Testimonial } from '../mock/landing';
import type { ProductPreset } from './customerTypes';
import type { AdminData, DemoState } from './adminTypes';
export interface LandingData { products: ProductPreset[]; preview: PublicTracking | null; testimonials: Testimonial[]; sampleCodes: string[]; codeMaxLength: number }
export interface LandingService { load(): Promise<LandingData>; lookup(code: string): Promise<PublicTracking | null>; setDemoState?(state: DemoState): void }
export function createLandingService(options = { demo: import.meta.env.VITE_DEMO === 'true', delayMs: LANDING_MOCK_OPTIONS.delayMs }, source: { load: () => Promise<AdminData>; setDemoState?: (state: DemoState) => void } = adminService): LandingService {
  let scenario: DemoState = 'data';
  const records = async () => { if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs)); if (scenario === 'error') throw new Error('Không thể tải dữ liệu minh họa.'); const data = await source.load(); const products = scenario === 'empty' || !data.settings ? [] : landingMockPresets(data.settings.temperature, data.pageSize); return { products, samples: landingMockRecords(products) }; };
  return {
    async load() { const { products, samples } = await records(); return { products, preview: samples[0] ?? null, testimonials: scenario === 'empty' ? [] : structuredClone(LANDING_TESTIMONIALS), sampleCodes: samples.map(item => item.code), codeMaxLength: LANDING_MOCK_OPTIONS.codeMaxLength }; },
    async lookup(code) { const normalized = code.trim().toUpperCase(); if (!normalized || normalized.length > LANDING_MOCK_OPTIONS.codeMaxLength) return null; const { samples } = await records(); return samples.find(item => item.code === normalized) ?? null; },
    setDemoState(state) { if (options.demo) { scenario = state; source.setDemoState?.('data'); } },
  };
}
export const landingService = createLandingService();
