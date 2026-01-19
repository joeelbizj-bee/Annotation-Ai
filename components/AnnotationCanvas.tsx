import React, { useRef, useState, useEffect, MouseEvent } from 'react';
import { Annotation, BoundingBox } from '../types';
import { Trash2, MousePointer2 } from 'lucide-react';

interface Props {
  imageUrl: string;
  annotations: Annotation[];
  onAddAnnotation: (box: BoundingBox) => void;
  onSelectAnnotation: (id: string | null) => void;
  onDeleteAnnotation: (id: string) => void;
  selectedId: string | null;
}

export const AnnotationCanvas: React.FC<Props> = ({
  imageUrl,
  annotations,
  onAddAnnotation,
  onSelectAnnotation,
  onDeleteAnnotation,
  selectedId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<Partial<BoundingBox> | null>(null);

  // Helper to get relative coordinates (0-100 percentage)
  const getCoords = (e: MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handleMouseDown = (e: MouseEvent) => {
    // Prevent drawing if clicking on an existing box handler or close button
    if ((e.target as HTMLElement).closest('.annotation-box')) return;
    
    e.preventDefault();
    const { x, y } = getCoords(e);
    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentBox({ x, y, width: 0, height: 0 });
    onSelectAnnotation(null);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDrawing) return;
    const { x, y } = getCoords(e);
    
    const width = Math.abs(x - startPos.x);
    const height = Math.abs(y - startPos.y);
    const newX = Math.min(x, startPos.x);
    const newY = Math.min(y, startPos.y);

    setCurrentBox({ x: newX, y: newY, width, height });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) return;
    setIsDrawing(false);
    
    // Only add if box has significant size (> 2%)
    if ((currentBox.width || 0) > 2 && (currentBox.height || 0) > 2) {
      onAddAnnotation({
        id: crypto.randomUUID(),
        x: currentBox.x || 0,
        y: currentBox.y || 0,
        width: currentBox.width || 0,
        height: currentBox.height || 0,
      });
    }
    setCurrentBox(null);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-slate-900 overflow-hidden cursor-crosshair select-none flex items-center justify-center border border-slate-700 rounded-lg shadow-inner"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setIsDrawing(false); setCurrentBox(null); }}
    >
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt="Work Area" 
          className="max-w-full max-h-full object-contain pointer-events-none select-none"
        />
      ) : (
        <div className="text-slate-500 flex flex-col items-center">
          <MousePointer2 className="w-12 h-12 mb-2 opacity-50" />
          <p>No image selected</p>
        </div>
      )}

      {/* Existing Annotations */}
      {annotations.map((ann) => (
        <div
          key={ann.id}
          className={`annotation-box absolute border-2 flex items-start justify-end group transition-all duration-75
            ${selectedId === ann.id ? 'border-yellow-400 z-20 bg-yellow-400/10' : 'border-blue-500 z-10 hover:border-blue-400'}
          `}
          style={{
            left: `${ann.x}%`,
            top: `${ann.y}%`,
            width: `${ann.width}%`,
            height: `${ann.height}%`,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onSelectAnnotation(ann.id);
          }}
        >
          {selectedId === ann.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteAnnotation(ann.id);
              }}
              className="bg-red-500 hover:bg-red-600 text-white p-1 rounded-bl shadow-sm -mt-[2px] -mr-[2px]"
              title="Delete Region"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <span className="absolute bottom-full left-0 bg-black/70 text-white text-[10px] px-1 truncate max-w-full">
            {ann.metadata.name || 'Untitled'}
          </span>
        </div>
      ))}

      {/* Drawing Box */}
      {currentBox && (
        <div
          className="absolute border-2 border-green-500 bg-green-500/20 z-30 pointer-events-none"
          style={{
            left: `${currentBox.x}%`,
            top: `${currentBox.y}%`,
            width: `${currentBox.width}%`,
            height: `${currentBox.height}%`,
          }}
        />
      )}
    </div>
  );
};