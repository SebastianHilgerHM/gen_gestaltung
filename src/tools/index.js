import Decolorize from './Decolorize/index.jsx';
import QuadMapper from './QuadMapper/index.jsx';
import ArtworkPlacer from './ArtworkPlacer/index.jsx';
import GalleryCollage from './GalleryCollage/index.jsx';

const manualTools = [
  {
    id: 'decolorize',
    label: 'Decolorize',
    description: 'Luminance remapping with color preservation',
    component: Decolorize,
  },
  {
    id: 'quad-mapper',
    label: 'Quad Mapper',
    description: 'Perspective warp via 4-point homography',
    component: QuadMapper,
  },
  {
    id: 'artwork-placer',
    label: 'Artwork Placer',
    description: 'Free-position artwork compositing',
    component: ArtworkPlacer,
  },
];

const tabs = [
  {
    id: 'manual',
    label: 'Manuell',
    iconName: 'SlidersHorizontal',
    tools: manualTools,
  },
  {
    id: 'gallery-collage',
    label: 'Gallery Collage',
    iconName: 'Sparkles',
    tools: [
      {
        id: 'gallery-collage',
        label: 'Gallery Collage',
        description: 'AI inpainting of framed artworks via ComfyUI Cloud',
        component: GalleryCollage,
      },
    ],
  },
];

export default tabs;
