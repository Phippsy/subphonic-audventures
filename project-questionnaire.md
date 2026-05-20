# Subphonic Platformer: Project Questionnaire (First Pass)

Use this to capture the decisions and details needed to move from concept to an executable build plan.

How to use:

- Replace each [ANSWER] with your response.
- If unknown, write TBD.
- Keep answers short where possible.

---

## 1. Project Intent

1. Working title for this game:
   Audventures

2. One-sentence mission for the game (why it exists):
   Sonia, our plucky hero (gender-neutral), must work their way through the (initially dark) land of Acoustica. Along the way, they collect "sigs" (signals) to improve their perspective and worldview, and bring greater clarity to their character and the world around them.

3. What outcome matters most for v1?
   Defeat the evil Lord Noise to bring harmony back to Acoustica.

4. What should players feel after finishing a session?
   Amusement, joy.

5. Is this primarily an internal team game, a public demo, or both?
   Internal

---

## 2. Audience and Experience

1. Primary audience:
   Team members at Subphonic, an AI conversation intelligence company

2. Secondary audience (if any):
   Maybe Subphonic customers, in the future.

3. Desired average play session length:
   5 mins

4. Difficulty target for first-time players (easy/medium/hard):
   medium

5. Accessibility priorities for v1 (keyboard-only, low flashing, readable UI, etc.):
   keyboard-only

---

## 3. Core Gameplay Loop

1. Core loop in one line (for example: move -> collect -> avoid -> reach exit):
   Move, jump, collect sigs, navigate platforms, open level gate

2. Player actions required in v1 (move, jump, interact, attack, puzzle, etc.):
   move, jump, squish, collect, open

3. What replaces coins? (for example sound waves, insight tokens, etc.)
   Sigs - sound wave like symbols

4. What is the level completion condition?
   Open the gate

5. What is the fail condition?
   Fall down hole, get killed by one of Lord Noise's minions - distortbots / mufflebots (static-like creatures)

6. Should there be lives/health/checkpoints in v1?
   Yes

7. Must-have mechanics for launch (max 5):
   See #2

8. Explicitly out of scope for v1:
   Up to you

---

## 4. Narrative and Worldbuilding

1. Protagonist identity and role:
   Sonia, the plucky hero who loves sound in all its forms - birdsong, music, a baby's laughter, the wind in the trees.

2. The world premise in 2-3 sentences:
   Acoustica, a once-peaceful country land, has been polluted by Lord Noise and his distortbots / mufflebots, static-like creatures which emit a health-draining force field and darken the landscape

3. Character mapping from real Subphonic roles (for example Patrick, James):
   Patrick: head of compliance. Dark hair, medium length, Harry-Potter-like dishevelled. A gatekeeper, one who can unlock boxes of gate keys for the player if the player correctly answers a question about good compliant practice in AI.
   James: Red-headed - riff on him being "many-hatted", as he does so much, and incorporate the notion of the mad hatter from Alice in Wonderland (But be generous with character portrayal). He can be the provider of "star-like" invincibility (maybe a swiss-army knife) to allow the player to be temporarily invincible and navigate certain sections. In order to get the gift of invincibility, players would need to either give James coffee, beer, or log a ticket in Jira (rotate depending on level).

4. How should compliance appear in gameplay and story?
   See above - enabler, unlocking magic powers / entry to next level.

5. Should characters be named directly after team members or use fictionalized names?
   Yes - Patrick and James. Sonia is fictious.

6. Tone: playful satire, sincere hero story, mixed, other?
   Playful hero in the land of sound.

7. Dialogue style (minimal text, short NPC lines, riddle-based, etc.):
   Minimal text. Riddles for Patrick, Short slack-message style for James.

8. Any content boundaries or internal sensitivities we should avoid?
   just be nice :)

---

## 5. Level and Progression Design

1. Target number of levels for v1:
   1

2. Target number of levels for v2:
   3

3. Level themes/environments:
   Set all in Acoustica, but change the nature of the design each time - as the player levels up and collects Sigs, they should remove darkness and change the landscape. But always Acoustica.
   1 - Acoustica dark "Nightphase" - a combination of rural and cityscape.
   2 - Acoustica medium (Dawn)
   3 - Acoustica bright (Sunrise)

4. Progression model (linear map, world map, branching, endless):
   See above - levels change, same environment but tweaked with level progress.

5. Should each level introduce one new mechanic?
   up to you

6. Bosses or major challenge encounters in v1?
   Lord noise's minion - a mega-distortbot / mufflebot

7. Estimated total playtime for full v1 completion:
   3 mins

---

## 6. Art Direction and Visual Identity

1. Visual direction keywords (based on the reference image):
   Pixel art, classic gaming.

2. Pixel scale preference (16x16, 32x32, mixed, unknown):
   unknown

3. Camera framing preference (tight on player, wider cinematic, dynamic):
   dynamic

4. HUD style priorities (minimal, arcade-heavy, diegetic, etc.):
   unknown

5. Which elements must strongly reflect Subphonic branding?
   game name

6. Are we allowed to use temporary stock/CC0 assets for prototype?
   yes

7. Any visual no-go areas (themes, symbols, colors, style choices)?
   nope

---

## 7. Audio and Music

1. Audio style (chiptune, ambient retro, modern synth, mixed):
   ambient retro

2. Must-have sounds for v1 (jump, collect, fail, win, etc.):
   jump, collect, fail, win, kill distortbots / mufflebots

3. Music approach: one looping track or per-level tracks?
   per-level tracks

4. Should audio communicate gameplay-critical cues?
   yes

5. Any licensing constraints for audio assets?
   no

---

## 8. Technical and Platform Choices

1. Confirm preferred engine for v1 (Excalibur.js or Phaser):
   You choose

2. Confirm TypeScript + Vite stack (yes/no):
   yes

3. Primary deployment target (GitHub Pages, Netlify, Cloudflare, other):
   github pages

4. Supported devices for v1 (desktop only, mobile too, gamepad support):
   desktop only

5. Performance target (for example 60 FPS desktop Chrome):
   you choose

6. Should saves/progression persist between sessions in v1?
   yes

7. Any security/compliance messaging that must appear in-game?
   not for now

---

## 9. Scope, Delivery, and Workflow

1. Target date for first playable prototype:
   today

2. Target date for v1 release/demo:
   n/a - as soon as ready

3. Time budget per week for this project:
   n/a - as soon as ready

4. Contributors and roles:
   you do everything

5. Decision-making process (who signs off gameplay, narrative, art, release):
   I'll sign off via copilot chat

6. Preferred iteration cadence (daily, twice weekly, weekly):
   n/a

7. What does "done" mean for first playable?
   as close as possible to the answers in this document

8. What does "done" mean for v1?
   as above

---

## 10. Quality, Testing, and Acceptance

1. Minimum acceptable quality bar for prototype:
   you do everything

2. Manual test checklist priorities (movement feel, level clarity, bugs, etc.):
   you do everything

3. Automated test expectations for v1 (smoke only, logic + smoke, none):
   you do everything

4. Top 5 failure risks we should design around now:
   you do everything

5. Any non-negotiable acceptance criteria:
   you do everything

---

## 11. Branding, Legal, and Publishing

1. Is this definitely named "Subphonic" in public-facing materials?
   It's "Subphonic Audventures"

2. Any trademark, legal, or brand approval steps before publishing?
   Nope

3. Credits policy for people represented as characters:
   Make something fun up

4. Asset attribution requirements:
   n/a

5. Where will the game link live (company site, internal wiki, social, etc.)?
   Intranet

---

## 12. Open Questions to Resolve Early

1. Enemy concept(s) aligned with story and tone:
   already answered

2. Win-state fantasy (what visual or narrative payoff should happen at level end):
   sound feedback, foreshadow lifting of darkness

3. Insight-power mechanic details (how it grows, what it unlocks):
   ligthens land, grows brain / head size of Sonia

4. NPC interaction model (optional dialogue, mandatory puzzles, none):
   see previous answers

5. Which single mechanic should receive the most polish first?
   movement
