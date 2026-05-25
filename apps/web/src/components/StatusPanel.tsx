import type {GenerationStatus, StatusMessage} from '../types';

interface StatusPanelProps {
  narrativeStatus: GenerationStatus;
  promptStatus: GenerationStatus;
  imageStatus: GenerationStatus;
  sceneVideoStatus: GenerationStatus;
  renderStatus: GenerationStatus;
  feed: StatusMessage[];
}

function StatusPill({
  label,
  status,
}: {
  label: string;
  status: GenerationStatus;
}) {
  return (
    <div className={`status-pill status-${status}`}>
      <span>{label}</span>
      <strong>{status}</strong>
    </div>
  );
}

export function StatusPanel({
  narrativeStatus,
  promptStatus,
  imageStatus,
  sceneVideoStatus,
  renderStatus,
  feed,
}: StatusPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h2>Status</h2>
        </div>
      </div>

      <div className="status-grid">
        <StatusPill label="Narrative" status={narrativeStatus} />
        <StatusPill label="Prompts" status={promptStatus} />
        <StatusPill label="Images" status={imageStatus} />
        <StatusPill label="Scene Video" status={sceneVideoStatus} />
        <StatusPill label="Render" status={renderStatus} />
      </div>

      <div className="status-feed">
        {feed.length === 0 ? (
          <div className="empty-state">Status updates will appear during generation.</div>
        ) : (
          feed.map((item) => (
            <article className={`status-item status-item-${item.tone}`} key={item.id}>
              <div className="status-item-row">
                <strong>{item.message}</strong>
                <span>{item.timestamp}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
