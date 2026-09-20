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
| _none yet_ |  |  |  |  |  |  |  |

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
