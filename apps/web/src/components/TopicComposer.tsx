interface TopicComposerProps {
  topic: string;
  onTopicChange: (value: string) => void;
  onGenerateNarrative: () => void;
  onGenerateAudio: () => void;
  onGenerateVideo: () => void;
  canGenerateNarrative: boolean;
  canGenerateAudio: boolean;
  canGenerateVideo: boolean;
}

export function TopicComposer({
  topic,
  canGenerateAudio,
  canGenerateNarrative,
  canGenerateVideo,
  onGenerateAudio,
  onGenerateNarrative,
  onGenerateVideo,
  onTopicChange,
}: TopicComposerProps) {
  return (
    <section className="panel panel-hero">
      <div className="panel-header">
        <div>
          <p className="eyebrow">MVP Input</p>
          <h1>Historical mystery shorts generator</h1>
        </div>
        <span className="badge badge-soft">React + Vite scaffold</span>
      </div>

      <p className="panel-copy">
        Enter a real mystery, unexplained event, or strange true story. First
        generate the narrative, edit it until it feels right, then generate the
        narration audio, preview it, and finally generate the full video
        pipeline from the approved story.
      </p>

      <label className="field">
        <span className="field-label">Topic</span>
        <textarea
          className="field-input field-textarea"
          rows={4}
          placeholder="Example: The Tunguska event and the theories around what caused it"
          value={topic}
          onChange={(event) => onTopicChange(event.target.value)}
        />
      </label>

      <div className="action-row">
        <button
          className="button button-primary"
          disabled={!canGenerateNarrative}
          onClick={onGenerateNarrative}
          type="button"
        >
          Generate narrative
        </button>
        <button
          className="button button-secondary"
          disabled={!canGenerateAudio}
          onClick={onGenerateAudio}
          type="button"
        >
          Generate audio
        </button>
        <button
          className="button button-secondary"
          disabled={!canGenerateVideo}
          onClick={onGenerateVideo}
          type="button"
        >
          Generate video
        </button>
        <p className="helper-text">
          Flow: narrative, edit, audio preview, then prompts, images, scene videos, and final render.
        </p>
      </div>
    </section>
  );
}
