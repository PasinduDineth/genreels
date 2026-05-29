import type {GenerationStatus, NarrativeAsset} from '../types';

interface NarrativePanelProps {
  narrative: NarrativeAsset | null;
  audioStatus: GenerationStatus;
  onNarrativeChange: (value: string) => void;
}

export function NarrativePanel({
  narrative,
  audioStatus,
  onNarrativeChange,
}: NarrativePanelProps) {
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
        <div className="narrative-stack">
          <label className="field">
            <span className="field-label">Editable narrative</span>
            <textarea
              className="field-input field-textarea narrative-editor"
              rows={8}
              value={narrative.text}
              onChange={(event) => onNarrativeChange(event.target.value)}
            />
          </label>

          <div className="narrative-audio-card">
            <div>
              <strong>Audio preview</strong>
              <p className="helper-text">
                {narrative.audioUrl
                  ? 'Preview the generated narration before moving on to video generation.'
                  : 'Generate audio after editing the narrative to unlock narration preview.'}
              </p>
            </div>

            {narrative.audioUrl ? (
              <audio controls src={narrative.audioUrl} />
            ) : (
              <span className={`audio-status-chip audio-status-${audioStatus}`}>
                Audio status: {audioStatus}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          A 150 to 160 word story narrative will appear here first, and you will be able to edit it before audio generation.
        </div>
      )}
    </section>
  );
}
