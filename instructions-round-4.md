# Pictureplane Fixes Round 4

Work through these in order unless a later implementation pass discovers a safer dependency order. After each issue, the app should still lint, build, and run correctly before moving to the next.

This round removes the lighting-match experiment, fixes the editor shell and zoom behavior, introduces a proper project start flow with fixed canvas formats, and tightens selection, artwork placement, scaling, clipping, and automatic plane creation.

---

## Issue #1 - Remove Lighting Match Feature Cleanly

Remove the lighting feature added in the previous round and return artwork compositing to a simpler, predictable model.

- Remove the Lighting Match top-level tab/header.
- Delete the Lighting Match tool/component and any related routing/tool registration.
- Remove lighting settings from artwork instance defaults and state.
- Remove lighting-specific controls, labels, export paths, and context menu actions.
- Remove image-based lighting sampling/compositing logic from shared artwork rendering utilities.
- Ensure existing artwork placement, plane projection, export, and apply behavior still works without lighting fields.
- If old saved in-memory instances still contain lighting fields during development, ignore them harmlessly rather than crashing.

Acceptance criteria:

- No Lighting Match tab appears in the UI.
- Artwork rendering no longer performs lighting extraction or temporary lighting canvas generation.
- Lint and build pass after the removal.
- Existing artwork instances still render and export normally.

---

## Issue #2 - Fix Canvas Zoom So HUD And Tool UI Do Not Scale

The viewport zoom currently affects UI overlays/HUD elements that should remain screen-space controls.

- Separate zoomed canvas content from fixed screen-space HUD elements.
- Zooming should scale only the canvas/image/object drawing surface.
- The zoom controls, quick menu, canvas label, selection metadata, and any HUD overlays should stay the same visual size.
- Middle-mouse panning should continue to move the camera/view.
- Mouse coordinate mapping must remain correct at every zoom level.
- Right-click menu placement should remain correct at every zoom level.
- Selection handles that belong to objects may move with the object, but their stroke/handle size should remain readable and not become absurdly large when zoomed in.

Acceptance criteria:

- Zooming in does not enlarge the viewport HUD or quick menu.
- Object hit testing still works when zoomed in/out.
- Pan and zoom feel stable and predictable.
- No layout shift appears in the surrounding panels while zooming.

---

## Issue #3 - Add Start Screen And Project Canvas Formats

Add an app start screen where the user creates a project before entering the editor.

- Show a start screen when no project/canvas has been created yet.
- Let the user create a new project by choosing a canvas format:
  - Poster,
  - Billboard,
  - Ticket,
  - Instagram Story,
  - Instagram Post.
- Each format should define a fixed canvas aspect ratio and pixel size.
- The editor should use the chosen project canvas size as the working canvas, independent of the imported image size.
- Add a clear project title/name field if it fits naturally into the flow.
- After project creation, enter the editor directly.
- Keep the start screen visually simple and useful, not a marketing landing page.
- Provide a way to return to/start a new project without requiring a page refresh.

Acceptance criteria:

- Opening the app with no project shows the start screen.
- Choosing a format creates a canvas with the expected dimensions/aspect ratio.
- Existing tools operate inside the chosen project canvas.
- Starting a new project resets image, planes, artwork instances, selections, and tool state.

---

## Issue #4 - Fit, Clip, And Render Imported Images Inside The Project Canvas

Imported images should become content inside the project canvas instead of defining the canvas itself.

- Store image placement relative to the project canvas.
- When an imported image is larger than the project canvas, clip/crop it to the canvas bounds instead of making it disappear.
- When an imported image is smaller than the project canvas, keep it visible and positioned predictably.
- Add basic image placement defaults, such as centered cover or centered contain, choosing the behavior that best fits the existing workflow.
- All tools should draw against the project canvas dimensions, not raw image dimensions.
- Export/apply should output the project canvas size.
- Selection and plane coordinates should be in project canvas space.

Acceptance criteria:

- Large images are visible and clipped by the canvas.
- Exported images match the selected project format dimensions.
- Planes, artwork, and selection handles line up with the visible canvas content.
- No imported image disappears just because it is larger than the canvas.

---

## Issue #5 - Simplify Tool Tabs And Remove Useless Controls

Clean up tool panels so each tab only exposes controls that make sense for that workflow.

- Audit each top-level tool tab.
- Remove redundant upload/change-image buttons from tabs that should not manage images directly.
- Keep project/image import actions in a consistent, central place where possible.
- Avoid repeating the same image controls in every tool if they do not add value there.
- Keep artwork upload controls only where artwork can actually be added or replaced.
- Keep export/apply controls only where that tool produces a meaningful output.
- Remove obsolete copy that no longer matches the workflow after project formats and lighting removal.

Acceptance criteria:

- Each tab has fewer, more relevant controls.
- Users do not see image upload buttons in tabs where they are not needed.
- Loading images/artwork remains easy from the appropriate workflow.
- No broken references to removed lighting behavior remain.

---

## Issue #6 - Rewrite Left-Click Selection For Planes, Points, And Artwork

Make left-click selection predictable across the main canvas and layer panel.

- Left-clicking a plane should select that plane.
- Left-clicking a plane point should select that point and its parent plane.
- Selected planes should show a clear highlight.
- Selected points should show a stronger highlight than unselected points.
- Left-clicking artwork should select that artwork.
- Selection priority should be predictable:
  - point,
  - artwork handle,
  - artwork body,
  - plane edge,
  - plane body,
  - empty canvas.
- Dragging a selected point should move the point.
- Dragging a selected plane body should move the plane only if plane moving is intentionally supported; otherwise it should only select.
- Empty-canvas click should clear object selection unless the current tool has a reason to keep it.
- Layer panel selection and canvas selection must stay in sync.

Acceptance criteria:

- Users can select planes and points with a normal left click.
- Selected planes/points are visually obvious.
- Artwork selection does not accidentally move plane points.
- Existing drag-selection behavior, if kept, does not conflict with normal object selection.

---

## Issue #7 - Add Artwork Directly To The Selected Plane

Make artwork placement respect the current plane selection.

- If a plane is selected and the user adds artwork, attach the new artwork instance directly to that selected plane.
- If a connected plane group is selected or active, attach to the group when that is the more useful default.
- If no plane/group is selected, keep the current free-floating artwork fallback.
- This behavior should work from:
  - toolbar/panel artwork upload,
  - context menu "Add artwork to plane",
  - any central import action that adds artwork.
- The layer panel should immediately show the artwork nested under the selected plane.
- The newly added artwork should become selected.

Acceptance criteria:

- Selecting a plane before importing artwork places the artwork on that plane automatically.
- Adding artwork with no selected plane still works as free artwork.
- The selected artwork appears in the correct nested layer row immediately.
- Export/apply uses the correct plane-local transform.

---

## Issue #8 - Preserve Artwork Aspect Ratio And Add Shift-Locked Scaling

Artwork should keep its original proportions unless the user explicitly chooses otherwise.

- New artwork should appear at its original aspect ratio by default.
- Plane-bound artwork should preserve the artwork ratio while still following the plane morph/projection.
- Avoid stretching artwork just because the target plane has a different shape.
- Resizing artwork normally may allow free scaling only if that is an intentional mode.
- Holding Shift while scaling should lock the artwork width/height ratio.
- The same Shift-lock behavior should work for:
  - free artwork on the main canvas,
  - plane-bound artwork on the main canvas,
  - artwork edited in mini plane canvases, if mini canvas scaling remains.
- Add internal transform fields if needed to distinguish artwork scale from plane morph.
- Export/apply should match the preview.

Acceptance criteria:

- Newly added artwork is not distorted.
- Shift-resizing preserves the current aspect ratio.
- Plane projection can morph the artwork perspective without unwanted source stretching.
- Preview, mini canvas, and export are consistent.

---

## Issue #9 - Improve Canvas/Object Scaling With Project Bounds

Make scaling behavior robust now that the project canvas has fixed dimensions.

- Clamp or guide objects so scaling remains usable near canvas edges.
- Objects may extend beyond the canvas, but the visible result should be clipped to the canvas.
- Handles should remain reachable and readable when artwork is partly outside the canvas.
- Scaling should not cause negative width/height bugs.
- Plane-bound artwork scaling should stay stable in plane-local coordinates.
- Scaling math should work correctly at any viewport zoom level.

Acceptance criteria:

- Scaling artwork near or outside canvas edges does not break interaction.
- Objects outside the canvas are clipped visually but remain selectable/editable.
- No object disappears due to invalid transform dimensions.
- Shift-lock and normal scaling both work while zoomed.

---

## Issue #10 - Add Quad Mapper Auto-Fill Mode

Add a new auto mode for Quad Mapper that automatically fills the whole image/canvas with planes so that no empty/free space remains.

Auf Deutsch gesagt: Der Auto-Modus soll das ganze Bild automatisch mit Planes ausfüllen, sodass kein Freiraum mehr übrig ist.

- Add a new Quad Mapper mode, e.g. "Auto-fill".
- Auto-fill should generate a connected set of planes that covers the entire project canvas.
- The generated planes should cover the canvas without visible gaps.
- Plane edges should align or connect cleanly where planes touch.
- Start with a practical grid or adaptive subdivision approach if full scene detection is too unreliable.
- Allow the user to choose at least a basic density/detail level if it fits the UI:
  - low,
  - medium,
  - high.
- Generated planes should be normal editable planes after creation.
- Existing manual and auto-detect modes should remain available.
- Auto-fill should respect the project canvas bounds, not the raw imported image dimensions.

Acceptance criteria:

- Activating Auto-fill creates planes covering the whole canvas.
- There are no obvious holes between generated planes.
- Generated planes appear in the layer panel and can be selected/edited.
- Artwork can be attached to generated planes.
- Manual Quad Mapper workflows still work.

---

## Issue #11 - Final Workflow And Regression Pass

After the cleanup, project start screen, selection rewrite, clipping, scaling, aspect-ratio handling, and auto-fill mode are complete, do a full workflow pass.

- Verify the app flow from:
  - start screen,
  - project creation,
  - image import,
  - plane creation/selection,
  - artwork import,
  - plane-bound artwork editing,
  - export/apply.
- Confirm zoom/pan does not affect HUD scale.
- Confirm project canvas bounds are respected by every tool.
- Confirm removed Lighting Match code and UI do not leave dead controls or stale state.
- Confirm tab panels contain only useful controls.
- Confirm all context menus still show only relevant actions.
- Confirm all icon buttons have tooltips where needed.
- Run lint and production build.

Acceptance criteria:

- The app feels coherent as a project-based editor.
- The new canvas format workflow does not break existing editing tools.
- Selection, scaling, clipping, and export match what the user sees.
- Lint and build pass cleanly.
