import React from 'react';
import { createPortal } from 'react-dom';
import { X, HelpCircle, Zap, Shield, Cpu, Globe } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 animate-in zoom-in-50 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-red-500" />
            What is Farterrogator?
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          <section>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
              <span className="font-bold text-slate-900 dark:text-slate-100">Farterrogator</span> is an advanced AI image interrogation tool designed to analyze images and extract detailed metadata, tags, and natural language descriptions. It helps artists, developers, and enthusiasts understand the content of their images and prepare them for further AI processing.
            </p>
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Dual Analysis Modes
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Choose between <strong>Google Gemini</strong> for cloud-based state-of-the-art analysis, or <strong>Pixai</strong> which combines a WD1.4 Tagger with Ollama (Vision Models) hosted on <strong>gpu.garden</strong>.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-500" />
                NAI Ready Embedding
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Automatically embed generated tags or descriptions into PNG metadata. The resulting images are "NAI Ready" - simply drag them into NovelAI to autopopulate prompts with the analyzed data.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-500" />
                Privacy & Security
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                In Pixai mode, your images are processed securely on <strong>gpu.garden</strong> via the <strong>Fartcore data center</strong>. While not running on your device, your data is handled with strict privacy standards.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-500" />
                GPU Garden Integration
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Optimized for use with GPU Garden's infrastructure, allowing for seamless proxying to remote GPU instances for heavy lifting.
              </p>
            </div>
          </div>

          <section className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">How to use</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>Upload an image or drag & drop one onto the canvas.</li>
              <li>Select your preferred backend (Gemini or Pixai).</li>
              <li>Adjust confidence thresholds to filter tags.</li>
              <li>Click <strong>Start Interrogation</strong>.</li>
              <li>Copy tags, or download an <strong>NAI Ready</strong> PNG to use in your workflow.</li>
            </ol>
          </section>
        </div>
        
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-center">
          <p className="text-xs text-slate-500">
            Made by <a href="https://mooshieblob.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors">Mooshieblob</a>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};
