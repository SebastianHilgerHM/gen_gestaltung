import { useState } from 'react';
import * as Icons from 'lucide-react';
import { FORMAT_PRESETS } from '../state/pictureplaneState.js';

function dimLabel(preset, customW, customH) {
  if (preset.id === 'custom') return `${customW} × ${customH} px`;
  if (preset.id === 'original') return 'passt sich an';
  return `${preset.width} × ${preset.height} px`;
}

export default function FormatPicker({ onSelect }) {
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);

  const choose = (preset) => {
    if (preset.id === 'custom') {
      onSelect({ id: 'custom', label: 'Custom', width: customW, height: customH });
    } else {
      onSelect({ id: preset.id, label: preset.label, width: preset.width, height: preset.height });
    }
  };

  return (
    <div className="format-home">
      <div className="format-intro">
        <h1>Format wählen</h1>
        <p>Wähle ein Ausgabeformat für dein Projekt. Es bestimmt die Auflösung beim Export.</p>
      </div>

      <div className="format-grid">
        {FORMAT_PRESETS.map(preset => {
          const Icon = Icons[preset.iconName] ?? Icons.Square;
          const isCustom = preset.id === 'custom';
          return (
            <button
              key={preset.id}
              className={`format-card ${preset.id}`}
              onClick={() => choose(preset)}
            >
              <div className="format-card-top">
                <Icon size={20} />
                <span className="format-card-dim">{dimLabel(preset, customW, customH)}</span>
              </div>
              <div className="format-card-body">
                <div className="format-card-title">{preset.label}</div>
                <div className="format-card-desc">{preset.desc}</div>
              </div>
              {isCustom && (
                <div className="format-card-custom" onClick={e => e.stopPropagation()}>
                  <input
                    type="number" min={1} value={customW}
                    onChange={e => setCustomW(Math.max(1, +e.target.value))}
                    aria-label="Breite"
                  />
                  <span>×</span>
                  <input
                    type="number" min={1} value={customH}
                    onChange={e => setCustomH(Math.max(1, +e.target.value))}
                    aria-label="Höhe"
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
