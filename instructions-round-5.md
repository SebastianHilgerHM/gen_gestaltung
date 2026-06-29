# Pictureplane Fixes Round 5

Work through these in order unless implementation reveals a safer dependency order. After each issue, the app should still lint, build, and run correctly before moving to the next.

This round tightens the editor feel: HUD elements must be fully independent from zoom, tool panels should only show useful controls, the layer panel needs a real inspector/info area, planes and nodes should work beyond the picture bounds, planes should remain visible across tools, and image quality/performance needs a focused pass.

---

## Issue #1 - Fully Decouple HUD From Canvas Zoom

The HUD must not be affected by zoom at all.

- Audit every visible HUD or screen-space overlay in the canvas viewport:
  - zoom controls,
  - quick/context menu,
  - canvas label,
  - status text,
  - selection metadata,
  - tool overlays that are not actual canvas objects.
- Ensure viewport zoom transforms only the canvas/object drawing layer.
- HUD font size, padding, border radius, button size, menu position, and layout must remain unchanged at every zoom level.
- Selection handles that are part of object editing may track object positions, but their visible handle/stroke size should remain stable and readable.
- Coordinate conversion must still be correct after the HUD/canvas separation.
- Middle mouse panning and wheel zoom must continue to work normally.

Acceptance criteria:

- Zooming in/out never scales HUD UI.
- Context menus and zoom controls keep identical size at all zoom levels.
- Object hit testing and drag operations still map to the correct canvas coordinates.
- No HUD element appears inside a zoom-transformed container.

---

## Issue #2 - Simplify Decolorize Controls

Remove unnecessary Decolorize controls and adjust defaults.

- Remove the "Color threshold" slider from the Decolorize tool.
- Set the default darkest shade to `140`.
- Keep color preservation behavior stable after removing the slider; if the processing code still needs a threshold, use a sensible fixed value internally.
- Remove any now-obsolete labels, helper text, or state fields from the UI.
- Make sure existing reset/default behavior uses the new darkest shade.

Acceptance criteria:

- No color threshold slider appears in Decolorize.
- Reset defaults sets darkest shade to `140`.
- Decolorize still processes images without errors.
- Lint/build pass.

---

## Issue #3 - Make Left-Side Tool Panels Context-Relevant

The left-side/top tool menu and tool panels should contain only relevant sliders and input fields.

- Audit every tool panel for controls that do not belong to that tool.
- Remove redundant, stale, or low-value controls.
- Keep sliders only where continuous adjustment is useful.
- Keep numeric/text inputs only where direct values are meaningful.
- Avoid repeated image/project controls inside tools when those actions already live globally.
- Avoid showing controls that cannot affect the current selection or workflow.
- If a control is only relevant when something is selected, hide it or replace it with concise selection status.
- Keep artwork import controls only in workflows that actually add or replace artwork.
- Keep plane controls only in workflows that edit planes.

Acceptance criteria:

- Each tool panel reads as purpose-built rather than a generic control dump.
- No useless sliders or input fields remain visible.
- Tool panels still provide all controls needed for the main workflow.
- Empty/disabled states are concise and do not add visual clutter.

---

## Issue #4 - Add Layer Inspector Info Area

Add an information/inspector area to the bottom third of the current layer view.

- Reserve roughly the bottom third of the layer panel for an inspector/info area.
- The upper area should remain the scrollable layer tree.
- The inspector should show details for the current selection, such as:
  - selected layer/object type,
  - name,
  - canvas coordinates,
  - plane point coordinates if a point is selected,
  - artwork position,
  - rotation,
  - scale/width/height,
  - opacity/blend mode,
  - target plane/group if artwork is attached.
- If nothing is selected, show concise project/canvas information.
- Values should update live while dragging/resizing.
- The inspector should be compact, readable, and useful; no debug dumps.
- Text must fit in the narrow layer panel.

Acceptance criteria:

- The layer panel is split into layer tree plus bottom inspector.
- Selecting planes, points, artwork, or the image changes the inspector content.
- Coordinates/rotation/scale values are visible where relevant.
- Layer tree scrolling does not scroll the inspector away.

---

## Issue #5 - Allow Planes And Nodes Outside The Picture Bounds

The canvas workspace should not be limited to the picture itself.

- Planes and points/nodes must be able to move outside the visible image/canvas area.
- Remove or relax clamping that forces plane points to stay inside the image bounds.
- The viewport should allow panning far enough to inspect/edit objects outside the picture.
- Selection and hit testing must still work for off-picture planes/nodes.
- Export should still clip final raster output to the project canvas bounds.
- Editing outside the picture should not make objects disappear from state.
- Handles for off-picture objects should remain reachable when panned into view.

Acceptance criteria:

- Plane points can be dragged beyond the picture edge.
- Off-picture planes remain selectable/editable after panning.
- Export remains project-canvas-sized and clipped.
- No geometry is lost because it leaves the picture bounds.

---

## Issue #6 - Show Planes Across All Tool Screens

Planes should remain visible in other tools/screens, just with reduced opacity.

- Draw existing planes as low-opacity overlays in tools outside Quad Mapper where canvas context is shown.
- In Quad Mapper, keep normal stronger editing opacity.
- In Artwork Placer and Decolorize, show plane outlines/fills at reduced opacity so the user keeps spatial context.
- Hidden planes should remain hidden everywhere.
- Selected planes should still be distinguishable even in non-Quad tools.
- Plane overlays in non-Quad tools should not intercept interactions unless that tool supports plane selection.
- Layer visibility should control these overlays consistently.

Acceptance criteria:

- Planes are visible outside Quad Mapper at lower opacity.
- Hidden plane layers are respected.
- Plane overlays do not make other tools confusing or hard to use.
- Selected plane context remains visible across tool switches.

---

## Issue #7 - Improve Imported Image Resolution Quality

Improve the resolution and visual quality of images once added to a canvas.

- Avoid unnecessarily downscaling imported images permanently during import.
- Preserve the original imported image asset at full resolution.
- Use high-quality canvas scaling when drawing images into the project canvas.
- Keep project export at the selected project canvas resolution.
- Avoid repeated lossy rasterization when applying non-destructive edits.
- Artwork assets should also preserve their original image dimensions.
- Preview rendering may use display scaling, but full-res export/apply should use the best available source data.
- Ensure large images are clipped/cropped cleanly rather than blurred or disappearing.

Acceptance criteria:

- Imported images look sharper on the project canvas.
- Artwork remains sharp after placement where source resolution allows.
- Export uses project canvas resolution and best available source data.
- No avoidable repeated downsample/resample loop degrades images.

---

## Issue #8 - Performance Pass For Canvas Rendering

Improve site performance, especially with multiple planes, artworks, and large images.

- Audit rendering hotspots:
  - repeated full-canvas redraws,
  - mini canvas previews,
  - plane artwork compositing,
  - layer panel rendering,
  - mouse drag handlers.
- Avoid expensive recomputation on every render when state has not changed.
- Cache or memoize plane preview data where appropriate.
- Throttle or batch mousemove redraw work if needed.
- Avoid reading/writing full ImageData repeatedly during live preview unless necessary.
- Keep interaction responsive with many planes and several artwork instances.
- Ensure performance optimizations do not change export output.

Acceptance criteria:

- Dragging points/artwork feels responsive.
- Switching tools remains fast with many planes/artworks.
- Layer mini previews do not cause major slowdowns.
- Lint/build pass after the performance work.

---

## Issue #9 - Final Workflow And Visual Regression Pass

After the HUD, controls, inspector, off-picture editing, cross-tool planes, image quality, and performance work, do a full workflow check.

- Verify:
  - project creation,
  - image import,
  - Decolorize,
  - Quad Mapper,
  - Artwork Placer,
  - layer selection,
  - inspector updates,
  - off-picture plane editing,
  - export/apply.
- Confirm HUD size never changes with zoom.
- Confirm tool panels only show useful controls.
- Confirm planes are visible at low opacity in other tools.
- Confirm image quality remains acceptable after import/export.
- Confirm performance remains responsive with multiple planes/artworks.
- Run lint and production build.

Acceptance criteria:

- The editor feels cleaner and faster.
- HUD, layers, inspector, and canvas interactions behave predictably.
- Image quality is improved or at least no worse than before.
- Lint and build pass cleanly.
