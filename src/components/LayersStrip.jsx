import { ChevronDown, ChevronUp, Eye, EyeOff, Image, Maximize2, Sticker } from 'lucide-react';
import { usePictureplane } from '../state/pictureplaneState.js';

const BASE_META = {
  image: {
    label: 'Current Image',
    Icon: Image,
  },
  artwork: {
    label: 'Artwork',
    Icon: Sticker,
  },
};

function planeLayerId(id) {
  return `plane:${id}`;
}

export default function LayersStrip() {
  const {
    image,
    artwork,
    quadMapper,
    layers,
    setLayerHidden,
    selectLayer,
    moveLayer,
  } = usePictureplane();
  const planeMeta = Object.fromEntries(quadMapper.planes.map(plane => [
    planeLayerId(plane.id),
    { label: plane.name, Icon: Maximize2 },
  ]));
  const meta = { ...BASE_META, ...planeMeta };
  const available = {
    image: !!image,
    artwork: !!artwork,
    ...Object.fromEntries(quadMapper.planes.map(plane => [planeLayerId(plane.id), true])),
  };
  const items = layers.order.filter(id => available[id] && meta[id]);

  return (
    <div className="layers-strip">
      <div className="layers-title">Layers</div>
      <div className="layers-list">
        {items.length === 0 ? (
          <div className="layers-empty">No layers</div>
        ) : items.map(id => {
          const { Icon, label } = meta[id];
          const hidden = !!layers.hidden[id];
          const active = layers.selected === id;

          return (
            <div
              key={id}
              className={`layer-item${active ? ' active' : ''}`}
              onClick={() => selectLayer(id)}
            >
              <button
                className="icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setLayerHidden(id, !hidden);
                }}
                title={hidden ? 'Show layer' : 'Hide layer'}
              >
                {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <Icon size={15} />
              <span>{label}</span>
              <div className="layer-actions">
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); moveLayer(id, -1); }} title="Move up">
                  <ChevronUp size={13} />
                </button>
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); moveLayer(id, 1); }} title="Move down">
                  <ChevronDown size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
