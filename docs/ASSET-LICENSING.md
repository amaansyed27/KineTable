# Asset and Model Licensing

Kinetable depends on accurate 3D representations of real hardware. Asset provenance must be tracked from the start.

## Rules

1. Do not add a 3D model, texture, font, icon set, datasheet extract, or other third-party asset without recording its source and license.
2. Prefer assets created specifically for Kinetable or assets under licenses compatible with the project's intended commercial use.
3. Do not assume that a downloadable model is free to redistribute.
4. Manufacturer trademarks and logos remain the property of their owners.
5. Technical facts and dimensions should be sourced from official documentation where possible.
6. If an asset's license is unclear, treat it as unusable until clarified.

## Asset ledger

Maintain one row per external asset.

| Asset | Type | Source | Author/Owner | License | Redistribution allowed? | Modified? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Space Grotesk variable font | TTF | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/spacegrotesk), [upstream](https://github.com/floriankarsten/space-grotesk) | Space Grotesk Project Authors / Florian Karsten | SIL OFL 1.1 | Yes, with included license | No | Self-hosted in apps/web/public/fonts; license included |

## Preferred asset strategy

For core components, prefer building simplified Kinetable-owned models from verified dimensions rather than depending on random community meshes.

Priority order:

1. Kinetable-created model from verified physical measurements/documentation.
2. Manufacturer-provided model with clear commercial/redistribution rights.
3. Third-party model with a clearly compatible license and attribution requirements recorded.
4. Temporary development-only placeholder that is explicitly excluded from release builds.

## Model requirements

A production model should record:

```text
canonical component ID
asset path
source/provenance
license
physical dimensions
coordinate scale
origin convention
pin-anchor verification status
review date
```

## Development placeholders

Temporary placeholders must be marked clearly in metadata, for example:

```json
{
  "releaseStatus": "development-only",
  "redistributable": false
}
```

Release tooling should eventually be able to reject non-redistributable assets.

## Fonts and icons

Record font and icon licenses too. Do not copy proprietary product typefaces or iconography merely because they were used as design references.

## User-uploaded/community assets — later

If Kinetable accepts community component models, submission terms should require the contributor to confirm they have the right to provide the asset and specify its license.

Community content should remain distinguishable from verified Kinetable-owned/approved assets.

## Technical sources

Component definitions should separately track factual sources such as:

- official datasheets;
- manufacturer product pages;
- official board documentation;
- verified pinout references.

The license of a 3D model and the provenance of electrical facts are different concerns and must be stored separately.

## Trademark note

Names such as ESP32, Arduino, Raspberry Pi, and product/module names may be trademarks of their respective owners. Kinetable should use them descriptively and should not imply endorsement unless an actual partnership exists.

## Slice 01 original presentation assets

All geometry in `apps/web/src/spatial/Models.tsx`, `LearningModel.tsx`, and `Wire.tsx`, generated surface markings in `SurfaceMarkings.tsx`, and the letter-based favicon were created in this repository for Kinetable. No external meshes, images, textures, or icons are bundled. Space Grotesk is self-hosted under its included OFL license; the existing wordmark retains its system-font treatment.

| Asset | Provenance | Rights | Scale / origin | Verification |
| --- | --- | --- | --- | --- |
| ESP32-style development board | Original procedural geometry | Repository LICENSE | Presentation units; PCB center at origin, Y up | Approximate silhouette and proportions; not dimension- or pin-verified |
| Pico-style development board | Original procedural geometry | Repository LICENSE | Same convention | Approximate; black controller package, no ESP32 antenna/shield |
| Breadboard, OLED, PIR, buzzer, DHT11, relay | Original procedural geometry | Repository LICENSE | Same convention | Simplified presentation models; no electrical metadata |
| Jumper wires | Original generated curves | Repository LICENSE | World-space presentation coordinates | Illustrative endpoints; not verified pin anchors |
| LED and resistor learning scene | Original procedural geometry | Repository LICENSE | Presentation units; Y up | Illustrative circuit, not electrically verified |
| PCB, shield, rail and display markings | Original generated canvas textures | Repository LICENSE | Model UV coordinates | Descriptive labels, not verified pinout references |
| Soft shadows and studio lighting | Original generated texture and light geometry | Repository LICENSE | Scene coordinates | No downloaded HDRI or image |
| Favicon | Original inline SVG | Repository LICENSE | SVG viewBox coordinates | Letter-based mark |

These assets are redistributable with the application under the repository's license. They are deliberately simplified landing illustrations, not third-party development-only placeholders. Their temporary limitation is engineering accuracy: replace or verify geometry, dimensions, and anchors before reusing them to teach wiring or in the actual workbench. No electrical validity is implied by the landing demo.

The subtle surface-grain.png is an original deterministic 128px texture created in this repository. It uses no third-party image and no runtime filter.
