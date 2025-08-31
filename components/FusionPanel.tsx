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
  fusionProgress?: { current: number; total: number } | null;
}

const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const FusionPanel: React.FC<FusionPanelProps> = ({ onApplyFusion, isLoading, onError, fusionResults, onApplyResult, fusionProgress }) => {
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
            {[1, 2, 4, 8, 12, 24, 48, 96, 128].map(count => (
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
          {isLoading ? (
            fusionProgress 
              ? `生成中... ${fusionProgress.current}/${fusionProgress.total}` 
              : `生成中... (${imageCount}张)`
          ) : `合成`}
        </button>
      </div>

      {/* 结果展示网格 */}
      {fusionResults && fusionResults.length > 0 && (
        <div className="w-full mt-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">生成结果：</h4>
          <div className={`grid gap-3 ${
            fusionResults.length === 1 ? 'grid-cols-1' : 
            fusionResults.length === 2 ? 'grid-cols-2' : 
            fusionResults.length <= 4 ? 'grid-cols-2 md:grid-cols-2' :
            fusionResults.length <= 12 ? 'grid-cols-2 md:grid-cols-4' :
            fusionResults.length <= 24 ? 'grid-cols-3 md:grid-cols-6' :
            fusionResults.length <= 48 ? 'grid-cols-4 md:grid-cols-8' :
            'grid-cols-5 md:grid-cols-10'
          }`}>
            {fusionResults.map((result, index) => {
              // 检查是否是错误占位符
              const isError = result.includes('#error=');
              let errorMessage = '';
              let imageUrl = result;
              
              if (isError) {
                const parts = result.split('#error=');
                imageUrl = parts[0];
                try {
                  errorMessage = decodeURIComponent(parts[1]);
                } catch {
                  errorMessage = '生成失败';
                }
              }
              
              return (
                <div key={index} className="relative group">
                  {isError ? (
                    // 错误状态显示
                    <div className="w-full aspect-square bg-gray-800 rounded-lg shadow-lg flex flex-col items-center justify-center p-4">
                      <div className="text-red-500 mb-2">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-gray-400 text-sm text-center">
                        图片 {index + 1} 失败
                      </div>
                      <div className="text-gray-500 text-xs text-center mt-1">
                        {errorMessage.includes('PROHIBITED_CONTENT') ? '内容被安全过滤' : 
                         errorMessage.includes('API 响应中没有内容') ? 'API 响应错误' :
                         errorMessage.substring(0, 50)}
                      </div>
                    </div>
                  ) : (
                    // 正常图片显示
                    <>
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
                      // 创建包含所有图片和功能的HTML页面
                      const htmlContent = `
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>图片查看器</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: black;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .header {
      background: rgba(0,0,0,0.8);
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      backdrop-filter: blur(8px);
      z-index: 10;
    }
    .left-controls {
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .image-counter {
      font-size: 18px;
      font-weight: 600;
    }
    .rating-section {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .rating-label {
      color: #9ca3af;
      font-size: 14px;
    }
    .rating-buttons {
      display: flex;
      gap: 4px;
    }
    .rating-btn {
      background: #374151;
      color: #d1d5db;
      border: none;
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }
    .rating-btn:hover {
      background: #4b5563;
    }
    .rating-btn.active {
      background: #eab308;
      color: black;
      font-weight: bold;
    }
    .save-btn {
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .save-btn:hover {
      background: #1d4ed8;
    }
    .close-btn {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 8px;
    }
    .close-btn:hover {
      color: #d1d5db;
    }
    .main-area {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .nav-btn {
      position: absolute;
      background: rgba(255,255,255,0.1);
      border: none;
      color: white;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .nav-btn:hover {
      background: rgba(255,255,255,0.2);
    }
    .nav-btn.prev {
      left: 16px;
    }
    .nav-btn.next {
      right: 16px;
    }
    .main-image {
      max-width: 100%;
      max-height: 100%;
      cursor: pointer;
      transition: transform 0.3s;
    }
    .main-image.zoomed {
      transform: scale(1.5);
    }
    .hint {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.6);
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
    }
    .indicators {
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 16px;
      background: rgba(0,0,0,0.8);
    }
    .indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #6b7280;
      cursor: pointer;
      transition: all 0.2s;
    }
    .indicator.active {
      background: white;
      width: 32px;
      border-radius: 16px;
    }
    .indicator:hover {
      background: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="left-controls">
      <div class="image-counter">
        <span id="current-num">1</span> / <span id="total-num">1</span>
      </div>
      
      <div class="rating-section">
        <span class="rating-label">评分：</span>
        <div class="rating-buttons">
          <button class="rating-btn active" onclick="setRating(5)" id="rating-5">5★</button>
          <button class="rating-btn" onclick="setRating(4)" id="rating-4">4★</button>
          <button class="rating-btn" onclick="setRating(3)" id="rating-3">3★</button>
        </div>
      </div>

      <button class="save-btn" onclick="saveImage()">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        保存
      </button>
    </div>

    <button class="close-btn" onclick="window.close()">✕</button>
  </div>

  <div class="main-area">
    <button class="nav-btn prev" id="prev-btn" onclick="prevImage()">
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
      </svg>
    </button>

    <img id="main-image" class="main-image" onclick="toggleZoom()" alt="查看图片">

    <button class="nav-btn next" id="next-btn" onclick="nextImage()">
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
      </svg>
    </button>

    <div class="hint" id="hint">点击图片放大 | 使用 ← → 切换图片</div>
  </div>

  <div class="indicators" id="indicators"></div>

  <script>
    const images = ${JSON.stringify(fusionResults)};
    let currentIndex = ${index};
    let isZoomed = false;
    let ratings = {};
    
    // 设置默认评分为5星
    for (let i = 0; i < images.length; i++) {
      ratings[i] = 5;
    }

    function updateDisplay() {
      const img = document.getElementById('main-image');
      img.src = images[currentIndex];
      
      document.getElementById('current-num').textContent = currentIndex + 1;
      document.getElementById('total-num').textContent = images.length;
      
      // 更新导航按钮可见性
      document.getElementById('prev-btn').style.display = currentIndex > 0 ? 'flex' : 'none';
      document.getElementById('next-btn').style.display = currentIndex < images.length - 1 ? 'flex' : 'none';
      
      // 更新指示器
      updateIndicators();
      
      // 更新评分显示
      updateRatingDisplay();
      
      // 重置缩放
      isZoomed = false;
      img.className = 'main-image';
      document.getElementById('hint').textContent = '点击图片放大 | 使用 ← → 切换图片';
    }

    function updateIndicators() {
      const container = document.getElementById('indicators');
      container.innerHTML = '';
      
      for (let i = 0; i < images.length; i++) {
        const indicator = document.createElement('div');
        indicator.className = 'indicator' + (i === currentIndex ? ' active' : '');
        indicator.onclick = () => {
          currentIndex = i;
          updateDisplay();
        };
        container.appendChild(indicator);
      }
    }

    function updateRatingDisplay() {
      const currentRating = ratings[currentIndex];
      [3, 4, 5].forEach(rating => {
        const btn = document.getElementById('rating-' + rating);
        btn.className = 'rating-btn' + (rating === currentRating ? ' active' : '');
      });
    }

    function prevImage() {
      if (currentIndex > 0) {
        currentIndex--;
        updateDisplay();
      }
    }

    function nextImage() {
      if (currentIndex < images.length - 1) {
        currentIndex++;
        updateDisplay();
      }
    }

    function toggleZoom() {
      const img = document.getElementById('main-image');
      isZoomed = !isZoomed;
      img.className = 'main-image' + (isZoomed ? ' zoomed' : '');
      document.getElementById('hint').textContent = isZoomed ? '点击图片缩小' : '点击图片放大 | 使用 ← → 切换图片';
    }

    function setRating(rating) {
      ratings[currentIndex] = rating;
      updateRatingDisplay();
    }

    function saveImage() {
      const link = document.createElement('a');
      link.href = images[currentIndex];
      
      const now = new Date();
      const timestamp = [
        String(now.getFullYear()).slice(-2).padStart(2, '0'),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
      ].join('') + '-' + [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0')
      ].join('');
      
      const rating = ratings[currentIndex];
      const ratingSuffix = '_' + rating + '-Stars';
      link.download = 'fusion_' + (currentIndex + 1) + '_' + timestamp + ratingSuffix + '.jpg';
      link.click();
    }

    // 键盘快捷键
    document.addEventListener('keydown', function(e) {
      switch(e.key) {
        case 'ArrowLeft':
          prevImage();
          break;
        case 'ArrowRight':
          nextImage();
          break;
        case ' ':
          e.preventDefault();
          toggleZoom();
          break;
        case 'Escape':
          window.close();
          break;
      }
    });

    // 初始化
    updateDisplay();
  </script>
</body>
</html>`;
                      
                      const blob = new Blob([htmlContent], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                    className="px-3 py-1 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    放大
                  </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FusionPanel;