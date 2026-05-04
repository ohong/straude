"use client";

import Image from "next/image";

interface ImageGridProps {
  images: string[];
  maxVisible?: number;
  onImageClick: (index: number) => void;
}

const thumbnailFrameClassName =
  "relative block overflow-hidden rounded border border-border/35 bg-subtle";

function FeedImage({ src, sizes }: { src: string; sizes: string }) {
  return <Image src={src} alt="" fill className="object-contain" sizes={sizes} />;
}

export function ImageGrid({ images, maxVisible = 5, onImageClick }: ImageGridProps) {
  const count = images.length;
  if (count === 0) return null;

  const visible = images.slice(0, maxVisible);
  const remaining = count - maxVisible;

  function handleClick(e: React.MouseEvent, index: number) {
    e.stopPropagation();
    e.preventDefault();
    onImageClick(index);
  }

  if (count === 1) {
    return (
      <div className="mt-3">
        <button
          type="button"
          className={`${thumbnailFrameClassName} w-full aspect-[3/2]`}
          onClick={(e) => handleClick(e, 0)}
          aria-label="View image 1"
        >
          <FeedImage src={images[0]} sizes="(max-width: 768px) 100vw, 600px" />
        </button>
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {images.map((url, i) => (
          <button
            key={url}
            type="button"
            className={`${thumbnailFrameClassName} aspect-[4/3]`}
            onClick={(e) => handleClick(e, i)}
            aria-label={`View image ${i + 1}`}
          >
            <FeedImage src={url} sizes="300px" />
          </button>
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="mt-3 grid grid-cols-2 grid-rows-2 gap-1.5" style={{ height: "400px" }}>
        <button
          type="button"
          className={`${thumbnailFrameClassName} row-span-2`}
          onClick={(e) => handleClick(e, 0)}
          aria-label="View image 1"
        >
          <FeedImage src={images[0]} sizes="300px" />
        </button>
        {images.slice(1).map((url, i) => (
          <button
            key={url}
            type="button"
            className={thumbnailFrameClassName}
            onClick={(e) => handleClick(e, i + 1)}
            aria-label={`View image ${i + 2}`}
          >
            <FeedImage src={url} sizes="300px" />
          </button>
        ))}
      </div>
    );
  }

  if (count === 4) {
    return (
      <div className="mt-3 grid grid-cols-2 grid-rows-2 gap-1.5" style={{ height: "400px" }}>
        {images.map((url, i) => (
          <button
            key={url}
            type="button"
            className={thumbnailFrameClassName}
            onClick={(e) => handleClick(e, i)}
            aria-label={`View image ${i + 1}`}
          >
            <FeedImage src={url} sizes="300px" />
          </button>
        ))}
      </div>
    );
  }

  // 5+ images: tall left, 2x2 grid right with optional "+N" overlay
  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5" style={{ height: "400px" }}>
      <button
        type="button"
        className={thumbnailFrameClassName}
        onClick={(e) => handleClick(e, 0)}
        aria-label="View image 1"
      >
        <FeedImage src={visible[0]} sizes="300px" />
      </button>
      <div className="grid grid-cols-2 grid-rows-2 gap-1.5">
        {visible.slice(1).map((url, i) => {
          const isLast = i === 3 && remaining > 0;
          return (
            <button
              key={url}
              type="button"
              className={thumbnailFrameClassName}
              onClick={(e) => handleClick(e, i + 1)}
              aria-label={`View image ${i + 2}${isLast ? `, plus ${remaining} more` : ""}`}
            >
              <FeedImage src={url} sizes="150px" />
              {isLast && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-xl font-semibold text-white">+{remaining}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
