import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Image as ImageIcon, X, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  selectedImage: File | null;
  onClear: () => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSelect, selectedImage, onClear }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const resizeImageIfNeeded = async (file: File): Promise<File> => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size <= MAX_SIZE) return file;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = async () => {
        URL.revokeObjectURL(img.src);
        let width = img.width;
        let height = img.height;
        let blob: Blob | null = null;
        
        const canvas = document.createElement('canvas');
        let attempts = 0;
        
        // Loop to downscale until under limit
        while (attempts < 10) {
             // Calculate scale factor based on area if we want to be smarter, 
             // but simple iterative reduction is robust.
             // If it's WAY too big, step down faster?
             // Let's just do 0.85x dimension reduction per step (approx 0.72x area)
             
             if (attempts > 0) {
                width = Math.floor(width * 0.85);
                height = Math.floor(height * 0.85);
             }

             canvas.width = width;
             canvas.height = height;
             const ctx = canvas.getContext('2d');
             if (!ctx) { reject(new Error('Canvas context failed')); return; }
             
             // Better quality scaling
             ctx.imageSmoothingEnabled = true;
             ctx.imageSmoothingQuality = 'high';
             ctx.drawImage(img, 0, 0, width, height);
             
             const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
             // For JPEG we could adjust quality, but for PNG we must resize.
             // We'll use 0.9 quality for JPEG as a baseline.
             
             blob = await new Promise<Blob | null>(r => canvas.toBlob(r, mimeType, 0.9));
             
             if (blob && blob.size <= MAX_SIZE) {
                 resolve(new File([blob], file.name, { type: mimeType }));
                 return;
             }
             
             attempts++;
        }
        
        // Fallback: return the last blob we managed to make, even if slightly over (unlikely after 10 steps of 0.85)
        if (blob) {
             resolve(new File([blob], file.name, { type: file.type }));
        } else {
             resolve(file);
        }
      };
      img.onerror = reject;
    });
  };

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    setIsProcessing(true);
    try {
      const processedFile = await resizeImageIfNeeded(file);
      const url = URL.createObjectURL(processedFile);
      setPreviewUrl(url);
      onImageSelect(processedFile);
    } catch (error) {
      console.error("Error processing file:", error);
      // Fallback to original if processing fails
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      onImageSelect(file);
    } finally {
      setIsProcessing(false);
    }
  }, [onImageSelect]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      processFile(event.target.files[0]);
    }
  };

  // Paste event listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          processFile(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleClear = () => {
    setPreviewUrl(null);
    onClear();
  };


  if (selectedImage && previewUrl) {
    return (
      <div className="relative group w-full h-full min-h-[300px] bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center transition-colors duration-300">
        <img 
          src={previewUrl} 
          alt="Preview" 
          className="max-w-full max-h-[600px] object-contain"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
        <button 
          onClick={handleClear}
          className="absolute top-4 right-4 p-2 bg-white/90 dark:bg-slate-900/80 text-slate-600 dark:text-slate-200 rounded-full hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-colors border border-slate-200 dark:border-slate-700 backdrop-blur-sm opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 duration-200"
        >
          <X className="w-5 h-5" />
        </button>
        {isProcessing && (
           <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-20">
              <div className="flex flex-col items-center gap-2 text-white">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm font-medium">Optimizing image...</span>
              </div>
           </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`
        relative w-full h-[400px] rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-4
        ${isDragging 
          ? 'border-red-500 bg-red-500/10 dark:bg-red-500/10' 
          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-400 dark:hover:border-slate-600'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        disabled={isProcessing}
      />
      
      <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-300">
        {isProcessing ? (
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        ) : (
          <Upload className={`w-8 h-8 ${isDragging ? 'text-red-500 dark:text-red-400' : 'text-slate-400'}`} />
        )}
      </div>
      
      <div className="text-center space-y-1 pointer-events-none">
        <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
          {isProcessing ? 'Processing image...' : 'Drop image here, paste (Ctrl+V), or click to upload'}
        </p>
        <p className="text-sm text-slate-500">
          Supports JPG, PNG, WEBP (Max 10MB, auto-resized)
        </p>
      </div>
    </div>
  );
};