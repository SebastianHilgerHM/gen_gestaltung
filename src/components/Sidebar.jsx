import * as Icons from 'lucide-react';

export default function Sidebar({ tabs, activeTabId, onSelectTab, toolId, onSelectTool }) {
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  return (
    <nav className="tool-tabs">
      {tabs.map(tab => {
        const Icon = Icons[tab.iconName] ?? Icons.Box;
        return (
          <button
            key={tab.id}
            className={`tool-tab${activeTabId === tab.id ? ' active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
            title={tab.label}
          >
            <Icon size={15} />
            <span>{tab.label}</span>
          </button>
        );
      })}

      {activeTab.tools.length > 1 && (
        <div className="tool-subselect">
          <select value={toolId} onChange={e => onSelectTool(e.target.value)}>
            {activeTab.tools.map(tool => (
              <option key={tool.id} value={tool.id}>{tool.label}</option>
            ))}
          </select>
        </div>
      )}
    </nav>
  );
}
