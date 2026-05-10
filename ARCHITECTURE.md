# Skinny Baker AI Studio — Architecture & Build Plan

> A luxury AI-powered 3D cake configurator. Prompt → structured design data → procedural 3D render → custom order.

---

## 1 · Recommended Final Stack

### Frontend
| Layer | Pick | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | RSC, edge runtime, built-in ISR/streaming, deploys to Vercel in one click |
| Language | **TypeScript** | Non-negotiable — your AI returns JSON; you need strict types |
| Styling | **Tailwind CSS + CSS variables** | Custom design tokens for the luxury palette |
| Components | **Radix UI + shadcn/ui** (composed, not installed wholesale) | Accessible primitives, no opinionated styling |
| Motion | **Framer Motion** for UI, **GSAP + ScrollTrigger** for scenes | FM for state-driven, GSAP for cinematic timelines |
| 3D | **react-three-fiber + drei + postprocessing** | The de-facto WebGL stack; drei gives Environment/HDRI for free |
| State | **Zustand** (cake config) + **TanStack Query** (server state) | Avoid Redux — overkill |
| Forms | **react-hook-form + zod** | Same zod schemas validate AI JSON server-side |
| Auth UI | **Supabase Auth UI** or roll your own with `@supabase/auth-helpers` | |

### Backend
| Layer | Pick | Why |
|---|---|---|
| BaaS | **Supabase** | Postgres + Auth + Storage + Realtime + Edge Functions in one. Beats Firebase for this use case (relational queries on designs/orders) |
| Edge fns | **Supabase Edge Functions (Deno)** for AI proxy | Keeps API keys server-side, low cold-start |
| AI gateway | **Vercel AI SDK** | Unified interface across Gemini/OpenAI/Anthropic |
| Image gen | **Gemini 2.5 Flash Image** primary, **fal.ai FLUX** fallback | Gemini is best-in-class for product visualization, fal is faster/cheaper for variations |
| 3D gen (v2) | **Meshy.ai** or **Tripo** | Text-to-3D-mesh for novel decorations |
| Payments | **Stripe** + **Stripe Tax** | Cebu City you'll need GCash too — use Stripe's local payment methods or wrap with PayMongo for PH |
| Email | **Resend** + **React Email** | Beautiful order confirmations |
| Analytics | **Vercel Analytics + PostHog** | Feature flags + funnel tracking |
| Monitoring | **Sentry** | Errors in 3D scenes are subtle, you need traces |

### Hosting
- **Vercel** for the Next.js app (best Next integration, edge network, image optimization)
- **Cloudflare R2** for 3D assets (S3-compatible, no egress fees — critical for GLB delivery)
- **Supabase** managed Postgres + Storage for user-uploaded references
- Marketing site stays on Netlify (no migration needed)

### Repo structure
**Turborepo monorepo** with `apps/studio` (configurator), `apps/web` (marketing redirect to current Netlify), `packages/cake-engine` (the procedural generator, can be reused in admin tools), `packages/ui`, `packages/db`.

---

## 2 · Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Next.js)                           │
│                                                                    │
│  ┌──────────────┐   ┌─────────────────┐   ┌──────────────────┐     │
│  │  Marketing   │   │  AI Studio      │   │  Account / Order │     │
│  │  (RSC, fast) │   │  (R3F canvas)   │   │  (server forms)  │     │
│  └──────────────┘   └─────────────────┘   └──────────────────┘     │
│         │                    │                      │              │
│         └────────────────────┴──────────────────────┘              │
│                              │                                     │
│                  ┌──────────────────────┐                          │
│                  │  Zustand store       │  ←  cake-engine package  │
│                  │  (CakeConfig JSON)   │                          │
│                  └──────────────────────┘                          │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼────────┐   ┌─────────▼─────────┐   ┌────────▼────────────┐
│ Vercel Edge    │   │ Supabase Edge     │   │ R2 / Supabase       │
│ /api/render-   │   │ /functions/       │   │ Storage             │
│ snapshot       │   │   prompt-to-cake  │   │  - decorations.glb  │
│ (puppeteer-    │   │   place-order     │   │  - hdri/*.hdr       │
│  core, 3D ss)  │   │   webhook-stripe  │   │  - user-references  │
└────────────────┘   └─────────┬─────────┘   └─────────────────────┘
                               │
                  ┌────────────┴─────────────┐
                  │                          │
        ┌─────────▼─────────┐   ┌────────────▼──────────┐
        │  Gemini 2.5 Flash │   │  Postgres (Supabase)  │
        │  (text + image)   │   │   users, designs,     │
        │                   │   │   orders, catalog     │
        └───────────────────┘   └───────────────────────┘
```

### Request flow: Prompt to 3D Cake
1. User types prompt → client POSTs to `/api/prompt-to-cake`
2. Edge function calls **Gemini 2.5 Flash** with structured-output (JSON Schema mode) → returns validated `CakeConfig`
3. Client receives JSON, hydrates Zustand store
4. R3F canvas reactively rebuilds the scene from `CakeConfig`
5. User edits → store mutates → scene updates in real-time
6. On "Save", client POSTs config to `/api/designs` → Postgres row
7. On "Order", client POSTs to `/api/checkout` → Stripe → webhook updates `orders` table

---

## 3 · The Crucial Schema: `CakeConfig`

This is the single most important contract. Get this right and everything else flows.

```ts
// packages/cake-engine/src/schema.ts
import { z } from 'zod';

export const CakeColorSchema = z.object({
  name: z.string(),
  hex: z.string().regex(/^#[0-9a-f]{6}$/i),
  finish: z.enum(['matte', 'satin', 'metallic', 'glossy', 'pearl']),
});

export const CakeTierSchema = z.object({
  id: z.string().uuid(),
  shape: z.enum(['round', 'square', 'hexagonal', 'heart', 'oval']),
  diameter_mm: z.number().min(80).max(450),
  height_mm: z.number().min(60).max(300),
  frosting: z.object({
    style: z.enum(['fondant', 'buttercream', 'mirror_glaze', 'naked', 'chocolate_drip', 'whipped']),
    primaryColor: CakeColorSchema,
    secondaryColor: CakeColorSchema.optional(),
    pattern: z.enum(['smooth', 'textured', 'rosettes', 'ruffles', 'lambeth', 'sequin']).default('smooth'),
  }),
  border: z.object({
    style: z.enum(['none', 'pearls', 'rope', 'shell', 'lace']),
    color: CakeColorSchema.optional(),
  }).optional(),
});

export const DecorationSchema = z.object({
  id: z.string().uuid(),
  catalogKey: z.string(),                  // refs decorations_catalog.key
  position: z.object({                     // normalized 0-1 on cake surface
    tierIndex: z.number().int().min(0),
    angle: z.number().min(0).max(360),     // around tier
    height: z.number().min(0).max(1),      // 0=bottom, 1=top
  }),
  scale: z.number().min(0.1).max(3).default(1),
  rotation: z.number().min(0).max(360).default(0),
  material: z.enum(['default', 'gold', 'silver', 'rose_gold', 'edible_image']).default('default'),
  // For edible_image decorations, the actual texture
  imageUrl: z.string().url().optional(),
});

export const TopperSchema = z.object({
  type: z.enum(['number', 'text', 'figure', 'monogram', 'custom_3d']),
  content: z.string().optional(),          // for text/number
  catalogKey: z.string().optional(),       // for figures
  font: z.string().optional(),
  material: z.enum(['gold', 'silver', 'rose_gold', 'wood', 'acrylic_clear', 'acrylic_color']),
  height_mm: z.number().min(50).max(200).default(100),
});

export const CandleSchema = z.object({
  type: z.enum(['standard', 'sparkler', 'number', 'taper', 'fountain']),
  count: z.number().int().min(0).max(50),
  color: CakeColorSchema.optional(),
  flameAnimation: z.enum(['flicker', 'sparkle', 'fountain']).default('flicker'),
});

export const SceneSchema = z.object({
  background: z.enum(['studio_dark', 'studio_white', 'velvet', 'marble', 'gradient_warm', 'gradient_cool']),
  lighting: z.enum(['cinematic', 'soft_morning', 'spotlight', 'golden_hour', 'editorial']),
  particles: z.enum(['none', 'gold_dust', 'sparkles', 'petals', 'snow']).default('none'),
  cakeStand: z.enum(['gold_pedestal', 'marble', 'crystal', 'wood_round', 'mirror', 'none']).default('gold_pedestal'),
});

export const CakeConfigSchema = z.object({
  version: z.literal(1),
  meta: z.object({
    name: z.string().max(80),
    occasion: z.enum(['wedding', 'birthday', 'anniversary', 'corporate', 'baby_shower', 'graduation', 'general']),
    serves: z.number().int().min(2).max(500),
    theme: z.string().max(60).optional(),     // e.g. "pilot luxury"
    aiPrompt: z.string().max(1000).optional(),
  }),
  tiers: z.array(CakeTierSchema).min(1).max(7),
  decorations: z.array(DecorationSchema).max(80),
  topper: TopperSchema.optional(),
  candles: CandleSchema.optional(),
  scene: SceneSchema,
});

export type CakeConfig = z.infer<typeof CakeConfigSchema>;
```

This schema is the contract between the AI, the renderer, the database, and the bakery's order management. **Everyone speaks it.**

---

## 4 · AI Prompt-to-JSON Workflow

### The pipeline
```
User prompt
    ↓
[guardrails] check inappropriate content, length, language
    ↓
[Gemini 2.5 Flash with response_schema = CakeConfigSchema]
    ↓
[zod parse] reject if invalid → ask AI to fix
    ↓
[catalog reconciliation] map AI's decorations to actual catalog keys
    ↓
[business rules] enforce serving size matches tier diameters, etc.
    ↓
CakeConfig → client
```

### System prompt (kept in version-controlled file, not Supabase)
```
You are the design AI for Skinny Baker, a luxury Cebu City bakery.

Given a customer's natural-language prompt, output a JSON CakeConfig that
matches the schema EXACTLY. You will be given a catalog of available
decorations — you may ONLY reference catalog keys that exist.

Design principles:
- Luxury aesthetic, never cluttered. Max 12 decorations per tier.
- Tier counts: 1 for personal/intimate, 2-3 for typical celebrations,
  4+ only for weddings/corporate/grand events.
- Frosting style follows occasion: weddings→fondant, birthdays→buttercream
  unless prompt overrides.
- Color palettes: choose 2-3 hero colors, max 5 total.
- For pilot/aviation themes: navy, silver chrome, gold; airplane decorations.
- For floral themes: peonies, eucalyptus, blush; soft natural light.
- Always set scene.lighting to match mood (cinematic for dramatic,
  soft_morning for elegant, golden_hour for warm).

If the user requests something not in the catalog (e.g. "Pikachu"),
add it as a `edible_image` decoration with material='edible_image' and
generate a tasteful descriptive imageUrl placeholder.

Return ONLY the JSON. No commentary.
```

### Why Gemini Flash over Claude/OpenAI for this
- **Native JSON mode with schema enforcement** (`responseMimeType: "application/json"` + `responseSchema`)
- Cheap enough to call on every prompt
- Fast (sub-2s typical)
- Multimodal: when the user uploads a reference photo, the same call interprets the image AND produces structured config

### Two-tier model routing
- **Quick generations** → `gemini-2.5-flash` ($0.075/M input)
- **"Surprise me" / multi-prompt brainstorm** → `gemini-2.5-pro` for richer compositions
- **Polish/critique pass** (optional v2) → Claude Sonnet for taste/refinement on the JSON

---

## 5 · Procedural Cake Generation Strategy

### The component library approach

Build a **catalog of 3D primitives + decorations**:

```
packages/cake-engine/
├── primitives/
│   ├── TierMesh.tsx       // round/square/hex tier with frosting shader
│   ├── Pedestal.tsx       // marble/gold/crystal stand
│   └── CandleFlame.tsx    // particle-based flame
├── decorations/
│   ├── flowers/           // peony.glb, rose.glb, hydrangea.glb (10-15 variants)
│   ├── figures/           // airplane.glb, car.glb, animals/* (20-30 most popular)
│   ├── geometric/         // pearls, hearts, stars, gold leaf
│   ├── text/              // procedural text mesh from font + string
│   └── edible_image/      // textured disc for arbitrary uploaded images
├── materials/
│   ├── frosting.ts        // SubsurfaceScatteringMaterial for buttercream
│   ├── fondant.ts         // smooth PBR with subtle subsurface
│   ├── mirror_glaze.ts    // high-reflectance + clearcoat
│   ├── metals.ts          // gold/silver/rose-gold via PBR + envmap
│   └── candle_wax.ts      // translucent + emissive
├── scenes/
│   ├── studio_dark.tsx    // HDR environment + key/fill/rim lighting
│   ├── velvet.tsx
│   └── marble.tsx
└── compose.ts             // CakeConfig → R3F scene tree
```

### `compose.ts` — the heart of the engine

```ts
export function CakeFromConfig({ config }: { config: CakeConfig }) {
  return (
    <Scene preset={config.scene}>
      <Pedestal type={config.scene.cakeStand} />
      <group position={[0, 0, 0]}>
        {config.tiers.map((tier, i) => (
          <Tier
            key={tier.id}
            tier={tier}
            stackOffset={getStackOffset(config.tiers, i)}
          />
        ))}
        {config.decorations.map((d) => (
          <Decoration key={d.id} decoration={d} tiers={config.tiers} />
        ))}
        {config.topper && <Topper topper={config.topper} tiers={config.tiers} />}
        {config.candles && <CandleArray spec={config.candles} />}
      </group>
      <Particles type={config.scene.particles} />
      <PostProcessing />
    </Scene>
  );
}
```

### Catalog table (`decorations_catalog`)

```sql
CREATE TABLE decorations_catalog (
  key            TEXT PRIMARY KEY,           -- 'airplane_modern_001'
  display_name   TEXT NOT NULL,              -- 'Modern Jet'
  category       TEXT NOT NULL,              -- 'aviation' | 'floral' | 'figure'
  glb_url        TEXT NOT NULL,              -- R2 CDN URL
  thumbnail_url  TEXT NOT NULL,
  default_scale  REAL DEFAULT 1.0,
  bbox_mm        JSONB,                      -- {x,y,z} for layout
  premium        BOOLEAN DEFAULT false,      -- gates by tier
  search_terms   TEXT[],                     -- for AI matching
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

When the AI says `decorations: [{ catalogKey: "airplane_jet_modern" }]`, the engine looks it up, loads the GLB once, and instances it.

### Handling novel requests
If AI invents a key not in catalog, the reconciliation step:
1. Embeds the requested term, finds nearest by cosine similarity in catalog
2. If similarity < 0.7 → falls back to **edible image disc**: generates a flat image via Gemini Image, places it as a textured cylinder on the cake
3. If similarity ≥ 0.7 → maps to the closest existing key

This is how you handle infinite creativity without infinite asset library.

---

## 6 · React Three Fiber Architecture

### Canvas setup
```tsx
<Canvas
  shadows
  dpr={[1, 2]}                          // adaptive pixel ratio
  gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
  camera={{ position: [0, 0.4, 1.2], fov: 35 }}
>
  <Suspense fallback={<LoaderScene />}>
    <Environment preset="studio" background={false} />
    <ContactShadows opacity={0.6} blur={2.5} far={2} />
    <CakeFromConfig config={cakeConfig} />
    <OrbitControls
      makeDefault
      enablePan={false}
      minDistance={0.6}
      maxDistance={2.5}
      minPolarAngle={Math.PI / 4}
      maxPolarAngle={Math.PI / 2.1}
    />
    <EffectComposer>
      <Bloom intensity={0.6} luminanceThreshold={0.85} />
      <DepthOfField focusDistance={0.02} focalLength={0.05} bokehScale={2} />
      <Vignette offset={0.3} darkness={0.5} />
    </EffectComposer>
  </Suspense>
</Canvas>
```

### Quality tiers (auto-detected)
```ts
const quality = useDeviceQuality(); // 'mobile' | 'mid' | 'high'

// Drives:
// - dpr cap
// - shadow map size (512 / 1024 / 2048)
// - particles count
// - postprocessing on/off
// - HDRI resolution
```

### Asset loading
- **All GLBs preprocessed**: `gltf-pipeline` → Draco compression, KTX2 textures
- **Lazy-loaded**: only the decorations actually in current `CakeConfig` are fetched
- **CDN-cached**: R2 + immutable filenames (`airplane_jet_modern.v2.glb`)
- **`useGLTF.preload(...)` for top 20 most-used decorations on hover-intent**

### Materials worth getting right
The "luxury" feel lives in materials. Don't skimp:
- **Fondant**: PBR with `subsurface: 0.3`, `clearcoat: 0.1`, anisotropic noise normal map
- **Buttercream**: `MeshPhysicalMaterial` + procedural `displacementMap` for hand-piped texture
- **Gold leaf**: `metalness: 1`, `roughness: 0.15`, gold-color env map filter, slight `iridescence`
- **Mirror glaze**: `clearcoat: 1`, `reflectivity: 0.9`, animated normal map for "wet" look

---

## 7 · Database Schema

```sql
-- Users via Supabase Auth (auth.users)

CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  phone         TEXT,
  city          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE designs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  config        JSONB NOT NULL,             -- the validated CakeConfig
  thumbnail_url TEXT,                       -- R2 URL of rendered snapshot
  is_public     BOOLEAN DEFAULT false,
  share_slug    TEXT UNIQUE,                -- for /share/abc123
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX designs_user_idx ON designs(user_id);
CREATE INDEX designs_share_idx ON designs(share_slug) WHERE share_slug IS NOT NULL;

CREATE TABLE design_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id     UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  config        JSONB NOT NULL,
  prompt        TEXT,                        -- if AI-generated
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE decorations_catalog (
  key            TEXT PRIMARY KEY,
  display_name   TEXT NOT NULL,
  category       TEXT NOT NULL,
  glb_url        TEXT NOT NULL,
  thumbnail_url  TEXT NOT NULL,
  default_scale  REAL DEFAULT 1.0,
  bbox_mm        JSONB,
  premium        BOOLEAN DEFAULT false,
  search_terms   TEXT[],
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id),
  design_id      UUID NOT NULL REFERENCES designs(id),
  config_snapshot JSONB NOT NULL,            -- frozen at order time
  thumbnail_url  TEXT,
  pickup_or_deliver TEXT NOT NULL CHECK (pickup_or_deliver IN ('pickup','deliver')),
  delivery_address JSONB,
  scheduled_for  TIMESTAMPTZ NOT NULL,
  serves         INT NOT NULL,
  total_amount   INT NOT NULL,               -- centavos
  currency       TEXT DEFAULT 'PHP',
  status         TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','paid','in_production','ready','delivered','cancelled')),
  stripe_session_id TEXT,
  customer_notes TEXT,
  bakery_notes   TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX orders_user_idx ON orders(user_id);
CREATE INDEX orders_status_idx ON orders(status);
CREATE INDEX orders_scheduled_idx ON orders(scheduled_for);

CREATE TABLE ai_generations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id),
  prompt          TEXT NOT NULL,
  prompt_hash     TEXT NOT NULL,             -- for dedup caching
  config_result   JSONB,
  model           TEXT,
  cost_usd_cents  INT,
  duration_ms     INT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ai_gen_hash_idx ON ai_generations(prompt_hash);
```

### Row-Level Security (essential)
```sql
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own designs" ON designs
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "public designs are visible" ON designs
  FOR SELECT USING (is_public = true);
```

---

## 8 · Folder Structure (apps/studio)

```
apps/studio/
├── app/
│   ├── (marketing)/
│   │   └── page.tsx                    # Landing
│   ├── (studio)/
│   │   ├── layout.tsx                  # Studio shell with persistent canvas
│   │   ├── new/page.tsx                # Empty studio, prompt input
│   │   ├── design/[id]/page.tsx        # Edit design
│   │   └── share/[slug]/page.tsx       # Public view-only
│   ├── (account)/
│   │   ├── designs/page.tsx
│   │   ├── orders/page.tsx
│   │   └── settings/page.tsx
│   ├── (admin)/                        # Bakery dashboard
│   │   ├── orders/page.tsx
│   │   ├── catalog/page.tsx
│   │   └── analytics/page.tsx
│   ├── api/
│   │   ├── prompt-to-cake/route.ts     # POST → AI gen
│   │   ├── designs/[id]/snapshot/route.ts  # POST → render PNG
│   │   ├── checkout/route.ts           # POST → Stripe session
│   │   └── webhooks/stripe/route.ts
│   └── layout.tsx
├── components/
│   ├── studio/
│   │   ├── CakeCanvas.tsx              # The R3F <Canvas>
│   │   ├── PromptComposer.tsx
│   │   ├── ControlPanel/
│   │   │   ├── TiersTab.tsx
│   │   │   ├── DecorationsTab.tsx
│   │   │   ├── ColorTab.tsx
│   │   │   └── SceneTab.tsx
│   │   └── Toolbar.tsx
│   ├── ui/                             # shadcn primitives
│   └── marketing/
├── stores/
│   ├── cake-store.ts                   # Zustand: CakeConfig + history
│   └── ui-store.ts                     # panels open/closed, etc.
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts                    # generated by supabase gen types
│   ├── ai/
│   │   ├── gemini.ts
│   │   ├── prompt-templates.ts
│   │   └── reconcile-catalog.ts
│   ├── stripe.ts
│   └── analytics.ts
├── styles/
│   ├── globals.css
│   └── tokens.css                      # design system variables
└── public/
    └── posters/                        # SSR fallbacks for cake configs

packages/cake-engine/
├── src/
│   ├── schema.ts                       # zod CakeConfig
│   ├── compose.tsx                     # config → scene tree
│   ├── primitives/
│   ├── decorations/
│   ├── materials/
│   ├── scenes/
│   └── index.ts
├── tests/
└── package.json

packages/db/
├── migrations/
├── seed/
└── types.ts                            # supabase generated
```

---

## 9 · State Management

```ts
// stores/cake-store.ts
import { create } from 'zustand';
import { temporal } from 'zundo';                 // undo/redo
import { CakeConfig, CakeConfigSchema } from '@skinny/cake-engine';

interface CakeState {
  config: CakeConfig | null;
  isDirty: boolean;
  designId: string | null;            // server-side ID after save
  setConfig: (c: CakeConfig) => void;
  patchConfig: (patch: Partial<CakeConfig>) => void;
  addDecoration: (d: Decoration) => void;
  removeDecoration: (id: string) => void;
  reset: () => void;
}

export const useCakeStore = create(
  temporal<CakeState>((set, get) => ({
    config: null,
    isDirty: false,
    designId: null,
    setConfig: (config) => {
      const parsed = CakeConfigSchema.safeParse(config);
      if (!parsed.success) return console.error(parsed.error);
      set({ config: parsed.data, isDirty: true });
    },
    patchConfig: (patch) =>
      set((s) => s.config ? { config: { ...s.config, ...patch }, isDirty: true } : s),
    // ...
  }))
);

// Undo: useCakeStore.temporal.getState().undo()
```

`temporal` from `zundo` gives free undo/redo of every cake edit — table stakes for a configurator.

---

## 10 · UI/UX Direction (specifics, not vibes)

### Visual language
- **Palette**: Pure black `#0a0708` base, deep oxblood `#1a0a08` accents, **single hero color** rotated by occasion: gold `#c9a84c` (default), sapphire `#1a3a5c`, rose `#d4868c`. Never more than 3 colors on screen.
- **Typography pairing**:
  - Display: **Cormorant Garamond** (already in your site) at 300 weight, italic for accents
  - UI: **Inter** at 400/500/600 (NOT Libre Franklin — Inter has the modern crispness for SaaS UI)
  - Mono: **JetBrains Mono** for small caps labels and numerics
- **Grid**: 12 column at desktop, 4 at mobile. Generous gutters (24-32px).

### Page chrome
- **Glass nav** that becomes solid on scroll (16px backdrop blur, 0.7 alpha)
- **Cinematic scroll** on landing using GSAP ScrollTrigger pinning the canvas while content reveals
- **Persistent canvas pattern**: the 3D cake never unmounts when navigating between studio tabs (huge perf win, feels native)

### The studio screen layout
```
┌──────────────────────────────────────────────────────────────────┐
│ Logo                  prompt: "luxury wedding..."        [Save]  │
├──────────────────────┬───────────────────────────────────────────┤
│                      │                                           │
│   3D CANVAS          │  ┌─Tiers──────────────────────────────┐  │
│   (cake floats,      │  │ [+ tier]  [round ▾] 200mm × 120mm  │  │
│    rotates,          │  │                                    │  │
│    cinematic)        │  ├─Decorations────────────────────────┤  │
│                      │  │ Drag from catalog → onto cake     │  │
│   ⬡ orbit hint       │  │ [airplane ✈] [pearls] [+ more]    │  │
│                      │  ├─Colors ────────────────────────────┤  │
│   ⌘Z undo            │  │ ●●● gold + navy + chrome           │  │
│                      │  ├─Scene──────────────────────────────┤  │
│                      │  │ Lighting: cinematic ▾  Particles ▾│  │
│                      │  └────────────────────────────────────┘  │
│                      │                                           │
│                      │       [Order this design — ₱8,500]       │
└──────────────────────┴───────────────────────────────────────────┘
```

### Micro-interactions to nail
- Cursor becomes a subtle gold dot near interactive 3D elements (visual feedback that you can drag)
- Color picker is a curated palette of 24 luxury-grade hexes, NOT a free-form picker
- "Surprise me" button rotates between 6 hand-curated AI presets so you always have a great-looking demo
- When AI generates, the canvas fades to gold-tinted black with morphing rings, NOT a generic spinner
- Order CTA is a **magnetic button** that follows the cursor within 80px (Framer Motion `useMotionValue`)

### Mobile is a different product
On phones, you don't try to cram the full studio. You build a **stack-of-cards** flow:
1. "Describe your cake" full-screen with big AI textarea
2. Cake renders full-screen, swipe up for controls in bottom sheet
3. Bottom sheet has tabs: Tiers / Decor / Color / Scene
4. Tap-to-edit any element, no drag-and-drop on mobile

---

## 11 · Performance Engineering

### Loading
- **Critical path**: HTML + nav + cake placeholder image render in < 1s. R3F canvas hydrates client-side after.
- **Streaming**: RSC streams the studio shell while client downloads R3F bundle (~250KB gzipped)
- **Asset preload**: when AI returns config, prefetch all decoration GLBs in parallel before fading out the loading state

### Runtime
- **`<Detailed />` from drei** for LOD: low-poly model when zoomed out, hi-poly when close
- **Instanced meshes** for repeated decorations (e.g., 24 pearls = 1 draw call, not 24)
- **Adaptive `dpr`**: drops to 1 when FPS dips below 45 via `useFrame`
- **Disable post-processing on mobile** (Bloom/DoF cost 30% of frame budget on iPhone 12)
- **Suspend rendering** when canvas not visible (`useVisible` + `frameloop="demand"`)

### Bundle
- Tree-shake three.js by importing from `three/src/...` not `three`
- Lazy-load admin and account routes (`next/dynamic` with `ssr: false`)
- Replace any heavy library you can: e.g., `dayjs` not `moment`

### Caching
- AI: hash `(prompt + system_version)` → cache CakeConfig for 30 days
- Snapshots: rendered preview PNG cached at edge with `Cache-Control: max-age=86400, immutable`
- Catalog: `revalidate: 3600` ISR

---

## 12 · Cost Optimization

| Cost center | Strategy |
|---|---|
| AI text-to-JSON | Cache by prompt hash; use Flash not Pro; max 2KB output |
| AI image gen | Only when user clicks "render snapshot"; cache renders by config hash |
| 3D model gen (Meshy) | Only for "I want X but it's not in catalog" path; admin reviews and adds to permanent catalog (one-time cost amortized) |
| Bandwidth | R2 for GLBs (no egress), Vercel Image for thumbnails |
| Compute | Edge functions for AI proxy (sub-50ms cold start), regular Node for Stripe webhooks |
| Postgres | JSONB for configs (no joins for render), partial indexes |

**Operating cost target: $0.05-0.15 per design generated.** Most users only generate 2-3 times before settling.

---

## 13 · Security Considerations

1. **API keys never client-side**. Edge functions or `/api/` routes only.
2. **RLS enabled on every table**. Default-deny; explicit policies.
3. **Stripe webhooks** verified with signing secret, idempotency keys.
4. **AI input sanitization**: Clamp prompt length to 1000 chars, run through OpenAI Moderation or Gemini safety before main call.
5. **Catalog reconciliation prevents prompt injection** into the GLB system — AI can't request arbitrary URLs.
6. **CSP headers**: strict, only allow your R2 domain for asset loading.
7. **Rate limiting** on `/api/prompt-to-cake` — 20 generations per user per day on free tier (Upstash Ratelimit).
8. **GDPR/PH Data Privacy Act**: Designs are user data; offer export + delete. Don't store reference photos longer than necessary.

---

## 14 · MVP Roadmap (12 weeks, realistic)

### Phase 1 — Foundation (weeks 1-3)
- Next.js + Supabase scaffolding, auth working
- Design tokens, design system, marketing landing
- `CakeConfig` schema finalized + validated end-to-end
- Stripe test mode, order schema, basic order form
- Skinny Baker brand integration (use existing photography)

**Done state:** Authenticated user can fill an order form. No 3D yet.

### Phase 2 — AI prompt + structured renderer (weeks 4-6)
- `/api/prompt-to-cake` with Gemini Flash + zod validation
- 2D card-based "preview" of cake config (NOT 3D yet) — rendered with images from catalog thumbnails composed in a stack
- Edit panel: change tiers/colors/decorations
- Save designs to DB

**Done state:** User types prompt → sees a tasteful 2D representation of what their cake will look like, can refine, save, and order.

### Phase 3 — 3D engine (weeks 7-9)
- `cake-engine` package with primitives (round/square tier, frosting shader, pedestal)
- 25 hand-curated decoration GLBs (top wedding/birthday objects)
- R3F canvas renders configs from Phase 2
- Camera controls, scene presets

**Done state:** Same flow now shows a real 3D cake. Mobile supports it but with reduced quality.

### Phase 4 — Polish & launch (weeks 10-12)
- Snapshot rendering for order emails
- Admin dashboard (orders queue, catalog management, daily ops)
- AR preview via `@google/model-viewer` (lightweight)
- Performance pass, Lighthouse > 90 on mobile
- Beta with 20 friends-and-family customers

**Done state:** Public soft launch. Not feature-complete, but emotionally complete.

### Phase 5+ (months 4-9, post-launch)
- Catalog expansion to 200+ decorations
- Voice prompt
- Collaborative editing (Supabase Realtime)
- Social sharing with OG images
- Loyalty / repeat customer features
- AI 3D model generation for novel decorations (Meshy integration)
- Multi-bakery support if you franchise / partner

---

## 15 · MVP vs Advanced Comparison

| Feature | MVP | V2 | V3+ |
|---|---|---|---|
| Prompt → JSON | ✓ Gemini Flash | ✓ + Pro for Surprise Me | ✓ + Claude critique pass |
| 3D engine | ✓ R3F, 25 decorations | ✓ 200 decorations + LOD | ✓ Generative materials |
| Reference photo | ❌ | ✓ Edible image disc | ✓ Full multimodal Gemini |
| AR preview | ❌ | ✓ model-viewer | ✓ Full WebXR |
| Voice prompt | ❌ | ❌ | ✓ Gemini Live |
| Collaborative | ❌ | ❌ | ✓ Realtime + presence |
| Mobile | ✓ Bottom-sheet UX | ✓ Touch gestures on canvas | ✓ Native app via Capacitor |
| Payment | ✓ Stripe | ✓ + GCash via PayMongo | ✓ Subscription cake-of-month |
| Admin | ✓ Order queue | ✓ Catalog editor | ✓ AI-assisted production notes |

---

## 16 · Technical Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| AI returns invalid JSON 5% of the time | High | Strict zod parse + auto-retry with error fed back into next prompt |
| 3D performance unacceptable on cheap Android | High | Aggressive quality tiers + 2D fallback for sub-quality devices |
| Catalog never big enough for novel prompts | Medium | Edible-image-disc fallback; user-uploadable for $5 surcharge |
| Gemini quota / cost spike | Medium | Cache aggressively, rate-limit per user, alarms in Supabase |
| Order confusion between AI render and real cake | High | Disclaimers in checkout AND order email; bakery confirms within 24h |
| Cebu region-specific (delivery zones, Sunday closure, holidays) | Medium | Order form has hard-coded blackout dates and zone restrictions |
| Bakery operations can't keep up with AI volume | High | Cap orders/day per bakery in DB; auto-disable AI generation if queue too long |

---

## 17 · Scaling Strategy

- **Compute**: Vercel handles auto-scale; Supabase scales to dedicated when you cross ~50K MAU
- **Storage**: R2 has effectively unlimited capacity; budget concern is total GLB count (each ~500KB)
- **Database**: Postgres handles millions of rows; once `designs` crosses 1M, partition by month
- **AI**: Move from pay-per-call to provisioned throughput on Gemini when monthly bill > $1500
- **Multi-region**: Edge functions are global; Postgres read replicas in SE Asia when latency matters
- **Multi-tenant** (multiple bakeries): add `bakery_id` to every table, use Supabase organizations pattern

---

## 18 · Best Hosting/Deployment

- **Production**: Vercel (Next.js) + Supabase (Postgres/Auth/Storage) + Cloudflare R2 (3D assets) + Stripe (payments) + Resend (email)
- **Preview environments**: Vercel preview URLs auto-spawn per PR with isolated Supabase branch (Supabase has preview branches)
- **CI/CD**: GitHub Actions runs `pnpm typecheck`, `pnpm test`, `pnpm build`, then Vercel deploys on merge to `main`
- **Domains**: `studio.skinny-baker.com` (configurator), `skinny-baker.com` (current marketing site stays)
- **Backups**: Supabase daily; R2 versioning enabled; Stripe data via webhooks mirrored to your DB

---

## 19 · Asset Pipeline

```
Modeler (Blender) / Asset purchase
    ↓
.glb (raw, ~5MB)
    ↓
[gltf-pipeline]  Draco compression
    ↓
[gltf-transform] KTX2 textures, dedup materials
    ↓
.glb (optimized, ~500KB)
    ↓
upload to R2 with versioned filename
    ↓
INSERT into decorations_catalog
    ↓
admin reviews in dashboard, marks `published`
```

This is one-time work. You either hire a 3D artist for 80-120 models ($3-8K), license a pack from Sketchfab/CGTrader, or use Meshy.ai bulk-generate + curate.

---

## 20 · How to Make This Visually Unforgettable

This is where it lives or dies:

1. **Hero scroll experience** — first thing visitors see: a cake floats, rotates, transforms through 4 themes (wedding → pilot → birthday → corporate) as they scroll. GSAP ScrollTrigger pinning the canvas. **This single moment sells the product.**

2. **The "AI thinking" moment** — when generating, you don't show a spinner. You show the cake assembling itself in 3D — tiers stack one by one, decorations fly in, candles ignite. Even though the AI returns config in 1.5s, you stretch the animation to 3.5s for theater. People share videos of this.

3. **One signature material** — develop a custom shader (e.g., "Skinny Baker Gold Leaf") that nobody else has. It becomes your signature. Same way Tesla has the falcon door open animation.

4. **Camera choreography** — never let the user manually orbit alone. After 5 seconds of inactivity, the camera does a slow 30° auto-orbit. Subtle, cinematic, alive.

5. **Sound design** — controversial but powerful. A subtle string-pluck on tier add, a soft metallic hit on decoration place, an ambient room tone. Off by default, with a tasteful "Sound: ON/OFF" toggle. Apple-grade.

6. **Curated loading content** — instead of generic loading text, show rotating quotes about cake history, baking tips, or the bakery's story. Loading becomes content.

7. **The save flow** — when user saves, the cake takes a snapshot, the canvas momentarily blurs, the design appears as a card in their gallery with a smooth flip animation. Feels like Polaroid.

8. **No stock-feeling photography**. Every image on the marketing site is either photographed by you or rendered by your engine. Consistency of medium is luxury.

---

## 21 · Bakery Ordering Workflow

```
Customer creates design
    ↓
Customer schedules pickup/delivery (must be ≥5 days out, your existing rule)
    ↓
Customer pays 50% via Stripe
    ↓
Webhook → orders.status = 'paid'
    ↓
Email to bakery: order summary + 3D snapshot + GLB-to-PDF spec sheet
    ↓
Bakery dashboard: drag order through Kanban (paid → in_production → ready)
    ↓
Push notification to customer: "Your cake is ready"
    ↓
Status → 'delivered', balance auto-charged via Stripe saved card OR cash on pickup
```

The **PDF spec sheet** is critical. The bakers don't want to look at a 3D cake on a screen while frosting. The system auto-generates a printable: front view, top view, color codes, decoration list with quantities, dimensions in mm. This is what the bakery actually uses.

---

## 22 · Admin Dashboard Architecture

A separate Next.js route group `(admin)` gated by `role = 'admin'` in profiles. Tools:

1. **Orders Kanban** — drag-drop status board, filter by date/status/bakery
2. **Catalog Manager** — upload GLB, set name/category, preview, publish
3. **AI Insights** — most-used prompts, conversion funnel, average revisions per design
4. **Customer view** — their designs, orders, lifetime value
5. **Production calendar** — daily view of cakes due, with PDFs ready to print
6. **Inventory** — alerts when a popular decoration's GLB hasn't been used (might be broken), or when a curated theme is trending

Built with the same shadcn components as the studio. Maintains design language consistency.

---

## 23 · SEO Strategy

- **Marketing pages** are RSC, statically generated, perfect Lighthouse
- **Public design URLs** (`/share/{slug}`) generate OG images server-side via Vercel OG with the cake snapshot
- **Schema.org Product markup** on each design with image, price range, name
- **Cebu-local SEO**: location pages (`/bakery/cebu-city`), Google Business Profile integration, local reviews
- **Content marketing**: blog at `/journal` with cake design guides, occasion ideas, customer stories — drives top-of-funnel
- **Pinterest is your highest-ROI channel** for cake businesses; auto-pin every public design with rich descriptions

---

## 24 · AI Design Assistant Workflow (V2)

After v1 ships, layer on a conversational assistant:

```
User: "I want it more elegant but keep the airplanes"
    ↓
[Gemini Pro with current CakeConfig + diff instruction]
    ↓
Returns CakeConfig with reasoning trace:
  "Reduced decoration count from 14 to 6, swapped buttercream for fondant,
   removed runway lights, kept 2 airplane figurines in gold metallic."
    ↓
Frontend animates the diff: removed decorations fade out, color shifts
```

This makes the studio feel **alive** — you converse with it, you don't just operate it.

---

## 25 · The 90-Day Build Order (concrete, actionable)

| Week | Deliverable |
|---|---|
| 1 | Repo scaffolded, Supabase project, Stripe test, Vercel deploys |
| 2 | Design tokens, marketing landing page, `CakeConfig` schema locked |
| 3 | Auth flow, profile, order placeholder form |
| 4 | `/api/prompt-to-cake` working end-to-end with Gemini |
| 5 | 2D card preview of CakeConfig — looks great even without 3D |
| 6 | Save designs, gallery view, basic edit panel |
| 7 | `cake-engine` package init, R3F canvas, round tier primitive |
| 8 | Frosting shader, pedestal, 5 decorations (peony, pearls, gold leaf, airplane, candle) |
| 9 | All 25 catalog decorations integrated, scene presets |
| 10 | Snapshot render to PNG, order email with image, Stripe live |
| 11 | Mobile bottom-sheet UX, performance pass, accessibility audit |
| 12 | Soft launch, monitoring, 20 beta customers |

---

## 26 · Final Opinions

- **Don't build a cake configurator. Build a cake DESIGN STUDIO.** The framing matters; everything from copy to UX should reinforce that the customer is a designer collaborating with a bakery, not a buyer picking options.
- **Ship the 2D version of the studio first.** R3F is a 3-week investment you can validate the entire product without. Don't gate launch on 3D being perfect.
- **Hire one freelance 3D artist for the catalog.** Don't try to model 100 decorations yourself. Budget $4K, deliver in 6 weeks.
- **The AI is a feature, not the product.** The product is great cakes ordered easily. The AI removes friction in describing your dream. Don't over-index on "AI" branding — luxury customers are over it.
- **Cebu first, world later.** Your unfair advantage is local: same-day delivery, Filipino occasions (debut, fiesta), GCash. Build for it.

---

*Document version 1.0 — start here, refine quarterly.*
