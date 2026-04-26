import { useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '~/lib/utils';

interface ProseImageProps {
  src: string;
  alt?: string;
}

export function ProseImage({ src, alt }: ProseImageProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  // Handle scheme placeholder for theme-aware images
  const { theme } = useTheme();
  const resolvedSrc = src.replace('{scheme}', theme === 'dark' ? 'dark' : 'light');

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStartPos.x,
        y: e.clientY - dragStartPos.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.5, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.5, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleImageClick = () => setIsOpen(true);
  const handleImageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setIsOpen(true);
    }
  };

  const handleModalClick = () => setIsOpen(false);
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handlePreviewImageClick = (e: React.MouseEvent) => e.stopPropagation();
  const handlePreviewImageKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <img
        src={resolvedSrc}
        alt={alt}
        className="cursor-zoom-in rounded-lg my-4 max-w-full h-auto"
        onClick={handleImageClick}
        onKeyDown={handleImageKeyDown}
        loading="lazy"
      />

      {isOpen && (
        // biome-ignore lint/a11y/noStaticElementInteractions: Modal backdrop needs click handler to close
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={handleModalClick}
          onKeyDown={handleModalKeyDown}
          tabIndex={-1}
        >
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 rounded bg-white/10 hover:bg-white/20 text-white"
              aria-label="放大"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 rounded bg-white/10 hover:bg-white/20 text-white"
              aria-label="缩小"
            >
              -
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded bg-white/10 hover:bg-white/20 text-white"
              aria-label="重置"
            >
              ↺
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-2 rounded bg-white/10 hover:bg-white/20 text-white"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>

          <img
            src={resolvedSrc}
            alt={alt}
            className={cn('max-w-[90vw] max-h-[90vh] object-contain cursor-move', isDragging ? 'grabbing' : 'grab')}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handlePreviewImageClick}
            onKeyDown={handlePreviewImageKeyDown}
          />
        </div>
      )}
    </>
  );
}
