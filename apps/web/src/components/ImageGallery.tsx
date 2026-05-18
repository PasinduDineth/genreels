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
              <div className="gallery-media">
                <img alt={`Generated frame ${index + 1}`} src={image.url} />
              </div>
              <div className="gallery-caption">
                <span className="prompt-index">
                  Frame {String(index + 1).padStart(2, '0')}
                </span>
                <p>{image.promptText}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
