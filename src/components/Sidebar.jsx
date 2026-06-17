import * as Icons from 'lucide-react';
import tools from '../tools/index.js';

export default function Sidebar({ activeTool, onSelect }) {
  return (
    <nav className="tool-tabs">
      {tools.map(tool => {
        const Icon = Icons[tool.iconName] ?? Icons.Box;
        return (
          <button
            key={tool.id}
            className={`tool-tab${activeTool === tool.id ? ' active' : ''}`}
            onClick={() => onSelect(tool.id)}
            title={`${tool.label}: ${tool.description}`}
          >
            <Icon size={15} />
            <span>{tool.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
