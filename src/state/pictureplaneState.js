import { createContext, useContext } from 'react';

export const DECOLORIZE_DEFAULTS = {
  darkest: 210,
  brightest: 255,
  gamma: 1,
  colorThreshold: 0.2,
};

export const PLACER_DEFAULTS = {
  x: 200,
  y: 200,
  width: 200,
  height: 150,
  rotation: 0,
  opacity: 0.9,
  blendMode: 'normal',
};

export const FORMAT_PRESETS = [
  { id: 'poster', label: 'Poster', desc: 'Hochformat für Druck', width: 2480, height: 3508, iconName: 'Image' },
  { id: 'banner', label: 'Banner', desc: 'Breites Werbeformat, hochauflösend', width: 3840, height: 1280, iconName: 'RectangleHorizontal' },
  { id: 'ticket', label: 'Ticket', desc: 'Eintrittskarte im Querformat', width: 1622, height: 718, iconName: 'Ticket' },
  { id: 'custom', label: 'Custom', desc: 'Eigene Maße eingeben', width: null, height: null, iconName: 'PencilRuler' },
  { id: 'original', label: 'Originalgröße', desc: 'Maße des geladenen Bildes', width: null, height: null, iconName: 'Maximize' },
];

export const StoreContext = createContext(null);

export const DEFAULT_LAYER_ORDER = ['image', 'artwork'];

export function usePictureplane() {
  return useContext(StoreContext);
}
