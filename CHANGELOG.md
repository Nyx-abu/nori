# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- **Badge Contrast & Pop-Art Refinements:**
  - Fixed color contrast readability issues in the `Badge.tsx` component. The `accent` (Image/Category) tag now uses pure black text with a bold weight on the gold background, complete with a neo-brutalist dark shadow.
  - Applied the same high-contrast, thick-border shadow treatment to all badge variants (neutral, success, warning).
- **Responsive Corner Artworks Refined:**
  - Regenerated corner artworks to feature relevant, project-specific AI graphic elements (Stylized Magnifying Glass, Neural Nodes, Retro Terminal) instead of random full scenes.
  - Locked the artwork positions in `app/layout.tsx` (removed all floating/hover scale animations and translucency) and securely placed them deeply behind the content (`z-[-10]`) to completely prevent any UI obstruction.
  - Decreased the sizes for a more subtle pop-art flair and maintained responsive hiding on smaller screens (`hidden xl:block`).

- **Total Aesthetic Pivot (Pop-Art Isometric):**
  - Updated `AGENTS.md` and `tailwind.config.ts` to replace the dark minimal theme with a vibrant, playful, cream-based palette (`#FDFBF7`, `#2A4B3C`, pinks, and blues).
  - Replaced the `Inter` font with `Outfit` for a more rounded, friendly typography.
  - Redesigned the `Hero.tsx` layout to feature a neo-brutalist pop-art style with thick borders, bright shadow drops, bouncy Framer Motion spring physics, and an embedded isometric robot artwork (`hero-art.png`).
  - Redesigned `SearchBar.tsx` to include hard, thick shadows and bouncy hover states.
  - Updated `Header.tsx` to feature the new green/gold wavy Nori logo mark as an inline SVG.
- **Hero Component Soulful Redesign (`components/home/Hero.tsx`):**
- **Hero Component (`components/home/Hero.tsx`):**
  - Updated typography for main heading (`text-4xl sm:text-5xl md:text-6xl` with `drop-shadow-sm` and tighter tracking) for a more premium impact.
  - Softened the background dot grid and intensified the indigo radial glow to create a deeper, more atmospheric spotlight effect.
  - Upgraded floating drift cards with `backdrop-blur-md` and semi-transparent backgrounds to achieve a true glassmorphic finish.
- **SearchBar Component (`components/search/SearchBar.tsx`):**
  - Redesigned the main input container with a `bg-surface/50` translucent background and `backdrop-blur-xl`.
  - Added a deep outer glow effect (`shadow-[0_0_40px_-10px_rgba(99,102,241,0.25)]`) on `focus-within`.
  - Polished the "Search" button with a subtle inner shadow, hover scale effect, and improved hover states.
