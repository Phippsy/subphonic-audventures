# Visual Upgrade Plan — Subphonic Audventures

## Reference Target
Pixel art platformer with rich parallax backgrounds, textured terrain, animated characters, environmental storytelling, and a polished HUD. See `/ref/gamer.png`.

---

## What Would Be Needed in Real Life

In a professional game project, achieving this visual quality would require:

1. **Pixel artist** — a dedicated artist to hand-craft sprites (character sheets, tilesets, enemies, items, backgrounds) at a consistent pixel scale (e.g. 16×16 or 32×32 tiles)
2. **Sprite animation software** — Aseprite, Pyxel Edit, or Piskel for frame-by-frame character animation (idle, walk, jump, climb, hurt, death)
3. **Tileset/tilemap system** — platforms built from repeating tiles rather than flat rectangles, allowing texture variation (grass top, dirt middle, stone edge)
4. **Parallax background layers** — 4-6 separately scrolling layers painted as wide strips (sky, far mountains, mid trees, near foliage, ground details)
5. **Particle/VFX system** — for dust on landing, sparkle on sig collect, explosion on enemy death, ambient floating motes
6. **Sound design** — SFX and music to match the visual quality (not covered here)
7. **Asset pipeline** — spritesheet packer (TexturePacker), loading system, animation state machine

Since we're building this purely with Canvas 2D drawing (no external sprite assets), we'll approximate each of these with procedural pixel-art-style rendering. Each phase below delivers a playable game that looks progressively better.

---

## Phased Delivery Plan

### Phase 1: Sky, Parallax & Colour Palette ✦ foundation
**Goal:** Replace the flat dark background with a rich multi-layer parallax sky.
- Gradient sky (deep blue → warm horizon glow, tinting per chapter)
- Cloud layer (soft shapes scrolling at 10% camera speed)
- Mountain silhouettes (scrolling at 25%)
- Mid-ground tree/building shapes (scrolling at 50%)
- Each chapter has a distinct palette applied to these layers

**Playable after this step:** Yes — same gameplay, dramatically better atmosphere.

---

### Phase 2: Textured Platforms & Terrain
**Goal:** Replace flat grey rectangles with textured, tile-like platforms.
- Grass strip on top of ground platforms (2-3 shades, jagged pixel edge)
- Stone/earth body with subtle noise pattern
- Floating platforms get a distinct style (wood planks, moss)
- Moving platforms get mechanical/metallic detail
- Pit edges get crumbling rock texture
- Ladders get wood grain and shadow

**Playable after this step:** Yes — world looks solid and textured.

---

### Phase 3: Animated Player Character
**Goal:** Replace the static box with a recognisable, animated character.
- Sonia drawn with head, body, legs, hair (pixel proportions)
- Idle animation (subtle breathing/bobbing, 2 frames)
- Walk cycle (4 frames, legs and arms)
- Jump pose (arms up, legs tucked)
- Climb animation (alternating arms on ladder)
- Facing direction flip
- Dust particles on land/jump

**Playable after this step:** Yes — the player feels alive.

---

### Phase 4: Better Enemies & Collectibles
**Goal:** Replace coloured squares with recognisable pixel characters.
- Enemies drawn as robot/bot sprites (antenna, eyes, body segments)
- Walk animation for enemies (2-frame shuffle)
- Death animation (flash + particles)
- Sigs redesigned as glowing orbs with wave animation
- Collection sparkle effect
- Checkpoint drawn as a proper flag/beacon with activation animation

**Playable after this step:** Yes — the game world feels populated and alive.

---

### Phase 5: HUD & UI Overhaul
**Goal:** Replace plain text with a styled game HUD.
- Heart icons for lives (pixel hearts, lose = grey/empty)
- Sig counter with icon
- Score with retro font styling
- Zone banner with decorative border on chapter entry
- Semi-transparent HUD panel background
- Intro screen with proper title art styling
- Win screen with particle celebration

**Playable after this step:** Yes — feels polished and complete.

---

### Phase 6: Environmental Details & Polish
**Goal:** Add the final layer of atmosphere and detail.
- Grass tufts on ground edges (random placement, 2-3 varieties)
- Background trees/crystals/mushrooms as decoration
- Floating particles (dust motes, fireflies per chapter)
- Landing dust puffs
- Screen shake on death
- Smooth camera with slight look-ahead
- Vignette overlay for atmosphere

**Playable after this step:** Yes — as close to the reference as pure canvas can get.

---

## Beyond (if sprite assets are added later)

If a pixel artist produces real assets:
- Replace procedural drawing with spritesheet rendering
- Add proper tile-map with collision tiles
- Frame-perfect animation timing
- Sub-pixel smoothing for character motion
- Full particle system with pooling

---

## Current Status

Starting Phase 1 now. Each phase builds on the last — refresh the game after each to see progress.
