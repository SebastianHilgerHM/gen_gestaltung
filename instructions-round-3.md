# Pictureplane Fixes Round 3

Work through these in order unless a later implementation pass discovers a safer dependency order. After each issue, the app should still build and run correctly before moving to the next. Keep the clean/minimal code style established in the previous rework.

This round focuses on making layers more useful, making plane-bound artwork behave like editable objects, adding context-aware quick actions, and introducing lighting-aware compositing.

---

## Issue #1 - Normalize Plane Artwork State

Before changing the UI, make plane-bound artwork explicit in app state.

- Represent every placed artwork as an artwork instance with a stable id.
- Each artwork instance must know whether it is free-floating, attached to one plane, or attached to a connected plane group.
- Plane-attached artwork must store its transform in plane-local coordinates, not only screen/canvas coordinates.
- Preserve existing free-floating Artwork Placer behavior as a fallback placement mode.
- Keep layer visibility separate for:
  - the plane itself,
  - each artwork instance attached to that plane,
  - free-floating artwork instances.
- Do not bake artwork into the image until the user explicitly exports/applies.
- Switching tools must preserve all artwork instances and their layer visibility.

Acceptance criteria:

- Adding artwork creates a persistent artwork instance.
- A plane can have zero, one, or multiple artwork instances.
- Existing single-artwork workflows still work.
- Export/apply uses the new artwork instance state instead of ad hoc local placement state.

---

## Issue #2 - Redesign Layers Panel Information Architecture

Make the layers panel clearer, richer, and more useful.

- Replace the current flat layer list with a structured hierarchy.
- Top-level layer rows should include:
  - Current Image,
  - Plane groups or individual planes,
  - Free Artwork.
- Plane rows should show useful metadata:
  - plane name,
  - number of polygon points,
  - number of attached artworks,
  - visibility state,
  - selected/active state.
- Artwork rows should show useful metadata:
  - artwork name or generated label,
  - target plane/group,
  - blend mode,
  - opacity,
  - visibility state.
- Keep layer controls compact and scan-friendly.
- Use familiar icon buttons for visibility, selection, expand/collapse, reorder, and delete where appropriate.
- The panel should feel like a production editor panel, not a debug list.

Acceptance criteria:

- The layer panel remains usable with many planes and multiple artworks per plane.
- Selection in the layer panel selects the matching plane or artwork in the canvas.
- Visibility toggles immediately affect preview and export.
- Reordering still works where ordering matters.

---

## Issue #3 - Nested Plane Artwork Rows

When artwork is added to a plane, show it nested below that plane in the layers panel.

- Each plane row gets a disclosure arrow.
- Collapsed state shows the plane row only.
- Expanded state shows the artwork instances attached to that plane.
- Use right/down arrow behavior:
  - right arrow means collapsed,
  - down arrow means expanded.
- Each nested artwork row must have its own visibility toggle.
- Hiding a plane should hide its plane overlay and all attached artwork in the canvas preview.
- Hiding an attached artwork should hide only that artwork.
- A plane with hidden children should still clearly communicate that it contains artwork.
- Connected plane groups should support nested artwork rows too.

Acceptance criteria:

- Plane-attached artwork appears under the correct plane or connected group.
- Nested artwork visibility works independently from plane visibility.
- Collapsing/expanding does not change selection, visibility, transforms, or export output.

---

## Issue #4 - Plane Rows as Mini Canvases

Make each plane row behave like a small preview canvas of that plane.

- Plane rows should show a mini preview of the plane surface.
- The preview should preserve the plane's current morph/polygon shape.
- Attached artwork should appear inside the mini preview with the same projection/morph as the main canvas.
- Hidden artwork should not appear in the mini preview.
- Hidden planes should show a muted/disabled preview state.
- The preview should update when:
  - plane points move,
  - artwork moves/resizes,
  - opacity/blend mode changes,
  - visibility changes.
- Keep previews lightweight enough that many layers do not make the app sluggish.

Acceptance criteria:

- The layer panel gives a visual read of each plane without needing to inspect the main canvas.
- Plane previews match the main canvas projection closely enough to be trusted.
- Mini previews do not change image data or artwork transforms.

---

## Issue #5 - Edit Artwork Directly on Plane Mini Canvases

Allow artwork to be adjusted from the plane mini canvas while keeping the morph intact.

- Users can select an artwork instance inside a plane mini canvas.
- Users can move artwork inside the plane-local space.
- Users can resize artwork inside the plane-local space.
- If rotation is supported for plane-bound artwork, it must also be editable.
- Editing in the mini canvas must update the same artwork instance used by the main canvas.
- Plane-local transforms must remain stable even if the plane polygon is later moved or reshaped.
- The mini canvas should show handles only for the selected artwork.
- Interactions in the mini canvas must not accidentally pan the main canvas.

Acceptance criteria:

- Moving/resizing an artwork in the layer panel updates the main canvas immediately.
- Moving/resizing a plane itself does not lose artwork placement.
- Export/apply uses the updated plane-local artwork transform.

---

## Issue #6 - Main Canvas Artwork Editing on Planes

Make plane-attached artwork editable directly on the main canvas too.

- Users can select artwork projected onto a plane.
- Selected artwork should show projected transform handles.
- Users can move and resize the artwork while it remains constrained to the plane or connected plane group.
- For connected plane groups, artwork movement should remain continuous across shared edges.
- Selection should distinguish between:
  - plane point editing,
  - plane selection,
  - artwork selection,
  - artwork transform editing.
- The layer panel selection and main canvas selection must stay in sync.

Acceptance criteria:

- Plane-bound artwork feels like an editable object, not a baked texture.
- Editing artwork does not move plane points unless the plane itself is selected.
- Existing Quad Mapper plane editing remains intact.

---

## Issue #7 - Context-Aware Right Click Menu

Replace the generic right-click canvas menu with a context-aware quick menu.

- Right-click on empty canvas should show view/canvas options:
  - Fit view,
  - Actual size,
  - Zoom in,
  - Zoom out,
  - Add plane if a tool supports it.
- Right-click on a plane should show plane options:
  - Select plane,
  - Rename plane,
  - Hide/show plane,
  - Add artwork to plane,
  - Duplicate plane,
  - Delete plane,
  - Reset plane to quad if it has extra points.
- Right-click on a plane edge should show edge options:
  - Insert point,
  - Connect edge,
  - Disconnect edge if already connected.
- Right-click on a plane point should show point options:
  - Remove point, if it is not one of the original four corners,
  - Reset point,
  - Select connected points, if the point belongs to a connected edge.
- Right-click on artwork should show artwork options:
  - Select artwork,
  - Hide/show artwork,
  - Bring forward,
  - Send backward,
  - Duplicate artwork,
  - Replace artwork,
  - Remove artwork,
  - Fit artwork to plane.
- Menu contents should only include actions that make sense for the clicked target.
- Disabled actions should be rare; prefer hiding impossible actions.

Acceptance criteria:

- Right-clicking different objects produces meaningfully different menus.
- Menu actions operate on the clicked object, not only the currently selected object.
- Right-click no longer conflicts with panning or point editing.

---

## Issue #8 - Lighting Match Tool

Add a new top-level tool/header for making placed artwork inherit the lighting of the source image.

- Add a new tab/header next to the existing tools, e.g. "Lighting Match".
- The tool adjusts artwork instances so they better match the target image lighting.
- It should work for:
  - free-floating artwork,
  - artwork attached to one plane,
  - artwork attached to connected plane groups.
- Start with useful controls:
  - Enable/disable lighting match per artwork instance,
  - Strength,
  - Shadow influence,
  - Highlight influence,
  - Color temperature influence,
  - Preserve artwork color toggle.
- Lighting match should be previewed live and remain non-destructive until export/apply.
- Store lighting settings per artwork instance.

Acceptance criteria:

- A placed artwork can be toggled between plain compositing and lighting-matched compositing.
- Lighting settings persist when switching tools.
- Export/apply includes the lighting match result.

---

## Issue #9 - Image-Based Lighting Extraction

Implement the underlying lighting model used by Lighting Match.

- Sample the target image underneath the artwork projection.
- Estimate local luminance and color temperature.
- Create a shading map that can be applied to the artwork.
- For plane-bound artwork, sample from the corresponding projected plane region.
- For connected plane groups, sample each plane section separately so lighting can change across a corner.
- Smooth the lighting map to avoid noisy texture transfer.
- Preserve artwork alpha.
- Blend the lighting effect with user-controlled strength.
- Avoid permanently modifying the source artwork asset.

Acceptance criteria:

- Artwork visibly inherits shadows/highlights from the image underneath it.
- Strong texture noise from the photo does not make artwork dirty or unreadable.
- Lighting match works at export resolution, not only preview resolution.

---

## Issue #10 - Layer Panel Polish and Workflow Pass

After the layer hierarchy, mini canvases, artwork editing, context menus, and lighting match are in place, do a final workflow pass.

- Review layer panel density, spacing, truncation, and scroll behavior.
- Make sure text fits in narrow side panels.
- Make selected states, hover states, and hidden states visually distinct.
- Ensure all icon buttons have clear tooltips.
- Make object selection predictable between:
  - main canvas,
  - layer panel,
  - mini canvas,
  - context menu.
- Confirm that global export, tool-level export, and apply actions all respect:
  - layer order,
  - hidden layers,
  - plane artwork transforms,
  - lighting match settings.
- Remove obsolete controls or copy that no longer matches the workflow.

Acceptance criteria:

- The app feels coherent with multiple planes and multiple artworks.
- No stale state appears when switching tools.
- All new workflows build and run cleanly after the polish pass.
