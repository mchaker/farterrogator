import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Image as ImageIcon, X, Loader2, FileArchive, Files } from 'lucide-react';
import JSZip from 'jszip';
// @ts-ignore
import untar from 'js-untar';

interface ImageUploadProps {
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
  onClear: () => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onFilesSelect, selectedFiles, onClear }) => {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Cleanup preview URL on unmount or change
  useEffect(() => {
    if (selectedFiles.length === 1 && !previewUrl) {
        setPreviewUrl(URL.createObjectURL(selectedFiles[0]));
    }
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [selectedFiles, previewUrl]);

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

  const processFiles = useCallback(async (files: File[]) => {
    setIsProcessing(true);
    const processedImages: File[] = [];

    try {
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
           // Handle zip
           try {
             const zip = new JSZip();
             const content = await zip.loadAsync(file);
             for (const filename of Object.keys(content.files)) {
               const zipEntry = content.files[filename];
               if (!zipEntry.dir && (filename.match(/\.(png|jpg|jpeg|webp|gif)$/i))) {
                 const blob = await zipEntry.async('blob');
                 // Determine mime type from extension if blob.type is empty
                 let mimeType = blob.type;
                 if (!mimeType) {
                    const ext = filename.split('.').pop()?.toLowerCase();
                    if (ext === 'png') mimeType = 'image/png';
                    else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                    else if (ext === 'webp') mimeType = 'image/webp';
                    else if (ext === 'gif') mimeType = 'image/gif';
                 }
                 
                 const extractedFile = new File([blob], filename, { type: mimeType });
                 const resized = await resizeImageIfNeeded(extractedFile);
                 processedImages.push(resized);
               }
             }
           } catch (e) {
             console.error("Failed to unzip file:", file.name, e);
           }
        } else if (file.name.toLowerCase().endsWith('.tar')) {
           // Handle tar
           try {
             const arrayBuffer = await file.arrayBuffer();
             const files = await untar(arrayBuffer);
             for (const entry of files) {
               if (entry.name.match(/\.(png|jpg|jpeg|webp|gif)$/i)) {
                 const blob = new Blob([entry.buffer]);
                 let mimeType = blob.type;
                 if (!mimeType) {
                    const ext = entry.name.split('.').pop()?.toLowerCase();
                    if (ext === 'png') mimeType = 'image/png';
                    else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                    else if (ext === 'webp') mimeType = 'image/webp';
                    else if (ext === 'gif') mimeType = 'image/gif';
                 }
                 const extractedFile = new File([blob], entry.name, { type: mimeType });
                 const resized = await resizeImageIfNeeded(extractedFile);
                 processedImages.push(resized);
               }
             }
           } catch (e) {
             console.error("Failed to untar file:", file.name, e);
           }
        } else if (file.type.startsWith('image/')) {
           const resized = await resizeImageIfNeeded(file);
           processedImages.push(resized);
        }
      }
      
      if (processedImages.length > 0) {
        onFilesSelect(processedImages);
        if (processedImages.length === 1) {
           setPreviewUrl(URL.createObjectURL(processedImages[0]));
        } else {
           setPreviewUrl(null);
        }
      }
    } catch (error) {
      console.error("Error processing files:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [onFilesSelect]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      processFiles(Array.from(event.target.files));
    }
  };

  // Paste event listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        processFiles(Array.from(e.clipboardData.files));
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFiles]);

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, [processFiles]);

  const handleClear = () => {
    setPreviewUrl(null);
    onClear();
  };


  if (selectedFiles.length > 0) {
    return (
      <div className="relative group w-fit mx-auto bg-md-light-surface-1 dark:bg-md-dark-surface-1 rounded-[28px] overflow-hidden transition-colors duration-300 shadow-sm">
        {selectedFiles.length === 1 && previewUrl ? (
          <img 
            src={previewUrl} 
            alt={t('upload.previewAlt')}
            className="max-w-full max-h-[600px] w-auto h-auto block"
          />
        ) : (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-md-light-on-surface dark:text-md-dark-on-surface">
            <Files className="w-16 h-16 text-amber-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">{t('upload.filesSelected', { num: selectedFiles.length })}</p>
              <p className="text-sm text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">{t('upload.batchReady')}</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" aria-hidden="true" />
        <button 
          onClick={handleClear}
          className="absolute top-4 right-4 p-2 bg-md-light-surface/90 dark:bg-md-dark-surface/80 text-md-light-on-surface dark:text-md-dark-on-surface rounded-full hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-colors backdrop-blur-sm shadow-md opacity-100 duration-200"
          title={t('upload.clear')}
          aria-label={t('upload.clear')}
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
        {isProcessing && (
           <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-20" role="status" aria-live="polite">
              <div className="flex flex-col items-center gap-2 text-white">
                <Loader2 className="w-8 h-8 animate-spin" aria-hidden="true" />
                <span className="text-sm font-medium">{t('results.processing')}</span>
              </div>
           </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`
        relative w-full h-[400px] rounded-[28px] border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-4
        ${isDragging
          ? 'border-md-light-primary dark:border-md-dark-primary bg-md-light-primary-container/40 dark:bg-md-dark-primary-container/30'
          : 'border-md-light-outline-variant dark:border-md-dark-outline-variant bg-md-light-surface-1 dark:bg-md-dark-surface-1 hover:bg-md-light-surface-2 dark:hover:bg-md-dark-surface-2 hover:border-md-light-outline dark:hover:border-md-dark-outline'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label={t('upload.dragDrop')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          document.querySelector<HTMLInputElement>('input[type="file"]')?.click();
        }
      }}
    >
      <input 
        type="file" 
        accept="image/png, image/jpeg, image/webp, image/gif, application/zip, application/x-zip-compressed, application/x-tar"
        multiple
        onChange={handleFileChange} 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        disabled={isProcessing}
        title={t('upload.dragDrop')}
        aria-label={t('upload.dragDrop')}
        tabIndex={-1} // The parent div handles focus
      />
      
      <div className="p-5 rounded-full bg-md-light-primary-container dark:bg-md-dark-primary-container transition-colors duration-300" aria-hidden="true">
        {isProcessing ? (
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        ) : (
          <Upload className={`w-8 h-8 ${isDragging ? 'text-md-light-primary dark:text-md-dark-primary' : 'text-md-light-on-primary-container dark:text-md-dark-on-primary-container'}`} />
        )}
      </div>

      <div className="text-center space-y-1 pointer-events-none">
        <p className="text-sm font-medium text-md-light-on-surface dark:text-md-dark-on-surface">
          {isDragging ? t('upload.dropHere') : t('upload.dragDrop')}
        </p>
        <p className="text-xs text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">
          {t('upload.supports')} <span className="opacity-70">{t('upload.supportsArchives')}</span>
        </p>
      </div>
    </div>
  );
};