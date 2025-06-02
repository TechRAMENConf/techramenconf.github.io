# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Development
npm run dev        # Start development server (default: http://localhost:4321)
npm run start      # Alternative development command

# Build
npm run build      # Run type checking + build static site
npm run preview    # Preview production build locally

# Direct Astro CLI access
npm run astro      # Access Astro CLI commands
```

## Project Architecture

This is the TechRAMEN Conference website built with Astro, a static site generator. The site uses a unique industrial control panel design theme with LED indicators and warm off-white color scheme.

### Technology Stack
- **Astro** (v5.4.1) - Static site generator with `.astro` components
- **TypeScript** - Type safety with path alias `@/*` → `src/*`
- **Tailwind CSS** - Utility-first CSS with custom industrial theme
- **Preact** - For interactive components when needed

### Key Directories
- `src/components/` - Reusable Astro components
  - `global/` - Site-wide components (Navigation, Footer, etc.)
  - `landing/` - Landing page section components
  - `data/` - JSON data files for sponsors
- `src/pages/` - File-based routing (index.astro, Speakers/*.md)
- `src/layouts/` - Page layouts (BaseLayout, Speaker)
- `public/` - Static assets served directly

### Design System
The site uses a custom industrial/control panel aesthetic:
- Primary color: Green LED (#00CC66)
- Secondary color: Blue LED (#0099CC)
- Accent color: Yellow LED (#CC9900)
- Danger color: Red LED (#CC3333)
- Background: Warm off-white tones (#FFF8E5, #FFFAF0)
- Custom Japanese font: KikaiChokokuJIS

### Data Management
- Speaker profiles: Markdown files in `src/pages/Speakers/`
- Sponsor data: JSON files in `src/components/data/`
- No database - all content is file-based

### Important Context
- Conference location: Asahikawa, Hokkaido, Japan
- 2025 conference is being planned (2024 was July 26-27)
- Concept: "A roundtable conference for tech enthusiasts, generously sharing technical knowledge in the Kamikawa region"
- Site deployed to GitHub Pages (techramenconf.net)

### Development Notes
- Always maintain the industrial control panel design theme
- Ensure Japanese/English bilingual support where appropriate
- Follow Astro's component-based architecture
- Use TypeScript path alias `@/` for imports from `src/`
- LED animations are defined in `src/styles/global.css`