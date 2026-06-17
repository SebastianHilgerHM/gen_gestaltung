# Pictureplane Fixes Round 2

Work through these in order. After each issue, the app should still build and run correctly before moving to the next. Keep to the clean/minimal code style established in the previous rework (no unneeded error handling, no comments explaining the obvious).

---

## Issue #1 — Layout changes

- Move the tool tabs (Decolorize, Quad Mapper, Artwork Placer, etc.) out of the left rail and into a horizontal bar across the top of the page, tabs sitting next to each other.
- Move the properties/options panel (currently on the right) to the left side.
- Move the layers panel to the right side.
- Canvas remains centered between the two side panels, below the tab bar.

---

## Issue #2 — Canvas pan and zoom

Add Photoshop/Affinity-style canvas navigation:

- Scroll wheel zooms in/out, centered on the cursor position.
- Space-held + drag (or middle-mouse drag) pans the canvas.
- Zoom level should be visible somewhere (e.g. a percentage indicator), with a way to reset to 100% / fit-to-view.
- Pan/zoom state is part of the view only — it must not affect the underlying image data, coordinates used for editing, or exports.

---

## Issue #3 — Toggle original vs. edited

Add a single button (not a tab, not a side-by-side view) that toggles the canvas display between the current edited state and the original unedited image. Toggling back to "edited" must resume exactly where the edit history left off — toggling is a view-only preview, not an undo.

---

## Issue #4 — Fix automatic edge detection

The current auto edge detection in Quad Mapper doesn't produce usable quads. Diagnose and fix the detection pipeline so that:

- It reliably finds the dominant rectangular surface in the selected/clicked area.
- The proposed quad corners land on the actual detected edges/corners, not arbitrary bounding-box corners.
- It degrades gracefully (e.g. falls back to a reasonable default quad) when no clear quad is found, rather than producing a broken or degenerate shape.

---

## Issue #5 — Editable plane edges in Quad Mapper

Allow a quad to become a polygon with more than 4 points:

- Clicking on an existing edge (line between two corners) inserts a new draggable point at that location, splitting the edge into two.
- Added points can be removed again (e.g. double-click, or a delete/right-click action) to collapse back to the previous edge.
- The homography/warping logic must still work with the resulting polygon (e.g. by triangulating or otherwise generalizing beyond the 4-point case) — placed artwork should continue to map correctly onto the modified shape.