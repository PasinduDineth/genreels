import {useId, useState} from 'react';
import type {VideoAsset} from '../types';

interface VideoPreviewProps {
  canDownloadBundle: boolean;
  canRender: boolean;
  isBundleReady: boolean;
  isRendering: boolean;
  onDownloadBundle: () => void;
  onImportBundle: (file: File) => void;
  onRender: () => void;
  video: VideoAsset | null;
}

export function VideoPreview({
  canDownloadBundle,
  canRender,
  isBundleReady,
  isRendering,
  onDownloadBundle,
  onImportBundle,
  onRender,
  video,
}: VideoPreviewProps) {
  const inputId = useId();
  const [selectedFileName, setSelectedFileName] = useState('');

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 4</p>
          <h2>Video preview</h2>
        </div>
        <button
          className="button button-secondary"
          disabled={!canRender}
          onClick={onRender}
          type="button"
        >
          {isRendering ? 'Rendering...' : 'Render video'}
        </button>
      </div>

      <div className="bundle-tools">
        <div className="bundle-card">
          <div>
            <p className="eyebrow">Bundle Export</p>
            <strong>Download reusable render package</strong>
            <p className="helper-text">
              Includes audio, images, captions, prompts, narrative, and render metadata in one zip.
            </p>
          </div>
          <button
            className="button button-secondary"
            disabled={!canDownloadBundle}
            onClick={onDownloadBundle}
            type="button"
          >
            Download zip
          </button>
        </div>

        <div className="bundle-card">
          <div>
            <p className="eyebrow">Bundle Import</p>
            <strong>Load a saved package</strong>
            <p className="helper-text">
              Import a previous zip, repopulate the UI, then press render without regenerating assets.
            </p>
          </div>

          <div className="bundle-import-actions">
            <label className="button button-secondary bundle-file-button" htmlFor={inputId}>
              Choose zip
            </label>
            <input
              accept=".zip,application/zip,application/x-zip-compressed"
              className="bundle-file-input"
              id={inputId}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (!file) {
                  setSelectedFileName('');
                  return;
                }

                setSelectedFileName(file.name);
                onImportBundle(file);
                event.currentTarget.value = '';
              }}
              type="file"
            />
            <span className="bundle-file-name">
              {selectedFileName || (isBundleReady ? 'Bundle imported and ready to render.' : 'No zip selected yet.')}
            </span>
          </div>
        </div>
      </div>

      <div className="video-shell">
        {video ? (
          <video controls playsInline src={video.url} />
        ) : (
          <div className="video-placeholder">
            <p>Your rendered preview will appear here.</p>
            <span>Ready to render once narration, captions, and the 10 images are available.</span>
          </div>
        )}
      </div>

      <div className="video-meta">
        <span>Format: 1080 x 1920</span>
        <span>Audio: narration included</span>
        <span>
          Duration: {video?.durationInSeconds ? `${video.durationInSeconds}s` : 'pending'}
        </span>
      </div>
    </section>
  );
}
