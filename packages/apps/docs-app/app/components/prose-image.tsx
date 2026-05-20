import { useEffect, useRef, useState } from 'react';
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
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
  const imageRef = useRef<HTMLImageElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      hasOpenedRef.current = true;
      dialogRef.current?.focus();
      return;
    }

    if (hasOpenedRef.current) {
      imageRef.current?.focus();
    }
  }, [isOpen]);

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
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleModalClick = () => handleClose();
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
    if (e.key === '+' || e.key === '=') {
      handleZoomIn();
    }
    if (e.key === '-') {
      handleZoomOut();
    }
    if (e.key === '0') {
      handleReset();
    }
  };

  const handlePreviewImageClick = (e: React.MouseEvent) => e.stopPropagation();
  const handlePreviewImageKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className="cursor-zoom-in rounded-lg my-4 max-w-full h-auto"
        onClick={handleImageClick}
        onKeyDown={handleImageKeyDown}
        loading="lazy"
        role="button"
        tabIndex={0}
      />

      {isOpen && (
        // biome-ignore lint/a11y/noStaticElementInteractions: Modal backdrop needs click handler to close
        <div
          ref={dialogRef}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={handleModalClick}
          onKeyDown={handleModalKeyDown}
          tabIndex={0}
        >
          <div className="absolute top-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 rounded bg-white/10 hover:bg-white/20 text-white"
              aria-label="放大"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 rounded bg-white/10 hover:bg-white/20 text-white"
              aria-label="缩小"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded bg-white/10 hover:bg-white/20 text-white"
              aria-label="重置"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded bg-white/10 hover:bg-white/20 text-white"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <img
            src={src}
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
