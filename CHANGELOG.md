# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- **Badge Contrast & Pop-Art Refinements:**
  - Fixed color contrast readability issues in the `Badge.tsx` component. The `accent` (Image/Category) tag now uses pure black text with a bold weight on the gold background, complete with a neo-brutalist dark shadow.
  - Applied the same high-contrast, thick-border shadow treatment to all badge variants (neutral, success, warning).
- **Responsive Corner Artworks Refined:**
  - Regenerated corner artworks to feature relevant, project-specific AI graphic elements (Stylized Magnifying Glass, Neural Nodes, Retro Terminal) instead of random full scenes.
  - Pinned the illustrations *adjacent to the core content blocks* (`FeaturedTools`, `CategoryGrid`, `WorkflowShowcase`) in `app/page.tsx` instead of floating in viewport corners. They flank the content beautifully on wide screens like physical card stickers, wrapped in matching pop-art card frames and drop shadows with labels.
  - Removed all floating/hover scale animations and translucency, locked them in static positions, and secured them with `pointer-events-none` and a background `z-0` index to prevent any UI obstruction.
  - Maintained full responsiveness by hiding them on smaller screens (`hidden xl:block`).
- **Section Styling & Wavy Dividers:**
  - Separated the homepage into beautifully colored, distinct sections (Pink for Hero, Yellow for Trending, Cream for Categories, Blue for Workflows) using our pop-art design tokens.
  - Implemented a custom `WaveDivider` SVG component with a thick, neo-brutalist black border to transition between the colored sections playfully.
  - Wrapped the main Hero artwork in the matching thick-bordered card design for consistency.
- **Vertical Trending Layout:**
  - Fixed UI cutoff and obstruction issues by migrating the `FeaturedTools` container from a horizontal scrolling row to a structured, fully-responsive vertical CSS grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`).
- **Browse Page Styling:**
  - Applied a lovely full-screen `bg-accent-blue` theme to the `/tools` browse page to maintain the vibrant aesthetic across the site.
- **Bug Fixes:**
  - Fixed an issue where the "Open source" badge was appearing twice on tool cards that had both `pricing="OPEN_SOURCE"` and `isOpenSource=true`.

- **Total Aesthetic Pivot (Pop-Art Isometric):**
  - Updated `AGENTS.md` and `tailwind.config.ts` to replace the dark minimal theme with a vibrant, playful, cream-based palette (`#FDFBF7`, `#2A4B3C`, pinks, and blues).
  - Replaced the `Inter` font with `Outfit` for a more rounded, friendly typography.
  - Redesigned the `Hero.tsx` layout to feature a neo-brutalist pop-art style with thick borders, bright shadow drops, bouncy Framer Motion spring physics, and an embedded isometric robot artwork (`hero-art.png`).
  - Redesigned `SearchBar.tsx` to include hard, thick shadows and bouncy hover states.
  - Updated `Header.tsx` to feature the new green/gold wavy Nori logo mark as an inline SVG.

