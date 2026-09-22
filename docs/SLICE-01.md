# Slice 01 - Public landing

## Implemented boundary

The public React/TypeScript/Vite landing lives in apps/web. No authentication, onboarding, backend, persistence, electrical simulator, or additional product pages are implemented. Open Kinetable navigates to the product preview; Sign in explains availability in a native dialog.

## Current visual and motion implementation

Space Grotesk is self-hosted with its SIL OFL license, preserving the existing Kinetable wordmark. A small original matte-grain texture adds subtle surface depth to the cream background without runtime filters or gradients.

One persistent, fixed-size R3F canvas runs through the hero, prompt, assembly, connections, logic, simulation demonstration, and personal parts tray. Camera framing owns spatial translation; the canvas no longer moves independently in CSS. One non-overshooting scroll value drives both DOM and 3D, smoothing wheel steps without React state updates per frame. Reduced motion uses raw scroll progress.

The final portion of the pinned story retracts wires before moving the existing ESP32, PIR, and OLED into a six-part tray. The breadboard and buzzer leave before the Pico, DHT11, and relay enter. PersonalTable supplies only the overlay copy; it does not create another canvas. The former separate tray section and negative margin handoff were removed.

The learning section has a large interactive 3D breadboard. Connecting ground reveals the wire over 650 ms and lights the LED at the end; reset reverses it. The lesson and final board have scroll entrances tied to their own composition. Reduced motion disables autonomous entrances, float, pointer parallax, and vibration and applies the lesson result immediately.

## Main files

- apps/web/src/landing/ScrollStory.tsx, Hero.tsx, ProductReveal.tsx, PersonalTable.tsx: one scroll timeline and persistent scene composition.
- apps/web/src/landing/story.mjs and story.test.mjs: bounded, reversible stage mapping and native Node check.
- apps/web/src/spatial/StoryWorld.tsx: camera, project choreography, shared physical objects, tray handoff, lighting and shadows.
- apps/web/src/spatial/Models.tsx, SurfaceMarkings.tsx, Wire.tsx, LearningModel.tsx: original hardware geometry, markings, connector terminals, wire reveal, and lesson animation.
- apps/web/src/spatial/LandingScene.tsx: canvas lifecycle, lighting, demand rendering for lower scenes.
- apps/web/src/styles/global.css and apps/web/public/: type, responsive layout, self-hosted font/license, original grain texture.

## Dependencies and assets

No package dependencies added by this quality pass. Existing React, Three.js, R3F, Drei, Motion, Vite, TypeScript, Tailwind and ESLint remain. Asset provenance is in ASSET-LICENSING.md. No external models or images are used. All hardware dimensions, pins and endpoints are presentation approximations, not verified wiring instructions.

## Mocked behavior

Motion-alarm assembly, ownership recommendation, signal playback and LED lesson are presentation fixtures. They do not run AI, validate circuits, simulate electricity, save inventory or play buzzer sound. No product backend is implied.

## Latest verification - 2026-09-22

- Production build, lint, and native Node choreography test pass. The test samples 1,001 positions forward/reverse, checks bounded interpolation, chapter readability, and tray endpoints.
- Production Chromium: inspected hero, intent, intermediate tray transition, settled tray, lesson and ending at desktop and narrow widths. Latest layout checks cover 390x844, 768x1024, 1440x900, 1600x1000 and 1920x1080, with no horizontal overflow or captured runtime errors.
- Central canvas identity persists through hero-to-tray. Canvas bounds remain unchanged during forward/reverse travel. Mixed wheel increments and reversals were exercised.
- Six-second foreground forward/reverse sample at 1440x900: 360 intervals, median 16.7 ms, p95 16.8 ms. This local sample is not a guarantee for other devices.
- Lesson completion/reset works at all tested sizes. Reduced-motion rendering was checked after waiting for the lazy canvas to initialize.
- Final navigation checks confirm Product, logic chapter, Parts and Learn reach their intended states; the lesson also completes using the keyboard. An additional 360x740 hero check has no horizontal overflow.
- Screenshots and runnable local browser checks are under ignored output/playwright: world-*, final-space-*, fixed-reduced.png, world-qa.js, fixed-canvas-qa.js and reduced-fixed-qa.js.

## Remaining limits

- Lazy Three.js chunk is approximately 273 kB gzip and triggers Vite's 500 kB minified warning.
- Hardware geometry and wiring are approximate.
- Browser evidence is local Chromium, not physical-device, Firefox or Safari acceptance.
