import { useCallback, useMemo, useRef, useState } from 'react';
import { extractPixelsFromImage } from '../utils/imageData.js';
import {
  DECOLORIZE_DEFAULTS,
  DEFAULT_LAYER_ORDER,
  PLACER_DEFAULTS,
  StoreContext,
} from './pictureplaneState.js';

function clonePixels(imageData) {
  return new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
  );
}

function assetFromImage(img, id, name) {
  const { imageData, width, height } = extractPixelsFromImage(img);
  return { id, name, img, pixels: imageData, width, height };
}

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}

async function fileToAsset(file, id) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  URL.revokeObjectURL(url);
  return assetFromImage(img, id, file.name);
}

async function imageDataToAsset(imageData, id, name) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  const img = await loadImage(canvas.toDataURL('image/png'));
  return { id, name, img, pixels: clonePixels(imageData), width: imageData.width, height: imageData.height };
}

export function PictureplaneProvider({ children }) {
  const nextId = useRef(1);
  const [image, setImage] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [artwork, setArtwork] = useState(null);
  const [history, setHistory] = useState([]);
  const [previewOriginal, setPreviewOriginal] = useState(false);
  const [layers, setLayers] = useState({
    selected: 'image',
    hidden: {},
    order: DEFAULT_LAYER_ORDER,
  });
  const [decolorize, setDecolorize] = useState({
    params: DECOLORIZE_DEFAULTS,
    result: null,
    imageId: null,
    paramsKey: '',
  });
  const [quadMapper, setQuadMapper] = useState({
    planes: [],
    selectedPlaneId: null,
    connections: [],
    nextPlaneId: 1,
    imageId: null,
    opacity: 0.9,
    blendMode: 'normal',
  });
  const [artworkPlacer, setArtworkPlacer] = useState({
    transform: PLACER_DEFAULTS,
    targetId: 'free',
    imageId: null,
    artworkId: null,
    result: null,
  });

  const loadImageFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const asset = await fileToAsset(file, nextId.current++);
    setImage(asset);
    setOriginalImage(asset);
    setHistory([]);
    setPreviewOriginal(false);
    setLayers({ selected: 'image', hidden: {}, order: DEFAULT_LAYER_ORDER });
    setDecolorize(s => ({ ...s, result: null, imageId: asset.id, paramsKey: '' }));
    setQuadMapper(s => ({
      ...s,
      planes: [],
      selectedPlaneId: null,
      connections: [],
      nextPlaneId: 1,
      imageId: null,
    }));
    setArtworkPlacer(s => ({ ...s, targetId: 'free', imageId: null, result: null }));
  }, []);

  const loadArtworkFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const asset = await fileToAsset(file, nextId.current++);
    setArtwork(asset);
    setLayers(s => ({ ...s, selected: 'artwork' }));
    setArtworkPlacer(s => ({ ...s, artworkId: null }));
  }, []);

  const applyImageData = useCallback(async (imageData, name) => {
    const asset = await imageDataToAsset(imageData, nextId.current++, name);
    setHistory(h => image ? [...h, clonePixels(image.pixels)] : h);
    setImage(asset);
    setLayers(s => ({ ...s, selected: 'image' }));
    setDecolorize(s => ({ ...s, result: null, imageId: asset.id, paramsKey: '' }));
    return asset;
  }, [image]);

  const setLayerHidden = useCallback((id, hidden) => {
    setLayers(s => ({
      ...s,
      hidden: { ...s.hidden, [id]: hidden },
    }));
  }, []);

  const selectLayer = useCallback((id) => {
    setLayers(s => ({ ...s, selected: id }));
  }, []);

  const moveLayer = useCallback((id, dir) => {
    setLayers(s => {
      const order = [...s.order];
      const i = order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return s;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...s, order };
    });
  }, []);

  const addLayer = useCallback((id) => {
    setLayers(s => {
      if (s.order.includes(id)) return s;
      const order = [...s.order];
      const artIndex = order.indexOf('artwork');
      order.splice(artIndex >= 0 ? artIndex : order.length, 0, id);
      return { ...s, selected: id, order };
    });
  }, []);

  const removeLayer = useCallback((id) => {
    setLayers(s => {
      const hidden = { ...s.hidden };
      delete hidden[id];
      return {
        selected: s.selected === id ? 'image' : s.selected,
        hidden,
        order: s.order.filter(layerId => layerId !== id),
      };
    });
  }, []);

  const value = useMemo(() => ({
    image,
    originalImage,
    artwork,
    history,
    previewOriginal,
    layers,
    decolorize,
    quadMapper,
    artworkPlacer,
    loadImageFile,
    loadArtworkFile,
    applyImageData,
    setLayerHidden,
    selectLayer,
    moveLayer,
    addLayer,
    removeLayer,
    setPreviewOriginal,
    setDecolorize,
    setQuadMapper,
    setArtworkPlacer,
  }), [
    image,
    originalImage,
    artwork,
    history,
    previewOriginal,
    layers,
    decolorize,
    quadMapper,
    artworkPlacer,
    loadImageFile,
    loadArtworkFile,
    applyImageData,
    setLayerHidden,
    selectLayer,
    moveLayer,
    addLayer,
    removeLayer,
  ]);

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}
