import {useState} from 'react';
import type {GenerationStatus, SocialMetadataAsset} from '../types';

interface SocialMetadataPanelProps {
  canGenerate: boolean;
  metadata: SocialMetadataAsset | null;
  onGenerate: () => void;
  status: GenerationStatus;
}

const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value);
};

export function SocialMetadataPanel({
  canGenerate,
  metadata,
  onGenerate,
  status,
}: SocialMetadataPanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, value: string) => {
    try {
      await copyText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1600);
    } catch {
      setCopiedKey(null);
    }
  };

  const hashtagsLine = metadata?.hashtags.join(' ') ?? '';
  const fullPackage = metadata
    ? `${metadata.title}\n${metadata.description}\n${hashtagsLine}`
    : '';

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Shorts SEO</p>
          <h2>Title, Description, and Hashtags</h2>
        </div>
        <button
          className="button button-secondary"
          disabled={!canGenerate}
          onClick={onGenerate}
          type="button"
        >
          {status === 'loading' ? 'Generating metadata...' : 'Generate metadata'}
        </button>
      </div>

      <p className="panel-copy">
        Uses the approved narrative to generate a viral-hook title, a short SEO-focused description, and five relevant hashtags with <code>#shorts</code> added automatically.
      </p>

      {metadata ? (
        <div className="metadata-grid">
          <article className="metadata-card">
            <div className="metadata-card-header">
              <strong>Title</strong>
              <button
                className="button button-secondary button-small"
                onClick={() => void handleCopy('title', metadata.title)}
                type="button"
              >
                {copiedKey === 'title' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p>{metadata.title}</p>
            <span className="metadata-meta">{metadata.title.length} characters</span>
          </article>

          <article className="metadata-card">
            <div className="metadata-card-header">
              <strong>Description</strong>
              <button
                className="button button-secondary button-small"
                onClick={() => void handleCopy('description', metadata.description)}
                type="button"
              >
                {copiedKey === 'description' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p>{metadata.description}</p>
            <span className="metadata-meta">{metadata.description.length} characters</span>
          </article>

          <article className="metadata-card">
            <div className="metadata-card-header">
              <strong>Hashtags</strong>
              <button
                className="button button-secondary button-small"
                onClick={() => void handleCopy('hashtags', hashtagsLine)}
                type="button"
              >
                {copiedKey === 'hashtags' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p>{hashtagsLine}</p>
            <span className="metadata-meta">{metadata.hashtags.length} total hashtags</span>
          </article>

          <div className="metadata-actions">
            <button
              className="button button-primary"
              onClick={() => void handleCopy('all', fullPackage)}
              type="button"
            >
              {copiedKey === 'all' ? 'Copied all' : 'Copy all'}
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          Generate the narrative first, then create the shorts metadata here.
        </div>
      )}
    </section>
  );
}
