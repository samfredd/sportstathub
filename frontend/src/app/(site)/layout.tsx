import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileBottomBar from "@/components/MobileBottomBar";
import AdCarousel, { FEED_SLIDES } from "@/components/AdCarousel";
import { UpgradeModalProvider } from "@/context/UpgradeModalContext";

export default function SiteLayout({ children }) {
  return (
    <UpgradeModalProvider>
      <Navbar />
      <div className="max-w-[1600px] mx-auto">
        {children}

        {/* Global Bottom Ad Placement */}
        <div className="px-4 lg:px-6 mt-12 mb-0">
          <AdCarousel slides={FEED_SLIDES} variant="banner" autoplayMs={7000} />
        </div>
      </div>
      <Footer />
      <MobileBottomBar />
    </UpgradeModalProvider>
  );
}
