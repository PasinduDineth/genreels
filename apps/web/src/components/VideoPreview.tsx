import type {VideoAsset} from '../types';

interface VideoPreviewProps {
  canRender: boolean;
  isRendering: boolean;
  onRender: () => void;
  video: VideoAsset | null;
}

export function VideoPreview({
  canRender,
  isRendering,
  onRender,
  video,
}: VideoPreviewProps) {
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

      <div className="video-shell">
        {video ? (
          <video controls playsInline src={video.url} />
        ) : (
          <div className="video-placeholder">
            <p>Your rendered preview will appear here.</p>
            <span>Silent Remotion export, ready after the 10 images are prepared.</span>
          </div>
        )}
      </div>

      <div className="video-meta">
        <span>Format: 1080 x 1920</span>
        <span>Audio: none</span>
        <span>
          Duration: {video?.durationInSeconds ? `${video.durationInSeconds}s` : 'pending'}
        </span>
      </div>
    </section>
  );
}
