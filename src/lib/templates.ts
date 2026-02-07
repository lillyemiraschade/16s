export interface Template {
  id: string;
  name: string;
  description: string;
  industry: string;
  prompt: string;
  gradient: string; // Tailwind gradient classes for placeholder card
  tags: string[];
}

export const TEMPLATES: Template[] = [
  {
    id: "tokyo-ramen",
    name: "Tokyo Ramen Shop",
    description: "Moody editorial menu with dark theme and warm amber accents",
    industry: "restaurant",
    prompt:
      "A Tokyo ramen shop called Ichiban Ramen with a moody, editorial design. Dark charcoal background (#1a1a1a), warm amber accents (#d4a574), and Japanese typography influence. Include a hero section with a large atmospheric photo placeholder, a menu organized by ramen type (Tonkotsu, Shoyu, Miso, Tsukemen) with prices, an about section with the chef's story, location with hours, and a reservation CTA. Use vertical Japanese text accents decoratively. The vibe should feel like a high-end izakaya magazine spread.",
    gradient: "from-orange-600/30 to-red-900/30",
    tags: ["restaurant", "dark", "editorial", "japanese"],
  },
  {
    id: "architect-portfolio",
    name: "Architect Portfolio",
    description: "Brutalist design with raw concrete aesthetic and bold typography",
    industry: "portfolio",
    prompt:
      "A brutalist architect portfolio for Studio Forme. Raw concrete aesthetic — light gray (#e8e4e0) background with dark charcoal text. Bold condensed uppercase typography for headings. Asymmetric grid layout for the project gallery showing 6 architectural projects with image placeholders. Include a manifesto-style about section, a timeline of notable projects, team members, awards, and a minimal contact form. Use thick black borders, exposed grid lines, and intentionally rough spacing. No rounded corners anywhere.",
    gradient: "from-zinc-600/30 to-slate-900/30",
    tags: ["portfolio", "brutalist", "minimal"],
  },
  {
    id: "saas-landing",
    name: "SaaS Landing Page",
    description: "Modern gradient hero with feature grid and social proof",
    industry: "saas",
    prompt:
      "A SaaS landing page for Flowline, an AI-powered project management tool. Modern dark theme (#0f0f10 background) with a vibrant purple-to-blue gradient hero (#7c3aed to #2563eb). Include: hero with headline 'Ship faster with AI copilot', animated gradient orb background, feature grid (4 features with icons), pricing table (Free/Pro/Team tiers), testimonial carousel with 3 quotes from tech companies, integration logos row, FAQ accordion, and a final CTA section. Use Inter font, rounded corners, subtle glass-morphism cards with backdrop-blur.",
    gradient: "from-purple-600/30 to-blue-900/30",
    tags: ["saas", "dark", "modern", "gradient"],
  },
  {
    id: "fitness-studio",
    name: "Fitness Studio",
    description: "High-energy design with bold type and electric green accents",
    industry: "fitness",
    prompt:
      "A fitness studio website for FORGE Training. High-energy design with black background (#0a0a0a), electric green accents (#39ff14), and bold condensed uppercase typography. Hero section with a full-width image placeholder and the tagline 'FORGE YOUR STRENGTH'. Include class schedule (HIIT, Boxing, Yoga, CrossFit) displayed as a weekly grid, trainer profiles (4 trainers) with photo placeholders, membership plans (Drop-in/Monthly/Annual), a transformation stories section, and a trial class booking CTA. Use diagonal lines and geometric patterns as decorative elements.",
    gradient: "from-green-600/30 to-zinc-900/30",
    tags: ["fitness", "dark", "bold", "energetic"],
  },
  {
    id: "law-firm",
    name: "Law Firm",
    description: "Elegant and authoritative with navy and gold color palette",
    industry: "law",
    prompt:
      "A law firm website for Barrett & Associates. Elegant, authoritative design with deep navy (#0c1829) and warm gold (#c9a84c) color palette on white. Serif typography for headings (Georgia or similar), clean sans-serif for body. Include: hero with firm photo placeholder and 'Excellence in Legal Counsel' tagline, practice areas grid (Corporate Law, Litigation, Real Estate, Employment, Intellectual Property, Family Law) with icons, attorney profiles (6 partners) with professional photo placeholders, notable case results with statistics, client testimonials, and a consultation request form. The design should convey trust, tradition, and sophistication.",
    gradient: "from-blue-900/30 to-amber-900/20",
    tags: ["law", "elegant", "professional", "traditional"],
  },
  {
    id: "artisan-coffee",
    name: "Artisan Coffee Shop",
    description: "Warm earth tones with hand-crafted organic feel",
    industry: "cafe",
    prompt:
      "An artisan coffee shop website for Ember & Bloom. Warm earth-tone palette — cream background (#f5f0e8), espresso brown (#3c2415), terracotta accents (#c4653a). Organic, hand-crafted feel with slightly rounded shapes and warm textures. Include: hero with cozy shop interior photo placeholder, 'Our Beans' origin story section with a world map showing 4 sourcing regions, seasonal menu with coffee drinks and pastries with prices, brewing guide section (Pour Over, French Press, Espresso), the team section with 3 baristas, shop hours and location with an embedded map placeholder, and a coffee subscription CTA. Use subtle paper texture backgrounds.",
    gradient: "from-amber-700/30 to-orange-900/20",
    tags: ["cafe", "warm", "organic", "artisan"],
  },
  {
    id: "photographer-portfolio",
    name: "Photographer Portfolio",
    description: "Full-bleed imagery with minimal UI and cinematic feel",
    industry: "photography",
    prompt:
      "A photographer portfolio for Lena Morales, fine art and editorial photographer. Minimal, image-forward design with black (#000000) background and white text. Full-bleed hero image placeholder with just the photographer's name in thin uppercase tracking. Gallery section with a masonry grid of 12 photo placeholders in varying aspect ratios. Portfolio categories: Editorial, Portraits, Landscapes, Street. Include a minimal about page section with a small portrait and short bio, select client logos row (Vogue, NYT, Nike), and a contact section with just an email and Instagram link. The UI should practically disappear — let the images dominate. Use thin horizontal rules as dividers.",
    gradient: "from-zinc-800/40 to-zinc-950/40",
    tags: ["photography", "minimal", "dark", "cinematic"],
  },
  {
    id: "wedding-planner",
    name: "Wedding Planner",
    description: "Romantic elegance with soft blush tones and script typography",
    industry: "wedding",
    prompt:
      "A wedding planning website for Petal & Vow. Romantic, elegant design with soft blush (#f8ede3), sage green (#a3b899), and dusty rose (#c9a4a0) palette on white. Script typography for headings mixed with clean sans-serif for body. Include: hero with floral arch photo placeholder and 'Your Dream Wedding, Designed', services section (Full Planning, Day-Of Coordination, Floral Design, Venue Styling) with watercolor-style icon placeholders, a real weddings gallery with 6 photo placeholders in elegant frames, testimonials from 3 happy couples, a planning timeline infographic (12 months to wedding), and a contact form with date picker. Use subtle floral border accents and soft shadows.",
    gradient: "from-rose-400/20 to-pink-200/20",
    tags: ["wedding", "elegant", "romantic", "light"],
  },
  {
    id: "real-estate",
    name: "Real Estate Agency",
    description: "Sleek luxury design with property search and agent profiles",
    industry: "real-estate",
    prompt:
      "A real estate agency website for Crestview Properties. Sleek luxury design with black (#0d0d0d) and white, gold accents (#b8964e). Include: hero with a stunning property photo placeholder and search bar (location, price range, bedrooms), featured listings grid (6 properties) with image placeholders, price, beds/baths/sqft, a neighborhood guide section highlighting 4 areas with stats, agent profiles (4 agents) with photo placeholders and contact info, market statistics dashboard (avg price, days on market, listings), client success stories, and a property valuation CTA form. Use sharp lines, luxury typography, and subtle animations described in comments.",
    gradient: "from-zinc-700/30 to-amber-800/20",
    tags: ["real-estate", "luxury", "dark", "modern"],
  },
  {
    id: "medical-practice",
    name: "Medical Practice",
    description: "Clean and trustworthy with calming blue tones and clear hierarchy",
    industry: "medical",
    prompt:
      "A medical practice website for Clarity Health. Clean, trustworthy design with white background, calming blue (#2563eb) and soft teal (#0d9488) accents. Clear visual hierarchy with lots of whitespace. Include: hero with friendly doctor photo placeholder and 'Compassionate Care for Every Stage of Life', services grid (Primary Care, Pediatrics, Women's Health, Mental Health, Lab Services, Telehealth) with clean line icons, doctor profiles (5 physicians) with credentials and specialties, patient portal login CTA, insurance accepted section with carrier logos, testimonials carousel, location with hours table and map placeholder, and an appointment booking form. Prioritize accessibility — clear contrast, large click targets, and semantic structure.",
    gradient: "from-blue-500/20 to-teal-500/20",
    tags: ["medical", "clean", "professional", "light"],
  },
];

export const INDUSTRIES = [
  "all",
  "restaurant",
  "portfolio",
  "saas",
  "fitness",
  "law",
  "cafe",
  "photography",
  "wedding",
  "real-estate",
  "medical",
] as const;

export type Industry = (typeof INDUSTRIES)[number];
