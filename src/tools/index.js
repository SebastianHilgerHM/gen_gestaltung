import Decolorize from './Decolorize/index.jsx';
import QuadMapper from './QuadMapper/index.jsx';
import ArtworkPlacer from './ArtworkPlacer/index.jsx';

const tools = [
  {
    id: 'decolorize',
    label: 'Decolorize',
    iconName: 'SunMedium',
    description: 'Luminance remapping with color preservation',
    component: Decolorize,
  },
  {
    id: 'quad-mapper',
    label: 'Quad Mapper',
    iconName: 'Maximize2',
    description: 'Perspective warp via 4-point homography',
    component: QuadMapper,
  },
  {
    id: 'artwork-placer',
    label: 'Artwork Placer',
    iconName: 'Move',
    description: 'Free-position artwork compositing',
    component: ArtworkPlacer,
  },
];

export default tools;
