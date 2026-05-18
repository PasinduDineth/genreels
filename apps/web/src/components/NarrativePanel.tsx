import type {NarrativeAsset} from '../types';

interface NarrativePanelProps {
  narrative: NarrativeAsset | null;
}

export function NarrativePanel({narrative}: NarrativePanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2>Narrative</h2>
        </div>
        <span className="badge">{narrative ? `${narrative.wordCount} words` : '0/160'}</span>
      </div>

      {narrative ? (
        <div className="narrative-card">
          <p>{narrative.text}</p>
        </div>
      ) : (
        <div className="empty-state">
          A 150 to 160 word story narrative will appear here before prompts are generated.
        </div>
      )}
    </section>
  );
}
