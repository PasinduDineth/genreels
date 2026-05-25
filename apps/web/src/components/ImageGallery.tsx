import type {ImageAsset} from '../types';

interface ImageGalleryProps {
  images: ImageAsset[];
}

export function ImageGallery({images}: ImageGalleryProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 3</p>
          <h2>Image gallery</h2>
        </div>
        <span className="badge">{images.length}/10</span>
      </div>

      {images.length === 0 ? (
        <div className="empty-state">
          Generated images will be shown here as 9:16 story frames.
        </div>
      ) : (
        <div className="gallery-grid">
          {images.map((image, index) => (
            <article className="gallery-card" key={image.id}>
              <div className="gallery-media-grid">
                <div className="gallery-media">
                  <span className="gallery-media-label">Illustration</span>
                  <img alt={`Generated frame ${index + 1}`} src={image.url} />
                </div>
                <div className="gallery-media">
                  <span className="gallery-media-label">Scene clip</span>
                  {image.videoUrl ? (
                    <video
                      autoPlay
                      controls
                      loop
                      muted
                      playsInline
                      src={image.videoUrl}
                    />
                  ) : (
                    <div className="gallery-video-placeholder">
                      Scene video will appear here after you render the full video.
                    </div>
                  )}
                </div>
              </div>
              <div className="gallery-caption">
                <span className="prompt-index">
                  Frame {String(index + 1).padStart(2, '0')}
                </span>
                {image.videoUrl ? (
                  <span className="gallery-video-badge">
                    Scene video preview {image.videoDurationInSeconds ? `· ${image.videoDurationInSeconds}s` : ''}
                  </span>
                ) : null}
                <div className="gallery-caption-group">
                  <strong>Image prompt</strong>
                  <p>{image.promptText}</p>
                </div>
                {image.videoPromptText ? (
                  <div className="gallery-caption-group">
                    <strong>Image-to-video prompt</strong>
                    <p>{image.videoPromptText}</p>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
