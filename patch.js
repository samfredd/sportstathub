const fs = require('fs');
let code = fs.readFileSync('frontend/src/app/(site)/page.tsx', 'utf-8');

// 1. Replace imports
code = code.replace(/import CreatorBadge from "@\/components\/CreatorBadge";\n/, '');
code = code.replace(/import AdCarousel, { HERO_SLIDES, SIDEBAR_SLIDES, FEED_SLIDES } from "@\/components\/AdCarousel";/, 'import AdCarousel, { FEED_SLIDES } from "@/components/AdCarousel";\nimport TrendingHeroCarousel from "@/components/TrendingHeroCarousel";\nimport LeftLeagueSidebar from "@/components/LeftLeagueSidebar";\nimport RightStatsSidebar from "@/components/RightStatsSidebar";\nimport SportIcon from "@/components/SportIcon";');

// 2. Remove predictions and threads states
code = code.replace(/  const \[predictions, setPredictions\].*\n/, '');
code = code.replace(/  const \[threads, setThreads\].*\n/, '');

// 3. Remove their fetching
code = code.replace(/    communityApi\.getPredictions\(\)[\s\S]*?catch\(\(\) => setPredictions\(\[\]\)\);\n\n/, '');
code = code.replace(/    communityApi\.getThreads\(\)[\s\S]*?catch\(\(\) => setThreads\(\[\]\)\);\n\n/, '');

// 4. Remove heroSlides, hotCodes, etc.
code = code.replace(/  const featuredPredictions = [\s\S]*?}, \[featuredPredictions\]\);\n\n/, '');
code = code.replace(/  const hotCodes   = predictions\.filter[\s\S]*?const lostPredictions = predictions\.filter.*?\n/, '');

// 5. Replace Hero Carousel call
code = code.replace(/<AdCarousel slides={heroSlides} variant="hero" autoplayMs={6000} \/>/, '<TrendingHeroCarousel />');

// 6. Replace Left Sidebar
code = code.replace(/<aside className="hidden lg:flex flex-col w-\[220px\] xl:w-\[240px\] shrink-0 gap-3 lg:sticky lg:top-20 lg:self-start lg:max-h-\[calc\(100vh-5rem\)\] lg:overflow-y-auto no-scrollbar">[\s\S]*?<\/aside>/, '<LeftLeagueSidebar \n          currentLeagueId={selectedLeague} \n          activeSportOverride={activeSport} \n          onSportChange={handleSportChange} \n          onLeagueSelect={setSelectedLeague} \n        />');

// 7. Replace Right Sidebar
code = code.replace(/<aside className="hidden xl:flex flex-col w-\[260px\] 2xl:w-\[280px\] shrink-0 gap-3 lg:sticky lg:top-20 lg:self-start lg:max-h-\[calc\(100vh-5rem\)\] lg:overflow-y-auto no-scrollbar">[\s\S]*?<\/aside>/, '<RightStatsSidebar />');

// 8. Remove SUB-COMPONENTS section
code = code.replace(/\/\/ ─── SUB-COMPONENTS ────────────────────────────────────────────────────────────[\s\S]*$/, '');

// 9. Remove SportIcon inline component if it exists
code = code.replace(/\/\/ ─── SPORT ICON ────────────────────────────────────────────────────────────────[\s\S]*?function SportIcon[\s\S]*?return <TrophyIcon className={className} \/>;\n}\n/, '');


fs.writeFileSync('frontend/src/app/(site)/page.tsx', code);
console.log("Patched page.tsx successfully");
