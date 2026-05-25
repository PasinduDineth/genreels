import type {PromptItem} from '../types';

interface PromptListProps {
  prompts: PromptItem[];
}

export function PromptList({prompts}: PromptListProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2>Prompt list</h2>
        </div>
        <span className="badge">{prompts.length}/10</span>
      </div>

      {prompts.length === 0 ? (
        <div className="empty-state">
          Prompts will appear here after the topic is submitted.
        </div>
      ) : (
        <ol className="prompt-list">
          {prompts.map((prompt, index) => (
            <li className="prompt-card" key={prompt.id}>
              <span className="prompt-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="prompt-copy">
                <div className="prompt-copy-group">
                  <strong>Image prompt</strong>
                  <p>{prompt.text}</p>
                </div>
                <div className="prompt-copy-group">
                  <strong>Image-to-video prompt</strong>
                  <p>{prompt.videoPrompt}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
