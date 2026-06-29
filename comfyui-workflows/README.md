# ComfyUI Workflow Blueprints

These files describe two ComfyUI workflows as importable graph skeletons. They use valid ComfyUI workflow JSON structure, while remaining node-library agnostic where ComfyUI depends on custom nodes, especially for GroundingDINO, SAM, depth, normals, semantic segmentation, gallery loading, and custom Python/image-processing steps.

Use these with equivalent nodes from your local ComfyUI installation:

- Image input/output: core ComfyUI `LoadImage`, `PreviewImage`, `SaveImage`.
- Code-based image processing: Python/custom script node, WAS node, Impact Pack image nodes, or equivalent.
- Artwork detection: GroundingDINO, Florence, OWL-ViT, or another open-vocabulary detector.
- Mask refinement: SAM, SAM2, RMBG/SAM hybrid, mask grow/blur/threshold nodes.
- Surface detection: depth, normal map, semantic segmentation, plane/surface detector, or custom Python node.
- Placement/compositing: perspective warp, masked composite, localized inpaint, ControlNet depth/normal/segmentation.

Files:

- `white-world-artwork-preservation.blueprint.json`: desaturates the full scene and restores only existing artwork regions from the original image.
- `surface-artwork-placement.blueprint.json`: places a provided artwork and/or gallery artworks onto visible scene surfaces according to density, variety, and overlap controls.

Both workflows are designed to preserve the base image outside their explicit edit masks.

If ComfyUI reports missing node types such as `PictureplaneArtworkDetector` or `PictureplaneSurfacePlacementPlanner`, replace those placeholder nodes with equivalent custom nodes from your installation. The placeholders are serialized with proper ComfyUI `inputs` and `outputs` arrays, so they should load without the `e.inputs?.map is not a function` error.
