interface TopicComposerProps {
  topic: string;
  disabled?: boolean;
  onTopicChange: (value: string) => void;
  onGenerate: () => void;
}

export function TopicComposer({
  topic,
  disabled = false,
  onTopicChange,
  onGenerate,
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
        Enter a real mystery, unexplained event, or strange true story. The MVP
        flow now writes a short narrative first, turns that storyline into ten
        paired image and image-to-video prompts, generates all ten illustrated
        keyframes, then uses those frames to build fully illustrated scene
        videos before the final vertical render.
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
          disabled={disabled}
          onClick={onGenerate}
          type="button"
        >
          Generate story
        </button>
        <p className="helper-text">
          Full pipeline: narrative, audio, 10 prompt pairs, 10 still images, 10 scene videos, and final render.
        </p>
      </div>
    </section>
  );
}
