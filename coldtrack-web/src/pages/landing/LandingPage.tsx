import { useCallback, useEffect, useRef, useState } from 'react';
import { landingContent as copy } from '../../content/landing';
import { landingService } from '../../services/landingService';
import type { LandingData, LandingService } from '../../services/landingService';
import type { DemoState } from '../../services/adminTypes';
import { LandingHeader, HeroSection, MetricsSection, SolutionsSection, ArchitectureSection, ComparisonSection, ProcessSection, TrackingSection, FoodSection, TestimonialsSection, FAQSection, ClosingSection, LandingFooter, LandingLoadMessage } from './LandingSections';
import './landing.css';
export function LandingPage({ service = landingService }: { service?: LandingService }) {
  const [data, setData] = useState<LandingData | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const request = useRef(0);
  const load = useCallback(async () => { const id = ++request.current; setLoading(true); setError(false); try { const result = await service.load(); if (id === request.current) setData(result); } catch { if (id === request.current) { setData(null); setError(true); } } finally { if (id === request.current) setLoading(false); } }, [service]);
  useEffect(() => { void load(); return () => { request.current++; }; }, [load]);
  const demo = (state: DemoState) => { service.setDemoState?.(state); void load(); };
  return <div className="landing-page"><a className="landing-skip" href="#landing-main">{copy.ui.skip}</a><LandingHeader /><main id="landing-main">{import.meta.env.VITE_DEMO === 'true' && <div className="landing-demo-toolbar"><span>{copy.ui.demo}</span><button onClick={() => demo('data')}>{copy.ui.data}</button><button onClick={() => demo('empty')}>{copy.ui.emptyState}</button><button onClick={() => demo('error')}>{copy.ui.errorState}</button></div>}<LandingLoadMessage error={error} retry={() => void load()} /><HeroSection data={data} loading={loading} /><MetricsSection /><SolutionsSection data={data} /><ArchitectureSection /><ComparisonSection /><ProcessSection /><TrackingSection data={data} service={service} /><FoodSection data={data} /><TestimonialsSection data={data} /><FAQSection /><ClosingSection /></main><LandingFooter /></div>;
}
