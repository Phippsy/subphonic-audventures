# Technical advisory: vibe-coding a retro browser platformer with VS Code Copilot in 2026

**Context assumed:** you want a simple, playable, browser-based retro platformer; you’ll primarily use **Microsoft VS Code + GitHub Copilot**; you want to move quickly without ending up with unmaintainable AI-generated spaghetti.

## Executive recommendation

For this project, I would use:

**Core stack**

| Area               | Recommendation                                | Why                                                                                               |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Language           | **TypeScript**                                | Gives Copilot stronger constraints, catches AI mistakes early, and keeps game objects manageable. |
| Bundler/dev server | **Vite**                                      | Fast local loop, simple static deployment, works well with browser games.                         |
| Game engine        | **Phaser 4** or **Excalibur.js**              | Phaser has the bigger ecosystem; Excalibur is TypeScript-first and friendlier for small games.    |
| Level design       | **Tiled** or hand-authored JSON for v1        | Tiled is useful once levels stop being trivial.                                                   |
| Art                | **Aseprite**, **Kenney**, itch.io CC0 assets  | Fast retro asset workflow without waiting on bespoke art.                                         |
| Testing            | **Vitest + Playwright**                       | Unit-test game logic; use browser tests/screenshot checks for regressions.                        |
| Deployment         | **GitHub Pages / Netlify / Cloudflare Pages** | Static browser game hosting is enough.                                                            |

My recommended starting point would be **TypeScript + Vite + Excalibur.js** for the first prototype. If you want the largest tutorial ecosystem and a more established platformer path, use **Phaser**, but pin the version and keep Copilot grounded in the current docs. Phaser 4 is current in 2026, with v4.1.0 "Salusa" released on 30 April 2026, and it is positioned as a Canvas/WebGL browser-game framework with a new GPU-driven renderer. ([phaser.io][1]) Excalibur is explicitly a friendly TypeScript engine for web games, which makes it particularly suitable for Copilot-assisted work because the API surface is typed and readable. ([excaliburjs.com][2])

The main advice: **do not ask Copilot to "make a platformer game" in one shot.** Treat Copilot like a fast junior game programmer. Give it small issues, require tests where possible, review every gameplay change manually, and keep the architecture boring.

---

# 1. What "vibe coding" should mean here

In 2026, AI coding tools are good enough to generate a playable prototype quickly, but they are still risky when asked to design an entire game architecture unaided. The right workflow is not "describe the whole game and accept the output." It is:

1. Define the smallest playable loop.
2. Break it into tiny vertical slices.
3. Let Copilot implement one slice at a time.
4. Run the game immediately.
5. Fix behaviour manually or with tightly scoped prompts.
6. Refactor continuously before adding more mechanics.

For a simple retro platformer, the first playable milestone should be:

> A character can move left/right, jump, land on solid tiles, die on hazards, collect one object, and reach an exit.

Do not start with menus, save games, procedural generation, enemy AI, particle systems, inventory, or mobile polish. Those can come later.

---

# 2. Engine choice

## Option A: Phaser 4

**Choose Phaser if you want:**

- the broadest JavaScript game-engine ecosystem;
- lots of examples, especially for tilemaps, sprites, Arcade Physics, cameras and input;
- easier migration to richer 2D effects later;
- a framework many AI tools have likely seen frequently.

Phaser 4 is a major modernisation of Phaser with a rebuilt rendering pipeline while keeping a broadly familiar public API, according to the Phaser release notes and package information. ([GitHub][3]) Phaser’s docs also cover Arcade Physics tilemap behaviour, which is central for a tile-based platformer. ([docs.phaser.io][4])

**Risk:** Phaser 4 is new enough that Copilot may mix Phaser 3 and Phaser 4 patterns. This is manageable, but you should pin the exact version and keep a short project instruction telling Copilot which version to use.

## Option B: Excalibur.js

**Choose Excalibur if you want:**

- a smaller, TypeScript-native engine;
- cleaner object-oriented game entities;
- a lower cognitive load for a first browser game;
- a codebase that Copilot can reason about from types.

Excalibur describes itself as a TypeScript game engine for the web, and its GitHub project describes its goal as making 2D HTML/JS games easier while handling engine boilerplate and cross-platform concerns. ([excaliburjs.com][2]) It also supports tilemaps and has a Tiled plugin for `.tmx`, `.tmj`, `.tsx`, and `.tsj` map files, which is useful once you start building levels visually. ([excaliburjs.com][5])

**Risk:** smaller ecosystem than Phaser. Copilot may have fewer examples in its latent memory, so you should rely on official docs, TypeScript types, and smaller prompts.

## My recommendation

For **fast vibe-coded retro platformer**, I would start with:

> **Excalibur.js + TypeScript + Vite**

Then switch to Phaser only if you specifically want the Phaser ecosystem, Phaser Editor, or a more conventional JS game-dev tutorial path.

---

# 3. Browser-game fundamentals to keep explicit

Even if you use an engine, keep these concepts clear in the project notes. They are common places where AI-generated game code becomes messy.

## Game loop

Browser games should update on the browser’s animation cadence. At the browser API level, `requestAnimationFrame()` asks the browser to call your animation callback before the next repaint, and its frequency generally matches the display refresh rate. ([MDN Web Docs][6]) Engines abstract this, but you should still avoid random `setInterval()` loops in gameplay code.

**Good practice:**

- one authoritative update loop;
- no gameplay mutations from scattered timers unless intentionally scheduled;
- deterministic-ish game state updates;
- separate input reading from physics/movement resolution.

## Collision

For a retro platformer, do **not** use pixel-perfect collision. Use rectangular hitboxes and tile collisions. MDN notes that 2D collision often uses simple generic shapes such as hitboxes because they are performant and visually good enough. ([MDN Web Docs][7])

**Good practice:**

- player collision box smaller than the sprite;
- separate horizontal and vertical collision resolution;
- explicit grounded/coyote-time/jump-buffer state;
- no physics magic buried inside sprite animation code.

## Tilemaps

Tilemaps are the standard technique for 2D worlds built from repeated small tiles, saving memory and avoiding large full-level images. ([MDN Web Docs][8]) Use a tilemap for platforms, hazards, collectibles, spawn points, and exits once the game grows beyond one test scene.

**Good practice:**

- one collision layer;
- one decoration/background layer;
- object layer for spawn points, hazards, coins, enemies and exits;
- tile size fixed early, probably **16x16** or **32x32**.

## Retro pixel rendering

Modern high-DPI screens blur pixel art unless you configure scaling carefully. MDN specifically covers using image-rendering techniques to preserve a crisp pixel-art look on high-definition displays. ([MDN Web Docs][9])

**Good practice:**

```css
canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

Also use integer scaling where possible. A good base resolution is something like **320x180**, **384x216**, or **480x270**, then scale up to fit the browser window.

## Audio

The Web Audio API is the browser’s powerful native system for audio sources, effects, visualisation, and spatial effects. ([MDN Web Docs][10]) For a small game, keep audio simple: jump, collect, hurt, checkpoint, win, and one looping background track.

**Good practice:**

- load short SFX as small files;
- provide mute and volume controls;
- start audio only after user interaction because browser autoplay rules can block sound;
- keep audio non-essential to gameplay.

## Controls

Keyboard first. Gamepad later. The browser Gamepad API exposes connected controllers through events and `navigator.getGamepads()`. ([MDN Web Docs][11])

**Good practice:**

- keyboard: arrows/WASD + space;
- gamepad: map A / Cross to jump;
- support remapping only after core gameplay is stable;
- always maintain keyboard fallback.

---

# 4. AI coding landscape: how to use Copilot well in 2026

GitHub Copilot in VS Code is now more than autocomplete. The current workflow includes custom instructions, prompt files, agent mode, MCP servers, CLI workflows, and cloud coding-agent workflows.

## Use repository custom instructions

VS Code supports custom instructions so Copilot responses follow project-specific coding practices and requirements. ([Visual Studio Code][12]) GitHub also documents repository custom instructions for VS Code. ([GitHub Docs][13])

Create:

```text
.github/copilot-instructions.md
```

Suggested contents:

```md
# Project instructions

This is a small retro browser platformer built with TypeScript, Vite, and Excalibur.js.

## Coding style

- Use TypeScript strict mode.
- Prefer small classes/functions over large files.
- Keep gameplay state explicit and readable.
- Do not introduce new dependencies without explaining why.
- Avoid React unless working on menus or surrounding UI.
- Do not use setInterval for the game loop.
- Do not create global mutable state except in the game bootstrap.

## Game design constraints

- Retro pixel-art feel.
- Fixed logical resolution.
- Keyboard-first controls.
- Simple tile-based levels.
- Player has left/right movement, jump, gravity, collision, collectibles, hazards, and level exit.

## Architecture

- src/main.ts: bootstraps the game.
- src/scenes/: game scenes.
- src/entities/: player, enemies, collectibles, hazards.
- src/systems/: input, physics helpers, level loading.
- src/assets/: images, audio, tilemaps.
- tests/: pure logic tests.

## AI behaviour

- Make small changes.
- Explain files changed.
- Run or suggest tests after changes.
- Ask before replacing architecture.
```

This is one of the highest-leverage things you can do. It turns Copilot from "generic JS assistant" into "assistant aware of this game’s rules."

## Use prompt files for repeatable tasks

VS Code and GitHub support reusable prompt files for common development tasks; GitHub notes prompt files are available in VS Code, Visual Studio and JetBrains IDEs, and are in public preview. ([Visual Studio Code][14])

Create prompts like:

```text
.github/prompts/add-platformer-mechanic.prompt.md
.github/prompts/refactor-game-code.prompt.md
.github/prompts/write-tests.prompt.md
.github/prompts/debug-gameplay-bug.prompt.md
```

Example prompt file:

```md
# Add a platformer mechanic

You are modifying a small TypeScript browser platformer.

Goal:
Implement the mechanic described by the user with the smallest safe change.

Rules:

- Preserve existing behaviour unless explicitly asked.
- Keep player movement readable.
- Avoid magic numbers; add named constants.
- Update or add tests for pure logic.
- Do not add dependencies.
- After coding, summarise changed files and manual test steps.

Mechanic:
${input:mechanic}
```

This is more reliable than repeatedly typing vague chat messages.

## Use Agent Mode, but constrain it

VS Code’s Copilot agent mode can plan, edit multiple files, and use tools; VS Code documentation also notes MCP support in agent mode. ([Visual Studio Code][15]) Use it for bounded tasks such as:

- "Add a collectible coin entity and update score UI."
- "Refactor player movement constants into a config object."
- "Add Playwright smoke test that loads the game and verifies canvas appears."
- "Add a second level using existing tilemap conventions."

Do **not** use agent mode for:

- "Build the whole game."
- "Make it more fun."
- "Rewrite the engine."
- "Add enemies, menus, levels, sound and deployment."

Those prompts are too open-ended and will often create architectural drift.

## Use MCP sparingly

VS Code supports adding MCP servers to give Copilot access to external tools and services. The docs describe MCP as an open standard for connecting AI models to external tools and services, with servers providing tools, resources, prompts, and interactive apps. ([Visual Studio Code][16]) GitHub also provides a GitHub MCP server for richer GitHub context. ([GitHub Docs][17])

For this project, useful MCP integrations might be:

- GitHub MCP for issues/PRs;
- Playwright MCP if you want the agent to inspect the running browser;
- filesystem/docs MCP if you maintain local engine docs.

Avoid connecting lots of MCP servers early. More tool access can increase nondeterminism and make it harder to know what the agent changed.

## Copilot CLI and coding agent

GitHub Copilot CLI became generally available for Copilot subscribers in February 2026 and is positioned as a terminal-native coding agent. ([The GitHub Blog][18]) The CLI docs describe commands such as `/init`, which can analyse a codebase and create or update `.github/copilot-instructions.md`. ([GitHub Docs][19])

A good pattern:

- use VS Code Copilot Chat for interactive design and edits;
- use Copilot CLI for terminal-based refactors or debugging;
- use cloud coding agent only for well-specified GitHub issues.

GitHub’s coding agent works in its own cloud development environment, makes changes, runs tests, and pushes changes back, according to GitHub’s changelog. ([The GitHub Blog][20]) Treat it like assigning a junior developer a narrow ticket. Also note that GitHub Copilot code review usage is changing: from 1 June 2026, Copilot code review runs consume GitHub Actions minutes, so avoid triggering reviews thoughtlessly on hobby repos with limited quotas. ([GitHub Docs][21])

---

# 5. Recommended development methodology

## Phase 0: one-page design brief

Before opening VS Code, write a tiny design brief:

```md
# Game brief

Working title: Neon Rooftop Runner

Genre: Retro 2D platformer
Target: Desktop browser first
Session length: 2-5 minutes
Resolution: 384x216 logical, scaled up
Controls: Left/right/jump
Core loop: move -> jump -> avoid hazards -> collect chips -> reach exit
Theme: cyberpunk rooftops
Win condition: reach exit after collecting enough chips
Lose condition: fall or touch hazard
```

This gives Copilot strong context. It also stops scope creep.

## Phase 1: playable greybox

Goal: ugly but playable.

Build:

- canvas/game boots;
- player rectangle;
- solid platforms;
- left/right movement;
- jump;
- gravity;
- camera optional;
- reset on falling.

No art yet. No sound. No menu.

Why: platformer feel is everything. If movement feels bad, pixel art will not save it.

## Phase 2: game objects

Add:

- coins/collectibles;
- hazards;
- exit;
- score;
- level restart.

Keep these as separate entity classes, not one giant scene file.

## Phase 3: tilemap level

Add:

- Tiled map or simple JSON level;
- collision layer;
- object layer;
- level loader.

If you use Excalibur, its Tiled plugin supports orthogonal and isometric maps and parses common Tiled file types. ([excaliburjs.com][22]) If you use Phaser, Phaser Editor’s tilemap support is built around Tiled JSON maps. ([docs.phaser.io][23])

## Phase 4: art pass

Use CC0/free assets first. Kenney’s support page says its asset-page game assets are public domain licensed CC0 and can be used even in commercial projects, with attribution not required. ([Kenney][24]) Aseprite is a dedicated animated sprite and pixel-art tool for videogame sprites, pixel art, and retro-style graphics. ([aseprite.org][25])

Good art pipeline:

```text
Aseprite .aseprite source
        ↓ export
PNG spritesheets + JSON metadata
        ↓ import
src/assets/sprites/
```

Keep source art files in the repo if the project is small.

## Phase 5: juice and feel

Add:

- coyote time;
- jump buffering;
- variable jump height;
- squash/stretch or simple animation;
- particles;
- screen shake;
- SFX.

This is where the game starts feeling good.

## Phase 6: deployment

Vite has official guidance for static deployment, including GitHub Pages setup with GitHub Actions and the need to set `base` correctly for repository pages. ([vitejs][26]) For a hobby browser game, GitHub Pages is enough; Netlify and Cloudflare Pages are also fine.

---

# 6. Architecture: keep it boring

Suggested repo structure:

```text
retro-platformer/
  .github/
    copilot-instructions.md
    prompts/
      add-platformer-mechanic.prompt.md
      debug-gameplay-bug.prompt.md
      refactor-game-code.prompt.md
  public/
  src/
    main.ts
    game/
      config.ts
      constants.ts
    scenes/
      BootScene.ts
      LevelScene.ts
      GameOverScene.ts
    entities/
      Player.ts
      Coin.ts
      Hazard.ts
      Exit.ts
    systems/
      InputController.ts
      LevelLoader.ts
      CameraSystem.ts
    assets/
      sprites/
      audio/
      maps/
    ui/
      Hud.ts
  tests/
    movement.test.ts
    level-loader.test.ts
  e2e/
    smoke.spec.ts
  package.json
  vite.config.ts
  tsconfig.json
```

Keep pure logic separate from engine calls where possible. For example, jump-buffer timing, score calculation, level parsing, and simple state machines can be unit-tested without loading the browser.

---

# 7. Testing strategy for an AI-coded browser game

You do not need enterprise-grade testing, but you do need guardrails.

## Unit tests

Use unit tests for:

- level JSON parsing;
- score rules;
- player state machine transitions;
- coyote time and jump buffer logic;
- collision helper functions if custom.

## Browser smoke tests

Use Playwright for:

- game loads;
- canvas exists;
- no console errors on boot;
- pressing keys changes visible state;
- restart button works.

Playwright supports visual comparisons via `toHaveScreenshot()` and snapshot updates, which can be useful for catching accidental rendering regressions. ([Playwright][27]) Do not overdo screenshot tests early, because small rendering differences can be noisy.

Example smoke-test prompt for Copilot:

```md
Add a Playwright smoke test that:

1. Starts the Vite dev server.
2. Opens the game.
3. Verifies the canvas is visible.
4. Fails on browser console errors.
5. Presses ArrowRight and Space.
6. Takes a screenshot named booted-game.png.
   Keep the test minimal.
```

## Manual feel testing

Some things cannot be meaningfully automated:

- jump feel;
- acceleration/deceleration;
- camera smoothness;
- whether a hazard feels unfair;
- whether level timing is fun.

For those, use a manual checklist after each session.

---

# 8. Prompting patterns that work well

## Good prompt: bounded and testable

```md
Add coyote time to the player jump.

Requirements:

- Player can still jump for 100ms after leaving a platform.
- Add a named constant COYOTE_TIME_MS.
- Keep existing jump controls.
- Add unit tests for the pure timing logic if possible.
- Do not change rendering or level loading.
- Summarise changed files.
```

## Bad prompt: too vague

```md
Make the movement feel better and add some polish.
```

## Good prompt: refactor with constraints

```md
Refactor LevelScene so it is easier to add new entity types.

Constraints:

- Do not change gameplay behaviour.
- Keep public method names stable unless necessary.
- Extract entity creation into small methods.
- Do not introduce a dependency injection framework.
- After refactor, list manual tests I should run.
```

## Good debugging prompt

```md
The player sometimes sticks to the side of a wall after jumping into it.

Please inspect Player.ts and LevelScene.ts.
Find the likely cause.
Suggest the smallest fix first.
Do not rewrite the movement system unless unavoidable.
```

---

# 9. Guardrails against AI-generated mess

## Pin versions

In `package.json`, avoid loose major versions while actively vibe-coding:

```json
{
  "dependencies": {
    "excalibur": "x.y.z"
  }
}
```

or:

```json
{
  "dependencies": {
    "phaser": "4.1.0"
  }
}
```

This reduces "works on my generated docs" problems.

## Keep files small

Once a file crosses ~300-400 lines, ask Copilot to propose a refactor before adding features.

## Reject architecture churn

AI agents often "improve" architecture by introducing managers, factories, registries, event buses, and abstractions too early. For a simple platformer, that is usually harmful.

Prefer:

```text
Player
Coin
Hazard
Exit
LevelScene
InputController
LevelLoader
```

Avoid early:

```text
EntityFactoryProvider
AbstractGameObjectManager
UniversalEventMediator
SceneLifecycleOrchestrator
```

## Use a changelog

Create:

```text
docs/devlog.md
```

After each session, ask Copilot:

```md
Update docs/devlog.md with:

- features added
- bugs fixed
- known issues
- next recommended task
```

This gives future Copilot sessions better context.

## Commit constantly

Use small commits:

```text
feat: add player movement
feat: add tile collision
feat: add coins and score
fix: prevent double jump after wall collision
refactor: extract level loader
```

If Copilot breaks things, revert quickly.

---

# 10. Asset and licensing practice

Use free/CC0 assets for prototypes, but track provenance immediately.

Create:

```text
ASSETS.md
```

Example:

```md
# Asset credits

## Player sprite

Source: Kenney Platformer Pack
License: CC0
Modified: recoloured in Aseprite

## Coin sound

Source: OpenGameArt item pickup sound
License: CC-BY 3.0
Attribution required: Yes
```

Kenney is the lowest-friction option because its game assets are CC0 according to its own support page. ([Kenney][24]) OpenGameArt is useful but contains assets under varied licences, so do not assume every asset is attribution-free. Its asset pages and CC0 collections need to be checked item by item. ([OpenGameArt.org][28])

---

# 11. Accessibility and UX basics

For a simple browser platformer:

- provide keyboard controls;
- support pause;
- support mute;
- avoid requiring audio cues only;
- avoid rapid flashing;
- make restart instant;
- keep text readable when scaled;
- include a "controls" overlay on first load.

For browser play, also consider:

- no account required;
- no install required;
- fast first load;
- start screen with "click/focus to play";
- full-screen button optional;
- responsive canvas scaling.

---

# 12. Current AI-coding risks in this exact project

## Risk 1: Copilot invents APIs

Likely with Phaser 4 because the release is recent. Mitigation: pin version, cite docs in comments/prompts, and ask Copilot to check installed TypeScript types rather than relying on memory.

## Risk 2: hidden gameplay coupling

AI may put input, physics, animation, scoring and scene transitions in one method. Mitigation: require small files and separate entity responsibilities.

## Risk 3: endless polish before fun

AI is good at adding particles and menus. It is less good at knowing whether the jump feels good. Mitigation: lock the milestone order.

## Risk 4: generated assets/licensing confusion

AI-generated or scraped-looking sprites may have unclear rights. Mitigation: use Kenney, your own Aseprite work, or clearly licensed packs.

## Risk 5: "agent did too much"

Agentic coding tools can now modify many files. That is useful, but it can also bury bad changes. Mitigation: one task per issue, inspect diffs, run the game, commit only after manual play.

---

# 13. A practical first-week plan

## Day 1: repo and boot

- Create Vite + TypeScript app.
- Add Excalibur or Phaser.
- Add Copilot instructions.
- Boot empty scene.
- Deploy placeholder to GitHub Pages.

## Day 2: player movement

- Add player rectangle.
- Add gravity.
- Add left/right movement.
- Add jump.
- Tune constants manually.

## Day 3: platforms and hazards

- Add platforms.
- Add collision.
- Add fall reset.
- Add spikes/hazards.

## Day 4: collectibles and exit

- Add coins.
- Add HUD.
- Add exit condition.
- Add win/restart state.

## Day 5: level format

- Add simple JSON or Tiled map.
- Load level from data.
- Add second test level.

## Day 6: art/audio pass

- Add pixel-art sprites.
- Add basic animation.
- Add SFX.
- Add music toggle.

## Day 7: polish and publish

- Add title screen.
- Add controls overlay.
- Add Playwright smoke test.
- Add README.
- Publish playable link.

---

# 14. The exact Copilot workflow I would use

1. **Start with `/init` or a manual `copilot-instructions.md`.** Copilot CLI’s `/init` can create or update repo instructions based on the codebase. ([GitHub Docs][19])
2. **Create GitHub issues for each small feature.**
3. **Use VS Code Chat for interactive implementation.**
4. **Use Agent Mode only after the task is well-scoped.**
5. **Run the game after every change.**
6. **Use Playwright for smoke tests once the canvas boots.**
7. **Use Copilot code review sparingly, especially after 1 June 2026 due to GitHub Actions minute usage.** ([GitHub Docs][21])
8. **Keep a devlog and update instructions as the project evolves.**

---

# 15. Final recommended setup

For your specific goal, I would choose this:

```text
TypeScript
Vite
Excalibur.js
Aseprite
Kenney CC0 assets
Vitest
Playwright
GitHub Pages
VS Code Copilot Chat + Agent Mode
.github/copilot-instructions.md
.github/prompts/*.prompt.md
```

Use Phaser instead of Excalibur if you want the larger game-dev ecosystem, but be stricter with versioning and docs because Phaser 4 is still relatively new in 2026.

The winning pattern is:

> **Small game, small files, small prompts, fast playtesting loop.**

That gives you the fun of vibe coding without surrendering the design and codebase to the agent.

[1]: https://phaser.io/news/2026/04/phaser-4-1-0-salusa-release?utm_source=chatgpt.com "Phaser v4.1.0 \"Salusa\": Smarter Rendering, ESM Fixes & a Reworked Layer"
[2]: https://excaliburjs.com/?utm_source=chatgpt.com "Hello from Excalibur.js | Excalibur.js"
[3]: https://github.com/phaserjs/phaser/releases?utm_source=chatgpt.com "Releases · phaserjs/phaser - GitHub"
[4]: https://docs.phaser.io/api-documentation/namespace/physics-arcade-tilemap?utm_source=chatgpt.com "Phaser.Physics.Arcade.Tilemap | Phaser Help - docs.phaser.io"
[5]: https://excaliburjs.com/docs/tilemap/?utm_source=chatgpt.com "TileMap - Excalibur.js"
[6]: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame?utm_source=chatgpt.com "Window: requestAnimationFrame () method - Web APIs | MDN"
[7]: https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection?utm_source=chatgpt.com "2D collision detection - Game development | MDN - MDN Web Docs"
[8]: https://developer.mozilla.org/en-US/docs/Games/Techniques/Tilemaps?utm_source=chatgpt.com "Tiles and tilemaps overview - Game development - MDN"
[9]: https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look?utm_source=chatgpt.com "Crisp pixel art look with image-rendering - Game development | MDN"
[10]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API?utm_source=chatgpt.com "Web Audio API - Web APIs | MDN - MDN Web Docs"
[11]: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API?utm_source=chatgpt.com "Using the Gamepad API - Web APIs | MDN - MDN Web Docs"
[12]: https://code.visualstudio.com/docs/copilot/customization/custom-instructions?utm_source=chatgpt.com "Use custom instructions in VS Code"
[13]: https://docs.github.com/en/copilot/how-tos/configure-custom-instructions-in-your-ide/add-repository-instructions-in-your-ide?tool=vscode&utm_source=chatgpt.com "Adding repository custom instructions for GitHub Copilot in your IDE"
[14]: https://code.visualstudio.com/docs/copilot/customization/prompt-files?utm_source=chatgpt.com "Use prompt files in VS Code"
[15]: https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode?utm_source=chatgpt.com "Introducing GitHub Copilot agent mode (preview) - Visual Studio Code"
[16]: https://code.visualstudio.com/docs/copilot/customization/mcp-servers?utm_source=chatgpt.com "Add and manage MCP servers in VS Code - Visual Studio Code"
[17]: https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/set-up-the-github-mcp-server?utm_source=chatgpt.com "Setting up the GitHub MCP Server"
[18]: https://github.blog/changelog/2026-02-25-github-copilot-cli-is-now-generally-available/?utm_source=chatgpt.com "GitHub Copilot CLI is now generally available"
[19]: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference?utm_source=chatgpt.com "GitHub Copilot CLI command reference"
[20]: https://github.blog/changelog/2026-03-19-copilot-coding-agent-now-starts-work-50-faster/?utm_source=chatgpt.com "Copilot coding agent now starts work 50% faster - The GitHub Blog"
[21]: https://docs.github.com/en/copilot/concepts/agents/code-review?utm_source=chatgpt.com "About GitHub Copilot code review"
[22]: https://excaliburjs.com/docs/tiled-plugin/?utm_source=chatgpt.com "Tiled Plugin New! - Excalibur.js"
[23]: https://docs.phaser.io/phaser-editor/scene-editor/game-objects/tilemap-object?utm_source=chatgpt.com "Tilemap | Phaser Help"
[24]: https://kenney.nl/support?utm_source=chatgpt.com "Support · Kenney"
[25]: https://www.aseprite.org/docs/?utm_source=chatgpt.com "Aseprite - Docs"
[26]: https://vite.dev/guide/static-deploy?utm_source=chatgpt.com "Deploying a Static Site | Vite"
[27]: https://playwright.dev/docs/test-snapshots?utm_source=chatgpt.com "Visual comparisons | Playwright"
[28]: https://opengameart.org/?utm_source=chatgpt.com "OpenGameArt.org"
