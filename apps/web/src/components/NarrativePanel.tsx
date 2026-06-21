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
  const narrativeText = narrative?.text ?? '';
  const narrativeWordCount = narrative?.wordCount ?? 0;
  const hasAudio = Boolean(narrative?.audioUrl);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2>Narrative</h2>
        </div>
        <span className="badge">{narrativeWordCount} words</span>
      </div>

      <div className="narrative-stack">
        <label className="field">
          <span className="field-label">Editable narrative</span>
          <textarea
            className="field-input field-textarea narrative-editor"
            rows={8}
            placeholder="Paste or write the narrative here, or generate one from the topic."
            value={narrativeText}
            onChange={(event) => onNarrativeChange(event.target.value)}
          />
        </label>

        <div className="narrative-audio-card">
          <div>
            <strong>Audio preview</strong>
            <p className="helper-text">
              {hasAudio
                ? 'Preview the generated narration before moving on to video generation.'
                : 'You can type the narrative manually or generate it from the topic, then generate audio to unlock narration preview.'}
            </p>
          </div>

          {hasAudio ? (
            <audio controls src={narrative?.audioUrl} />
          ) : (
            <span className={`audio-status-chip audio-status-${audioStatus}`}>
              Audio status: {audioStatus}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
