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

export const StoreContext = createContext(null);

export const DEFAULT_LAYER_ORDER = ['image', 'artwork'];

export function usePictureplane() {
  return useContext(StoreContext);
}
