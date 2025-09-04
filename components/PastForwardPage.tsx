/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateDecadeImage } from '../services/geminiService';
import { createAlbumPage } from '../lib/albumUtils';
import PolaroidCard from './PolaroidCard';
import { UploadIcon, DownloadIcon } from './icons';
import Spinner from './Spinner';

type AppState = 'idle' | 'image-uploaded' | 'generating' | 'results-shown';
type ImageStatus = 'pending' | 'done' | 'error';
type GeneratedImage = {
    status: ImageStatus;
    url?: string;
    error?: string;
};

const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s'];

// Pre-defined positions for desktop layout to avoid overlap
const POSITIONS = [
    { top: '5%', left: '10%', rotate: -8 },
    { top: '8%', left: '55%', rotate: 12 },
    { top: '38%', left: '0%', rotate: 5 },
    { top: '42%', left: '65%', rotate: -5 },
    { top: '65%', left: '20%', rotate: 15 },
    { top: '70%', left: '50%', rotate: -10 },
];

const PastForwardPage: React.FC = () => {
    const [appState, setAppState] = useState<AppState>('idle');
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImage>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragAreaRef = useRef<HTMLDivElement>(null);

    const handleImageUpload = (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('Please upload a valid image file (PNG, JPEG, WEBP).');
            return;
        }
        setError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            setUploadedImage(e.target?.result as string);
            setAppState('image-uploaded');
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            handleImageUpload(e.target.files[0]);
        }
    };
    
    const resetState = () => {
        setAppState('idle');
        setUploadedImage(null);
        setGeneratedImages({});
        setIsLoading(false);
        setError(null);
    };

    const generateSingleDecade = async (decade: string) => {
        if (!uploadedImage) return;

        setGeneratedImages(prev => ({
            ...prev,
            [decade]: { status: 'pending' },
        }));

        try {
            const primaryPrompt = `Reimagine the person in this photo in the style of the ${decade}. This includes clothing, hairstyle, photo quality, and the overall aesthetic of that decade. The output must be a photorealistic image showing the person clearly.`;
            const resultUrl = await generateDecadeImage(uploadedImage, primaryPrompt);
            setGeneratedImages(prev => ({
                ...prev,
                [decade]: { status: 'done', url: resultUrl },
            }));
        } catch (err) {
            console.error(`Failed to generate image for ${decade}:`, err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setGeneratedImages(prev => ({
                ...prev,
                [decade]: { status: 'error', error: errorMessage },
            }));
        }
    };

    const handleGenerateClick = async () => {
        if (!uploadedImage) return;

        setIsLoading(true);
        setError(null);
        setAppState('generating');
        
        const initialImages: Record<string, GeneratedImage> = {};
        DECADES.forEach(decade => {
            initialImages[decade] = { status: 'pending' };
        });
        setGeneratedImages(initialImages);

        const concurrencyLimit = 2;
        const decadesQueue = [...DECADES];

        const processQueue = async () => {
            const decade = decadesQueue.shift();
            if (decade) {
                await generateSingleDecade(decade);
            }
        };

        const workers = Array(concurrencyLimit).fill(null).map(processQueue);
        await Promise.all(workers.map(async (worker) => {
            while (decadesQueue.length > 0) {
                await processQueue();
            }
        }));

        setIsLoading(false);
        setAppState('results-shown');
    };
    
    const handleDownloadAlbum = async () => {
        setIsLoading(true);
        try {
            const dataUrl = await createAlbumPage(generatedImages, DECADES);
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = 'past-forward-album.png';
            link.click();
        } catch (e) {
            console.error("Failed to create album", e);
            setError(e instanceof Error ? e.message : 'Could not create album file.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const isGenerationComplete = Object.values(generatedImages).every(img => img.status === 'done' || img.status === 'error');

    return (
        <div className="w-full flex flex-col items-center justify-center text-center p-4 min-h-[80vh] font-['Roboto'] relative overflow-hidden">
            <div className="absolute inset-0 bg-black opacity-80 -z-20"></div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:36px_36px] -z-10"></div>
            
            <AnimatePresence mode="wait">
            {(appState === 'idle' || appState === 'image-uploaded') && (
                <motion.div
                    key="upload"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    className="flex flex-col items-center gap-4"
                >
                    <h1 className="font-['Caveat'] text-7xl md:text-9xl font-bold text-white tracking-wider">Past Forward</h1>
                    <p className="text-gray-300 text-lg md:text-2xl -mt-4">Travel through time with your photos.</p>
                    
                    <div 
                        className="w-64 h-80 mt-8 bg-[#fdf5e6] rounded-lg shadow-2xl p-4 flex items-center justify-center cursor-pointer group"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {uploadedImage ? (
                            <img src={uploadedImage} alt="Uploaded" className="max-w-full max-h-full object-contain"/>
                        ) : (
                            <div className="text-center text-gray-700">
                                <UploadIcon className="w-12 h-12 mx-auto text-gray-500" />
                                <p className="font-bold mt-2 font-['Permanent_Marker']">Click to Start</p>
                            </div>
                        )}
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />

                    {appState === 'image-uploaded' && (
                        <div className="flex gap-4 mt-4">
                            <button onClick={() => fileInputRef.current?.click()} className="text-gray-300 hover:text-white underline">Change Photo</button>
                            <button onClick={handleGenerateClick} className="px-8 py-3 bg-[#fecb2e] text-black font-['Permanent_Marker'] text-xl rounded-full shadow-lg hover:scale-105 transition-transform">
                                GENERATE
                            </button>
                        </div>
                    )}
                </motion.div>
            )}

            {(appState === 'generating' || appState === 'results-shown') && (
                 <motion.div
                    key="results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full h-full flex flex-col items-center"
                >
                    <h2 className="font-['Caveat'] text-5xl md:text-6xl font-bold text-white tracking-wider my-4">Your Trip Through Time</h2>
                     
                    {/* Desktop View */}
                    <div ref={dragAreaRef} className="relative z-0 w-full max-w-5xl h-[600px] mt-4 hidden md:block">
                        {DECADES.map((decade, index) => (
                           <PolaroidCard
                                key={decade}
                                decade={decade}
                                imageState={generatedImages[decade]}
                                onRegenerate={() => generateSingleDecade(decade)}
                                dragConstraints={dragAreaRef}
                                initialPosition={POSITIONS[index]}
                            />
                        ))}
                    </div>

                    {/* Mobile View */}
                    <div className="w-full max-w-sm px-4 md:hidden">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-4">
                            {DECADES.map((decade) => (
                               <PolaroidCard
                                    key={decade}
                                    decade={decade}
                                    imageState={generatedImages[decade]}
                                    onRegenerate={() => generateSingleDecade(decade)}
                                    isMobile
                                />
                            ))}
                        </div>
                    </div>

                    <div className="relative z-10 mt-8 flex flex-col md:flex-row items-center gap-4">
                        <button onClick={resetState} className="text-gray-300 hover:text-white underline">Start Over</button>
                         {appState === 'results-shown' && isGenerationComplete && (
                            <button 
                                onClick={handleDownloadAlbum} 
                                disabled={isLoading}
                                className="px-8 py-3 bg-[#fecb2e] text-black font-['Permanent_Marker'] text-xl rounded-full shadow-lg hover:scale-105 transition-transform flex items-center gap-2 disabled:bg-yellow-700 disabled:cursor-not-allowed">
                                {isLoading ? <Spinner className="w-6 h-6"/> : <DownloadIcon className="w-6 h-6"/>}
                                Download Album
                            </button>
                        )}
                    </div>
                </motion.div>
            )}
            </AnimatePresence>

             {error && (
                <div className="absolute bottom-4 bg-red-500/80 text-white px-4 py-2 rounded-lg text-sm">{error}</div>
            )}
        </div>
    );
};

export default PastForwardPage;