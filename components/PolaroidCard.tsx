/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion, useAnimation } from 'framer-motion';
import { RefreshIcon, MagnifyPlusIcon, DownloadSingleIcon } from './icons';
import Spinner from './Spinner';

type ImageStatus = 'pending' | 'done' | 'error';
type GeneratedImage = {
    status: ImageStatus;
    url?: string;
    error?: string;
};

interface PolaroidCardProps {
    decade: string;
    imageState: GeneratedImage;
    onRegenerate: () => void;
    dragConstraints?: React.RefObject<HTMLDivElement>;
    initialPosition?: { top: string; left: string; rotate: number };
    isMobile?: boolean;
}

const PolaroidCard: React.FC<PolaroidCardProps> = ({
    decade,
    imageState,
    onRegenerate,
    dragConstraints,
    initialPosition,
    isMobile = false
}) => {
    const controls = useAnimation();

    const handleShake = () => {
        if (imageState.status === 'done') {
            controls.start({
                x: [0, -10, 10, -10, 10, 0],
                rotate: [0, -5, 5, -5, 5, 0],
                transition: { duration: 0.5 },
            });
        }
    };

    const handleDownload = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        if (imageState.status === 'done' && imageState.url) {
            const link = document.createElement('a');
            link.href = imageState.url;
            link.download = `${decade}-style-image.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleZoom = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (imageState.status === 'done' && imageState.url) {
            // 如果是 data URL，转换为 blob URL 再打开
            if (imageState.url.startsWith('data:')) {
                try {
                    // 将 data URL 转换为 blob
                    fetch(imageState.url)
                        .then(res => res.blob())
                        .then(blob => {
                            const blobUrl = URL.createObjectURL(blob);
                            window.open(blobUrl, '_blank');
                            // 清理 blob URL（延迟一下确保标签页能加载）
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                        })
                        .catch(err => {
                            console.error('Failed to create blob URL:', err);
                            // 回退到直接打开 data URL
                            window.open(imageState.url, '_blank');
                        });
                } catch (err) {
                    console.error('Failed to process data URL:', err);
                    window.open(imageState.url, '_blank');
                }
            } else {
                // 对于普通 URL，直接打开
                window.open(imageState.url, '_blank');
            }
        }
    };

    const cardContent = () => {
        switch (imageState?.status) {
            case 'pending':
                return (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800">
                        <Spinner className="w-10 h-10 text-gray-400" />
                        <p className="text-gray-400 mt-2 text-sm">Generating...</p>
                    </div>
                );
            case 'error':
                return (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-red-900/50 p-2 text-center">
                        <p className="text-red-300 text-xs font-bold mb-2">Generation Failed</p>
                        <button onClick={onRegenerate} className="flex items-center gap-1 text-white bg-red-600/80 px-2 py-1 rounded-full text-xs hover:bg-red-500">
                            <RefreshIcon className="w-3 h-3"/>
                            Retry
                        </button>
                    </div>
                );
            case 'done':
                return (
                    <motion.div className="relative w-full h-full group/image">
                        <motion.img 
                            key={imageState.url} // Re-trigger animation on URL change
                            src={imageState.url} 
                            alt={`Generated image for ${decade}`} 
                            className="w-full h-full object-cover cursor-pointer"
                            initial={{ filter: 'sepia(1) contrast(0.5) brightness(0.7)', opacity: 0.8 }}
                            animate={{ filter: 'sepia(0) contrast(1) brightness(1)', opacity: 1 }}
                            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }}
                            onClick={handleZoom}
                        />
                        <div className="absolute inset-0 bg-black transition-opacity duration-1000" style={{ animation: 'developing 1.5s ease-out forwards' }}/>
                        
                        {/* 操作按钮 */}
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/image:opacity-100 transition-opacity">
                            <button
                                onClick={handleZoom}
                                className="p-1.5 bg-black/70 text-white rounded-full hover:bg-black/90 transition-colors"
                                title="放大查看"
                            >
                                <MagnifyPlusIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleDownload}
                                className="p-1.5 bg-black/70 text-white rounded-full hover:bg-black/90 transition-colors"
                                title="下载图片"
                            >
                                <DownloadSingleIcon className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <style>{`
                            @keyframes developing {
                                0% { opacity: 0.6; }
                                100% { opacity: 0; }
                            }
                        `}</style>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    if (isMobile) {
        return (
            <>
                <div className="w-full bg-[#fdf5e6] p-3 rounded-lg shadow-lg font-['Permanent_Marker'] text-gray-800 flex flex-col gap-3">
                    <div className="w-full aspect-square bg-gray-300 shadow-inner overflow-hidden">
                        {cardContent()}
                    </div>
                    <div className="flex justify-between items-center px-1">
                        <p className="text-2xl">{decade}</p>
                        <div className="flex items-center gap-2">
                            {imageState?.status === 'done' && (
                                <>
                                    <button 
                                        onClick={handleZoom}
                                        className="p-2 bg-gray-200/50 rounded-full hover:bg-gray-300 active:scale-90 transition-transform"
                                        title="放大查看"
                                    >
                                        <MagnifyPlusIcon className="w-4 h-4"/>
                                    </button>
                                    <button 
                                        onClick={handleDownload}
                                        className="p-2 bg-gray-200/50 rounded-full hover:bg-gray-300 active:scale-90 transition-transform"
                                        title="下载图片"
                                    >
                                        <DownloadSingleIcon className="w-4 h-4"/>
                                    </button>
                                </>
                            )}
                            {imageState?.status !== 'pending' && (
                                <button onClick={onRegenerate} className="p-2 bg-gray-200/50 rounded-full hover:bg-gray-300 active:scale-90 transition-transform">
                                    <RefreshIcon className="w-5 h-5"/>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </>
        );
    }
    
    return (
        <motion.div
            className="absolute cursor-grab active:cursor-grabbing group"
            style={{ top: initialPosition?.top, left: initialPosition?.left, width: 250, height: 300 }}
            initial={{ opacity: 0, scale: 0.5, y: 100, rotate: 0 }}
            animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                rotate: initialPosition?.rotate || 0,
            }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            drag
            dragConstraints={dragConstraints}
            dragElastic={0.1}
            whileHover={{ scale: 1.05, zIndex: 10 }}
            whileTap={{ scale: 0.95, zIndex: 10 }}
            onDoubleClick={onRegenerate}
            onHoverStart={handleShake}
        >
            <motion.div 
                className="w-full h-full bg-[#fdf5e6] p-3 rounded-lg shadow-lg font-['Permanent_Marker'] text-gray-800 flex flex-col"
                animate={controls}
            >
                <div className="w-full aspect-square bg-gray-300 shadow-inner overflow-hidden">
                    {cardContent()}
                </div>
                <div className="flex-grow flex items-center justify-center pt-2">
                    <p className="text-2xl">{decade}</p>
                </div>
                 {imageState?.status !== 'pending' && (
                    <motion.div 
                        className="absolute -bottom-2 -right-2 text-xs text-white bg-gray-700/80 px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                       Double-click to retry
                    </motion.div>
                )}
            </motion.div>
        </motion.div>
    );
};

export default PolaroidCard;