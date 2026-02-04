import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, Move } from "lucide-react";

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
  open: boolean;
}

export function ImageCropper({ imageSrc, onCropComplete, onCancel, open }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const CROP_SIZE = 256; // Output size
  const DISPLAY_SIZE = 280; // Display size in the dialog

  // Load image when source changes
  useEffect(() => {
    if (!imageSrc) return;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);
      // Calculate initial zoom to fill the crop area
      const minDimension = Math.min(img.width, img.height);
      const initialZoom = DISPLAY_SIZE / minDimension;
      setZoom(Math.max(initialZoom, 0.5));
      setPosition({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Draw preview
  useEffect(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = DISPLAY_SIZE;
    canvas.height = DISPLAY_SIZE;

    // Clear canvas
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);

    // Calculate scaled dimensions
    const scaledWidth = image.width * zoom;
    const scaledHeight = image.height * zoom;

    // Center the image and apply position offset
    const x = (DISPLAY_SIZE - scaledWidth) / 2 + position.x;
    const y = (DISPLAY_SIZE - scaledHeight) / 2 + position.y;

    // Draw image
    ctx.drawImage(image, x, y, scaledWidth, scaledHeight);

    // Draw circular overlay
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.arc(DISPLAY_SIZE / 2, DISPLAY_SIZE / 2, DISPLAY_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  }, [image, zoom, position]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !image) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Calculate bounds to keep image within crop area
    const scaledWidth = image.width * zoom;
    const scaledHeight = image.height * zoom;
    const maxX = Math.max(0, (scaledWidth - DISPLAY_SIZE) / 2);
    const maxY = Math.max(0, (scaledHeight - DISPLAY_SIZE) / 2);
    
    setPosition({
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxY, Math.min(maxY, newY))
    });
  }, [isDragging, dragStart, image, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !image || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const newX = touch.clientX - dragStart.x;
    const newY = touch.clientY - dragStart.y;
    
    const scaledWidth = image.width * zoom;
    const scaledHeight = image.height * zoom;
    const maxX = Math.max(0, (scaledWidth - DISPLAY_SIZE) / 2);
    const maxY = Math.max(0, (scaledHeight - DISPLAY_SIZE) / 2);
    
    setPosition({
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxY, Math.min(maxY, newY))
    });
  }, [isDragging, dragStart, image, zoom]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleCrop = useCallback(async () => {
    if (!image) return;
    setIsProcessing(true);
    
    try {
      // Create output canvas
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = CROP_SIZE;
      outputCanvas.height = CROP_SIZE;
      const ctx = outputCanvas.getContext("2d");
      if (!ctx) return;

      // Calculate the source region based on zoom and position
      const scaledWidth = image.width * zoom;
      const scaledHeight = image.height * zoom;
      
      // Position of the image center relative to the crop area center
      const imgCenterX = (DISPLAY_SIZE - scaledWidth) / 2 + position.x + scaledWidth / 2;
      const imgCenterY = (DISPLAY_SIZE - scaledHeight) / 2 + position.y + scaledHeight / 2;
      
      // Calculate source coordinates
      const cropCenterX = DISPLAY_SIZE / 2;
      const cropCenterY = DISPLAY_SIZE / 2;
      
      const offsetX = (cropCenterX - imgCenterX) / zoom;
      const offsetY = (cropCenterY - imgCenterY) / zoom;
      
      const sourceSize = DISPLAY_SIZE / zoom;
      const sourceX = image.width / 2 + offsetX - sourceSize / 2;
      const sourceY = image.height / 2 + offsetY - sourceSize / 2;

      // Draw with circular clip
      ctx.beginPath();
      ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
      
      ctx.drawImage(
        image,
        sourceX, sourceY, sourceSize, sourceSize,
        0, 0, CROP_SIZE, CROP_SIZE
      );

      // Convert to blob
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            onCropComplete(blob);
          }
          setIsProcessing(false);
        },
        "image/webp",
        0.9
      );
    } catch (error) {
      console.error("Error cropping image:", error);
      setIsProcessing(false);
    }
  }, [image, zoom, position, onCropComplete]);

  const handleZoomChange = (values: number[]) => {
    setZoom(values[0]);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profilbild zuschneiden</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Preview area */}
          <div 
            ref={containerRef}
            className="relative rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/30 cursor-move"
            style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <canvas 
              ref={canvasRef}
              style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
            />
            {/* Drag hint overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity bg-black/20">
              <Move className="h-8 w-8 text-white drop-shadow" />
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground text-center">
            Ziehen Sie das Bild, um den Fokus zu setzen
          </p>

          {/* Zoom slider */}
          <div className="w-full flex items-center gap-3 px-4">
            <ZoomOut className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[zoom]}
              onValueChange={handleZoomChange}
              min={0.5}
              max={3}
              step={0.1}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Abbrechen
          </Button>
          <Button onClick={handleCrop} disabled={!image || isProcessing}>
            {isProcessing ? "Wird verarbeitet..." : "Zuschneiden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
