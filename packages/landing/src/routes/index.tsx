import { createFileRoute } from "@tanstack/react-router";
import { ApiShowcase } from "@/components/landing/api-showcase";
import { CtaSection } from "@/components/landing/cta-section";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Nav } from "@/components/landing/nav";
import { TrustPipeline } from "@/components/landing/trust-pipeline";

export const Route = createFileRoute("/")({ component: HomePage });

export function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <Features />
        <TrustPipeline />
        <HowItWorks />
        <ApiShowcase />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
