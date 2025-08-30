/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useCallback } from 'react';
import { UploadIcon, XMarkIcon } from './icons';

interface FusionPanelProps {
  onApplyFusion: (sourceImages: File[], prompt: string, count: number, variationIntensity?: string) => void;
  isLoading: boolean;
  onError: (message: string) => void;
  fusionResults?: string[];
  onApplyResult?: (imageUrl: string) => void;
}

const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const FusionPanel: React.FC<FusionPanelProps> = ({ onApplyFusion, isLoading, onError, fusionResults, onApplyResult }) => {
  const [sourceImageFile1, setSourceImageFile1] = useState<File | null>(null);
  const [sourceImageFile2, setSourceImageFile2] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [imageCount, setImageCount] = useState(1);
  const [showVariationHint, setShowVariationHint] = useState(false);
  const [variationIntensity, setVariationIntensity] = useState<'subtle' | 'moderate' | 'dramatic'>('moderate');
  
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const handleApply = () => {
    const sourceFiles = [sourceImageFile1, sourceImageFile2].filter(Boolean) as File[];
    if (sourceFiles.length > 0 && prompt.trim()) {
        onApplyFusion(sourceFiles, prompt, imageCount, variationIntensity);
    }
  };

  const ImageUploader: React.FC<{
    id: number;
    file: File | null;
    setFile: (file: File | null) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
  }> = ({ id, file, setFile, fileInputRef }) => {
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const imageSrc = file ? URL.createObjectURL(file) : null;

    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            const selectedFile = files[0];
            if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
                onError(`素材图文件大小不能超过 ${MAX_FILE_SIZE_MB}MB。请选择一个较小的文件。`);
                return;
            }
            onError(''); // Clear previous errors
            setFile(selectedFile);
        }
    };

    const handleClearImage = useCallback(() => {
        setFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [setFile, fileInputRef]);

    return (
        <div 
            className={`w-full p-4 border-2 rounded-lg transition-all duration-200 flex-1 ${isDraggingOver ? 'border-dashed border-blue-400 bg-blue-500/10' : 'border-gray-600'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                handleFileSelect(e.dataTransfer.files);
            }}
        >
            {!imageSrc ? (
                <div className="flex flex-col items-center justify-center text-center text-gray-400 py-8 h-full">
                    <UploadIcon className="w-8 h-8 mb-2" />
                    <p className="font-semibold">上传素材图 {id}</p>
                    <p className="text-xs">拖放文件或 <span className="text-blue-400 font-semibold cursor-pointer" onClick={() => fileInputRef.current?.click()}>点击浏览</span></p>
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e.target.files)} />
                </div>
            ) : (
                <div className="relative group flex items-center justify-center h-full">
                    <img src={imageSrc} alt={`Source for fusion ${id}`} className="w-auto h-32 mx-auto rounded-md object-contain" />
                    <button 
                        onClick={handleClearImage}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove source image ${id}`}
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
  }

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-gray-300">智能合成</h3>
      <p className="text-sm text-gray-400 -mt-2">上传一或两张素材图，然后描述如何将它们结合。</p>

      <div className="w-full flex flex-col md:flex-row gap-4">
        <ImageUploader id={1} file={sourceImageFile1} setFile={setSourceImageFile1} fileInputRef={fileInputRef1} />
        <ImageUploader id={2} file={sourceImageFile2} setFile={setSourceImageFile2} fileInputRef={fileInputRef2} />
      </div>
      
      {/* 数量选择器 */}
      <div className="w-full flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">生成数量：</span>
          <div className="flex gap-2">
            {[1, 2, 4, 8, 12].map(count => (
              <button
                key={count}
                onClick={() => {
                  setImageCount(count);
                  setShowVariationHint(count > 1);
                }}
                className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${
                  imageCount === count 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                disabled={isLoading}
              >
                {count}张
              </button>
            ))}
          </div>
          {imageCount > 1 && (
            <span className="text-xs text-gray-500 ml-2">
              (将产生{imageCount}倍API费用)
            </span>
          )}
        </div>
        {showVariationHint && imageCount > 1 && (
          <div className="text-xs text-amber-400 bg-amber-900/20 px-3 py-1 rounded-lg">
            💡 将生成 {imageCount} 个不同版本供您选择
          </div>
        )}
      </div>
      
      {/* 变化强度选择器 */}
      {imageCount > 1 && (
        <div className="w-full flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">变化强度：</span>
            <div className="flex gap-2">
              {[
                { key: 'subtle', label: '微调', desc: '轻微变化' },
                { key: 'moderate', label: '中等', desc: '明显变化' },
                { key: 'dramatic', label: '强烈', desc: '大幅变化' }
              ].map(intensity => (
                <button
                  key={intensity.key}
                  onClick={() => setVariationIntensity(intensity.key as 'subtle' | 'moderate' | 'dramatic')}
                  className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${
                    variationIntensity === intensity.key 
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  disabled={isLoading}
                  title={intensity.desc}
                >
                  {intensity.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div className="w-full flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例如，把图1的人物放到主图中，并用图2的风格渲染"
          className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
          disabled={isLoading || (!sourceImageFile1 && !sourceImageFile2)}
        />
        <button
          onClick={handleApply}
          className="bg-gradient-to-br from-purple-600 to-purple-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-purple-800 disabled:to-purple-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
          disabled={isLoading || !prompt.trim() || (!sourceImageFile1 && !sourceImageFile2)}
        >
          {isLoading ? `生成中... (${imageCount}张)` : `合成`}
        </button>
      </div>

      {/* 结果展示网格 */}
      {fusionResults && fusionResults.length > 0 && (
        <div className="w-full mt-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">生成结果：</h4>
          <div className={`grid gap-3 ${
            fusionResults.length === 1 ? 'grid-cols-1' : 
            fusionResults.length === 2 ? 'grid-cols-2' : 
            fusionResults.length <= 8 ? 'grid-cols-2 md:grid-cols-4' :
            'grid-cols-3 md:grid-cols-4'
          }`}>
            {fusionResults.map((result, index) => (
              <div key={index} className="relative group">
                <img 
                  src={result} 
                  alt={`合成结果 ${index + 1}`}
                  className="w-full h-auto rounded-lg shadow-lg"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  {onApplyResult && (
                    <button
                      onClick={() => onApplyResult(result)}
                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      应用
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = result;
                      
                      // 生成时间戳格式 yymmdd-hhmmss
                      const now = new Date();
                      const timestamp = [
                        String(now.getFullYear()).slice(-2).padStart(2, '0'), // yy
                        String(now.getMonth() + 1).padStart(2, '0'), // mm
                        String(now.getDate()).padStart(2, '0') // dd
                      ].join('') + '-' + [
                        String(now.getHours()).padStart(2, '0'), // hh
                        String(now.getMinutes()).padStart(2, '0'), // mm
                        String(now.getSeconds()).padStart(2, '0') // ss
                      ].join('');
                      
                      link.download = `fusion_${index + 1}_${timestamp}.jpg`;
                      link.click();
                    }}
                    className="px-3 py-1 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    下载
                  </button>
                  <button
                    onClick={() => {
                      if (result.startsWith('data:')) {
                        fetch(result)
                          .then(res => res.blob())
                          .then(blob => {
                            const blobUrl = URL.createObjectURL(blob);
                            window.open(blobUrl, '_blank');
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                          });
                      } else {
                        window.open(result, '_blank');
                      }
                    }}
                    className="px-3 py-1 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    放大
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FusionPanel;