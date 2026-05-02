import { CheckCircle } from 'lucide-react';

export default function AgentFlow({ nodes, activeIndex }) {
  return (
    <div className="flex items-center gap-1">
      {nodes.map((node, index) => {
        const nodeState = index < activeIndex ? 'completed'
                        : index === activeIndex ? 'active'
                        : 'pending';

        return (
          <div key={node} className="flex flex-1 items-center gap-1">
            <div
              className={`flex flex-1 items-center justify-between rounded-lg border px-2.5 py-2 transition-all duration-400 ${nodeState === 'active' ? 'agent-node-active' : ''}`}
              style={{
                position: 'relative',
                overflow: 'hidden',
                background: nodeState === 'completed' ? 'rgba(16,217,138,0.12)'
                          : nodeState === 'active'    ? 'var(--accent-soft)'
                          : 'var(--surface)',
                borderColor: nodeState === 'completed' ? 'rgba(16,217,138,0.3)'
                           : nodeState === 'active'  ? 'var(--accent-border)'
                           : 'var(--border)',
                opacity: nodeState === 'pending' ? 0.5 : 1,
              }}
            >
              <p
                className="text-[11px] font-medium"
                style={{ 
                  color: nodeState === 'completed' ? 'var(--success)' 
                       : nodeState === 'active' ? 'var(--accent)' 
                       : 'var(--text-dim)',
                  zIndex: 1
                }}
              >
                {node}
              </p>
              <div style={{ zIndex: 1 }}>
                {nodeState === 'completed' ? (
                  <CheckCircle size={12} color="var(--success)" />
                ) : (
                  <div
                    className="h-1 w-1 rounded-full transition-all duration-300"
                    style={{ background: nodeState === 'active' ? 'var(--accent)' : 'var(--text-dim)' }}
                  />
                )}
              </div>
            </div>
            {index < nodes.length - 1 && (
              <div
                className="hidden h-px w-2 flex-shrink-0 sm:block"
                style={{ background: 'var(--border)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
