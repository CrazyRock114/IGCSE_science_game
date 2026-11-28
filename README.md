# FIELDWORK

FIELDWORK is an English-language science adventure set in Meridian Valley. Investigate a greenhouse, a waterworks, a community kitchen, a harbor and a mountain observatory. Change an experimental condition, record readings, and use the evidence to conclude each assignment. The reservoir capstone combines erosion control, water filtration and the energy budget of a treatment pump.

## Run locally

Use Node.js 22 or newer. In the project directory, run:

```sh
npm ci
npm run dev
```

Open [FIELDWORK](http://127.0.0.1:4173/). Use **Journal** to search for a topic or an objective code such as `B6.1/3`. In a mission, choose **Objective experiments** to see its individual labs. Select a setup and move its apparatus to the reference mark. Run at least two different trials and submit the observations that support the decision. Mission and objective progress are saved in the current browser profile and origin.

A current browser with WebGL 2 enables the 3D view. Select setups using the sample ports or the setup menu. Drag the marked 3D handle or adjust the keyboard-accessible slider to operate the apparatus. The slider, readings and grading also work if WebGL 2 is unavailable. Run `npm run build` to produce a self-contained static site in `dist/`, then `npm run preview` to serve it.

After a formula-driven mission is corrected, its recorded settings stay in the browser save. On opening the mission, the table and plot recalculate the outputs from those settings using the corrected formula. Mission completion and XP are preserved. Reference-data missions keep their recorded observations and continue to interpolate between reference samples.

Titration saves each run with its apparatus state, readings and inclusion in the mean. It checks against the latest saved evidence before crediting a submission. If another tab has already changed that evidence, the latest saved run is shown for review. Events from an older build can still update runs without a revision. A complete run accepted by the current build remains intact during replay even if a later legacy edit sorts earlier in the same clock tick. After an objective has a revised run, new completion requires a checked submission. Valid older evidence can be used and receives revisions on successful submission. If an older record disagrees with the saved apparatus state, the learner is asked to record it again before using it in a mean. Previously earned completion and XP are preserved.

## Curriculum scope

FIELDWORK uses Cambridge IGCSE Co-ordinated Sciences (Double Award), syllabus 0654 for examination in 2025–2027. Every numbered content objective is mapped by subsection and tier. The in-game Journal can filter by subject or search for concepts and syllabus codes. [Official syllabus](https://www.cambridgeinternational.org/Images/664572-2025-2027-syllabus.pdf)

| Subject | Missions | Core objectives | Supplement objectives |
| --- | ---: | ---: | ---: |
| Biology | 43 | 147 | 84 |
| Chemistry | 46 | 120 | 61 |
| Physics | 53 | 144 | 94 |
| Total | 142 | 411 | 239 |

The 142 main missions each have a subsection-level investigation. Within those missions, each of the 650 numbered objectives has its own task, experimental setups, evidence log, conclusion and animated 3D apparatus. The 3D views reuse equipment designs and apply objective-specific settings. Continuous models calculate live readings for selected experiments, including diffusion, plant water transport, titration, chromatography, reaction rates, mechanics, circuits and optics. Other objectives use a 3D sample carriage and authored reference observations. Scored observations are recorded at the reference mark so evidence stays comparable between setups. The live models use idealised apparatus and stated reference settings.

Model references include [diffusion and osmosis](https://openstax.org/books/biology/pages/5-2-passive-transport), [acid–base titration](https://openstax.org/books/chemistry-2e/pages/14-7-acid-base-titrations) and [refraction and thin-lens equations](https://openstax.org/books/physics/pages/16-key-equations).

## Verify playability

`npm run check` tests all 650 objective routes, authored setups, scene states, evidence gates, grading and save round trips. It also runs the checks for the original 142 missions and capstone.

For a complete WebGL and interface test, start the isolated QA preview with `PORT=4174 npm run dev -- --qa`. Open the [browser verification page](http://127.0.0.1:4174/__qa/objectives) and select **Verify all objective experiments**. It opens every Journal route, checks the rendered scene, moves the controls through an intermediate position, rejects an uncalibrated run, and runs each setup at the reference mark, tests evidence submission and checks that progress persists after reloading. The QA server uses a separate local origin and does not serve its test routes in the production build.

Run `npm run build` before the [practical checks](http://127.0.0.1:4174/__qa/round2). The mixed-version cases use that build and a temporary build of Git commit `c921a82` on the same QA origin. Run the three suites one at a time. [Mission and save checks](http://127.0.0.1:4174/__qa/round1) · [Reservoir checks](http://127.0.0.1:4174/__qa/round3)

## Implementation

The interface is plain HTML, CSS and JavaScript. Three.js renders the laboratory models and OrbitControls provides the camera. Curriculum modules define scenarios, model inputs and readings, conclusion questions, cross-mission connections and objective references. There is no server-side account or external runtime asset dependency.

## Generated artwork

The built-in ImageGen tool produced the original environment art for [outpost.webp](assets/outpost.webp), [biome.webp](assets/biome.webp), [waterworks.webp](assets/waterworks.webp) and [observatory.webp](assets/observatory.webp). The three sector images were cropped from a single contact sheet and saved with the panoramic outpost as WebP for the game.

<details>
<summary>Outpost prompt</summary>

Create an original ultra-wide cinematic photoreal video game environment key art, no typography or graphics of any kind. A remote modern science research outpost tucked in a lush rugged Pacific temperate mountain valley, inspired by real ecological field stations. From a high hillside, a silver-blue lake winds into the far center distance, with steep layered pine forests and hazy slate-blue mountain walls. Believable science architecture on the right half: two or three modest concrete observation and laboratory towers and illuminated low horizontal glass field buildings on a terraced hillside, a dam / waterworks road in the valley, a few orange lights as accents. Warm late-afternoon amber light breaks through thick clouds at the upper right across the river, while the left third is dark, evergreen, quiet panoramic negative space with no bright distraction, for white title overlay. Dense authentic small environmental detail, sweeping scale, filmic shadows, quietly adventurous, subtle teal in the shadows, restrained peach sunlight, advanced AAA environmental concept art rendered like a location photograph. No people, no large foreground object, no text, no frame. Target 3:1 panoramic composition around the middle horizontal band, keep key buildings and lake in this strip.

</details>

<details>
<summary>Sector art prompt</summary>

Create a 3-panel panoramic contact sheet image, 3 equally wide photographic science environment cards side by side, no margins, dividers or typography. Every panel should be an original realistic premium adventure-game environment, beautifully photographed with rich cinematic color, lots of texture and strong visual separation. LEFT third: emerald jade tropical botanical greenhouse, a dew-covered fern in the foreground, towering terraced glass roof and a trail receding through layered lush broad leaves, green sunlight. MIDDLE third: cobalt and cyan water analysis laboratory, luminous blue glass beaker, test tubes and transparent flasks on a slate laboratory bench, lab windows with soft teal bokeh, authentic chemistry laboratory. RIGHT third: violet and indigo astronomical observatory radio telescope dominating a spruce mountain ridge, deep purple sky with small stars, last light on horizon, believable real antenna pointing diagonally to upper left. Keep readable subjects centered in each of the three sections, tone at the lower edge of each panel dark for overlaid card text. No letters, no people, no text, no watermark. Landscape aspect ratio as wide as possible.

</details>
