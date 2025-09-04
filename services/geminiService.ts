/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

// Function to get the current API key
const getApiKey = (): string | null => {
    return process.env.API_KEY || null;
}

// Centralized function to get the GoogleGenAI instance
const getGoogleAI = (): GoogleGenAI => {
    if (aiInstance) {
        return aiInstance;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("找不到 API 密钥。请确保系统 API 密钥已在环境中正确设置。");
    }
    
    try {
      aiInstance = new GoogleGenAI({ apiKey });
      return aiInstance;
    } catch(e) {
      console.error("Failed to initialize GoogleGenAI", e);
      // Invalidate on failure so we can retry
      aiInstance = null;
      throw new Error(`初始化 AI 服务失败: ${e instanceof Error ? e.message : String(e)}`);
    }
};

const handleApiError = (error: any, action: string): Error => {
    console.error(`API call for "${action}" failed:`, error);
    // Attempt to parse a meaningful message from the error object or string
    let message = `在“${action}”期间发生错误: ${error.message || '未知通信错误'}`;
    try {
      // Errors from the backend might be JSON strings
      const errorObj = JSON.parse(error.message);
      if (errorObj?.error?.message) {
         // Use the specific message from the API if available
         message = `在“${action}”期间发生错误: ${errorObj.error.message}`;
      }
    } catch(e) {
      // It's not a JSON string, use the original message
      if (String(error.message).includes('API key not valid')) {
          message = '系统 API 密钥无效。';
      } else if (String(error.message).includes('xhr error')) {
           message = `与 AI 服务的通信失败。这可能是由网络问题或无效的系统 API 密钥引起的。`;
      }
    }

    return new Error(message);
}


// Helper to resize and convert image if necessary
const resizeImageForApi = async (file: File): Promise<{ file: File, mimeType: string }> => {
    const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png'];
    const MAX_DIMENSION = 2048;

    const needsConversion = !SUPPORTED_MIME_TYPES.includes(file.type);

    return new Promise((resolve, reject) => {
        const image = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            if (typeof e.target?.result !== 'string') {
                return reject(new Error('Failed to read file for processing.'));
            }
            image.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));

        image.onload = () => {
            const { naturalWidth: width, naturalHeight: height } = image;
            const needsResize = width > MAX_DIMENSION || height > MAX_DIMENSION;

            // If no resize and no conversion is needed, we're good.
            if (!needsResize && !needsConversion) {
                return resolve({ file, mimeType: file.type });
            }

            // Otherwise, we need to draw to canvas.
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not create canvas context.'));
            }

            let newWidth = width;
            let newHeight = height;

            if (needsResize) {
                if (width > height) {
                    newWidth = MAX_DIMENSION;
                    newHeight = Math.round((height * MAX_DIMENSION) / width);
                } else {
                    newHeight = MAX_DIMENSION;
                    newWidth = Math.round((width * MAX_DIMENSION) / height);
                }
            }

            canvas.width = newWidth;
            canvas.height = newHeight;
            ctx.drawImage(image, 0, 0, newWidth, newHeight);

            // Always convert to PNG when using canvas for simplicity and to handle transparency.
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        return reject(new Error('Failed to create blob from canvas.'));
                    }
                    const newFileName = (file.name.split('.').slice(0, -1).join('.') || 'image') + '.png';
                    const newFile = new File([blob], newFileName, { type: 'image/png' });
                    resolve({ file: newFile, mimeType: 'image/png' });
                },
                'image/png',
                0.95
            );
        };

        image.onerror = (err) => {
            reject(new Error(`Failed to load image for processing: ${err}`));
        };

        reader.readAsDataURL(file);
    });
};

// Helper to convert a File to a base64 string
const fileToGenerativePart = async (file: File) => {
    const { file: processedFile, mimeType } = await resizeImageForApi(file);
    const base64data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(processedFile);
    });
    return {
        inlineData: {
            mimeType: mimeType,
            data: base64data,
        },
    };
};

const callImageEditingModel = async (parts: any[], action: string, seed?: number, temperature?: number): Promise<string> => {
    try {
        const ai = getGoogleAI();
        
        // 生成随机种子（如果未提供）
        const actualSeed = seed !== undefined ? seed : Math.floor(Math.random() * 1000000);
        
        // 构建请求配置，包含变化参数
        const requestConfig: any = {
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: parts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
                // 添加温度控制以增加变化
                temperature: temperature ?? 0.9,
                // 添加种子参数以控制随机性
                seed: actualSeed
            }
        };

        // 调试日志：检查参数是否正确传递
        console.log(`API Request for ${action}:`, {
            temperature: requestConfig.config.temperature,
            seed: requestConfig.config.seed,
            model: requestConfig.model
        });
        
        const response: GenerateContentResponse = await ai.models.generateContent(requestConfig);

        // 调试日志：检查完整响应结构
        console.log(`API Response for ${action}:`, {
            fullResponse: response,
            hasCandidates: !!response.candidates,
            candidatesLength: response.candidates?.length,
            firstCandidate: response.candidates?.[0] ? {
                hasContent: !!response.candidates[0].content,
                hasParts: !!response.candidates[0].content?.parts,
                partsLength: response.candidates[0].content?.parts?.length,
                finishReason: response.candidates[0].finishReason,
                safetyRatings: response.candidates[0].safetyRatings
            } : null
        });

        // 安全检查响应结构
        if (!response.candidates || !response.candidates[0]) {
            console.error(`API failed for ${action}: No candidates in response`, response);
            throw new Error(`API 响应中没有候选结果。可能的原因：请求被阻止、模型过载或网络问题。`);
        }

        const candidate = response.candidates[0];
        
        // 检查是否因为安全过滤被阻止
        if (candidate.finishReason === 'SAFETY') {
            console.error(`API blocked for ${action}: Safety filter triggered`, candidate.safetyRatings);
            throw new Error(`内容被安全过滤器阻止。请尝试调整提示词或图片内容。`);
        }
        
        // 检查其他完成原因
        if (candidate.finishReason === 'MAX_TOKENS') {
            console.error(`API truncated for ${action}: Max tokens reached`);
            throw new Error(`响应被截断（超出最大长度限制）。请简化提示词。`);
        }

        if (!candidate.content) {
            console.error(`API failed for ${action}: No content in candidate`, {
                finishReason: candidate.finishReason,
                safetyRatings: candidate.safetyRatings
            });
            throw new Error(`API 响应中没有内容。完成原因：${candidate.finishReason || '未知'}。可能需要重试。`);
        }

        if (!response.candidates[0].content.parts || !Array.isArray(response.candidates[0].content.parts)) {
            throw new Error('API 响应格式不正确：缺少 parts 数组');
        }

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        
        // This is a special case for prompt-blocking or other non-image responses
        if (response.candidates[0].content.parts[0]?.text) {
             throw new Error("Model responded with text instead of an image. The prompt may have been blocked.");
        }
        throw new Error('AI 未能返回预期的图片结果。');
    } catch (e) {
        // Re-throw specific errors, otherwise wrap in a generic handler
        if (e.message.includes("Model responded with text")) {
            throw e;
        }
        throw handleApiError(e, action);
    }
}

export const generateImageFromText = async (prompt: string, aspectRatio: string): Promise<string> => {
    try {
        const ai = getGoogleAI();
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: aspectRatio as "1:1" | "16:9" | "9:16" | "4:3" | "3:4",
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64ImageBytes}`;
        }
        throw new Error('AI 未能生成图片。');
    } catch (e) {
        console.error('生成图片失败:', e);
        
        // 尝试返回默认失败图片
        try {
            const response = await fetch('./image_gen_failed.png');
            if (response.ok) {
                const blob = await response.blob();
                return await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            }
        } catch (loadError) {
            console.error('加载默认失败图片失败:', loadError);
        }
        
        // 最终备用：抛出原始错误
        throw handleApiError(e, '生成图片');
    }
};

export const generateEditedImage = async (imageFile: File, prompt: string, hotspot: { x: number; y: number }): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: `Apply this edit at hotspot (${hotspot.x}, ${hotspot.y}): ${prompt}` };
    const seed = Math.floor(Math.random() * 1000000);
    return callImageEditingModel([imagePart, textPart], '修饰', seed);
};

export const generateFilteredImage = async (imageFile: File, prompt: string): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: `Apply this filter: ${prompt}` };
    const seed = Math.floor(Math.random() * 1000000);
    return callImageEditingModel([imagePart, textPart], '滤镜', seed);
};

export const generateAdjustedImage = async (imageFile: File, prompt: string): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: `Apply this adjustment: ${prompt}` };
    const seed = Math.floor(Math.random() * 1000000);
    return callImageEditingModel([imagePart, textPart], '调整', seed);
};

// 批量生成调整图片
export const generateAdjustedImages = async (
    imageFile: File,
    prompt: string, 
    count: number = 1,
    variationIntensity: string = 'moderate',
    onProgress?: (imageUrl: string, current: number, total: number) => void
): Promise<string[]> => {
    try {
        const results: string[] = [];
        
        // 根据变化强度定义不同的摄影角度变化描述，融入著名摄影师风格
        const variationSets = {
            subtle: [
                "shot from eye level with natural perspective and balanced composition in Ansel Adams documentary style",
                "captured with slight high angle for gentle flattering perspective inspired by Julia Margaret Cameron portraiture",
                "photographed with subtle low angle using Henri Cartier-Bresson's decisive moment approach",
                "composed using rule of thirds with Irving Penn's minimalist studio aesthetic",
                "shot with centered composition in Richard Avedon's clean portrait style",
                "captured from three-quarter angle showing natural depth like Annie Leibovitz environmental portraits",
                "photographed with soft side lighting in the style of Yousuf Karsh dramatic portraiture",
                "shot with shallow depth of field focusing on main subject using Steve McCurry's intimate approach"
            ],
            moderate: [
                "captured from high angle looking down in Mario Testino's fashion photography style",
                "shot from low angle with Helmut Newton's powerful and provocative composition",
                "photographed from side profile showing elegant silhouette like Horst P. Horst's glamour photography",
                "composed with diagonal lines using Vivian Maier's street photography dynamic framing",
                "shot with off-center framing inspired by Diane Arbus's unconventional portrait approach",
                "captured with environmental framing using Gordon Parks's documentary storytelling method",
                "photographed from behind with subject looking back in the style of Saul Leiter's intimate moments",
                "shot with foreground elements creating depth like Gregory Crewdson's cinematic compositions"
            ],
            dramatic: [
                "captured from dramatic bird's eye view in the style of Andreas Gursky's architectural perspectives",
                "shot from ground level worm's eye view using Alexander Rodchenko's revolutionary angles",
                "photographed with strong Dutch angle inspired by László Moholy-Nagy's experimental compositions",
                "composed with extreme close-up focusing on details like Richard Avedon's intense portraits",
                "shot from far distance with telephoto compression using Thomas Struth's large-format approach",
                "captured with wide-angle perspective in Sebastião Salgado's epic documentary style",
                "photographed with strong backlighting creating silhouette like Fan Ho's geometric light studies",
                "shot with subject turning around mid-motion inspired by Jacques Henri Lartigue's spontaneous captures"
            ]
        };

        const variations = variationSets[variationIntensity] || variationSets.moderate;
        
        for (let i = 0; i < count; i++) {
            try {
                const imagePart = await fileToGenerativePart(imageFile);
                
                // 为每次调用选择不同的变化描述
                const variationDesc = variations[i % variations.length];
                
                // 构建带变化的提示词
                const adjustmentPrompt = `Apply this adjustment: ${prompt} ${variationDesc}`;
                const textPart = { text: adjustmentPrompt };
                
                // 使用不同的temperature和seed来确保变化
                const temperature = variationIntensity === 'subtle' ? 0.5 : 
                                 variationIntensity === 'moderate' ? 0.8 : 1.0;
                
                // 为每个图片生成不同的种子
                const seed = Math.floor(Math.random() * 1000000) + i;
                
                const result = await callImageEditingModel([imagePart, textPart], `调整 ${i + 1}/${count}`, seed, temperature);
                results.push(result);
                
                // 调用进度回调，通知UI有新图片生成
                if (onProgress) {
                    onProgress(result, i + 1, count);
                }
                
                // 添加延迟避免请求过快
                if (i < count - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5秒延迟
                }
            } catch (error: any) {
                console.error(`Failed to generate adjusted image ${i + 1}/${count}:`, error);
                
                // 使用默认失败图片
                let errorPlaceholder;
                try {
                    const response = await fetch('./image_gen_failed.png');
                    if (response.ok) {
                        const blob = await response.blob();
                        errorPlaceholder = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    } else {
                        // 备用：1x1 透明像素
                        errorPlaceholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
                    }
                } catch (loadError) {
                    // 备用：1x1 透明像素
                    errorPlaceholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
                }
                
                // 记录错误信息，但继续处理
                const errorMessage = error.message || '未知错误';
                console.warn(`图片 ${i + 1}/${count} 生成失败: ${errorMessage}，跳过并继续...`);
                
                // 添加占位符到结果中（标记为错误）
                results.push(`${errorPlaceholder}#error=${encodeURIComponent(errorMessage)}`);
                
                // 如果有进度回调，通知失败但继续
                if (onProgress) {
                    onProgress(`${errorPlaceholder}#error=${encodeURIComponent(`图片 ${i + 1} 失败: ${errorMessage}`)}`, i + 1, count);
                }
                
                // 仍然添加延迟，避免过快请求
                if (i < count - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
        }
        
        if (results.length === 0) {
            throw new Error('所有图片调整都失败了');
        }
        
        return results;

    } catch (e) {
       throw handleApiError(e, '批量调整');
    }
};

export const generateTexturedImage = async (imageFile: File, prompt: string): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: `Apply this texture: ${prompt}` };
    const seed = Math.floor(Math.random() * 1000000);
    return callImageEditingModel([imagePart, textPart], '纹理', seed);
};

export const removeBackgroundImage = async (imageFile: File): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: 'Remove the background of this image, leaving only the main subject with a transparent background.' };
    const seed = Math.floor(Math.random() * 1000000);
    return callImageEditingModel([imagePart, textPart], '抠图', seed);
};

export const generateFusedImage = async (mainImage: File, sourceImages: File[], prompt: string): Promise<string> => {
    try {
        const mainImagePart = await fileToGenerativePart(mainImage);
        
        const sourceImageParts = await Promise.all(
            sourceImages.map((file, index) => fileToGenerativePart(file).then(part => ({ ...part, index: index + 1 })))
        );

        let fullPrompt = `Fuse the images. The main image is the one I'm editing. `;

        sourceImageParts.forEach(part => {
            fullPrompt += `Source image ${part.index} is provided. `;
        });
        
        fullPrompt += `Instructions: ${prompt}`;
        
        const textPart = { text: fullPrompt };
        const allParts = [mainImagePart, ...sourceImageParts.map(p => ({ inlineData: p.inlineData })), textPart];
        
        const seed = Math.floor(Math.random() * 1000000);
        return await callImageEditingModel(allParts, '合成', seed);

    } catch (e) {
       throw handleApiError(e, '合成');
    }
};

// 批量生成合成图片
export const generateFusedImages = async (
    mainImage: File, 
    sourceImages: File[], 
    prompt: string, 
    count: number = 1,
    variationIntensity: string = 'moderate',
    onProgress?: (imageUrl: string, current: number, total: number) => void
): Promise<string[]> => {
    try {
        const results: string[] = [];
        
        // 根据变化强度定义不同的摄影角度变化描述，融入著名摄影师风格
        const variationSets = {
            subtle: [
                "shot from eye level with natural perspective and balanced composition in Ansel Adams documentary style",
                "captured with slight high angle for gentle flattering perspective inspired by Julia Margaret Cameron portraiture",
                "photographed with subtle low angle using Henri Cartier-Bresson's decisive moment approach",
                "composed using rule of thirds with Irving Penn's minimalist studio aesthetic",
                "shot with centered composition in Richard Avedon's clean portrait style",
                "captured from three-quarter angle showing natural depth like Annie Leibovitz environmental portraits",
                "photographed with soft side lighting in the style of Yousuf Karsh dramatic portraiture",
                "shot with shallow depth of field focusing on main subject using Steve McCurry's intimate approach"
            ],
            moderate: [
                "captured from high angle looking down in Mario Testino's fashion photography style",
                "shot from low angle with Helmut Newton's powerful and provocative composition",
                "photographed from side profile showing elegant silhouette like Horst P. Horst's glamour photography",
                "composed with diagonal lines using Vivian Maier's street photography dynamic framing",
                "shot with off-center framing inspired by Diane Arbus's unconventional portrait approach",
                "captured with environmental framing using Gordon Parks's documentary storytelling method",
                "photographed from behind with subject looking back in the style of Saul Leiter's intimate moments",
                "shot with foreground elements creating depth like Gregory Crewdson's cinematic compositions"
            ],
            dramatic: [
                "captured from dramatic bird's eye view in the style of Andreas Gursky's architectural perspectives",
                "shot from ground level worm's eye view using Alexander Rodchenko's revolutionary angles",
                "photographed with strong Dutch angle inspired by László Moholy-Nagy's experimental compositions",
                "composed with extreme close-up focusing on details like Richard Avedon's intense portraits",
                "shot from far distance with telephoto compression using Thomas Struth's large-format approach",
                "captured with wide-angle perspective in Sebastião Salgado's epic documentary style",
                "photographed with strong backlighting creating silhouette like Fan Ho's geometric light studies",
                "shot with subject turning around mid-motion inspired by Jacques Henri Lartigue's spontaneous captures"
            ]
        };
        
        const variations = variationSets[variationIntensity as keyof typeof variationSets] || variationSets.moderate;
        
        // 预先准备图片数据，避免重复处理
        const mainImagePart = await fileToGenerativePart(mainImage);
        const sourceImageParts = await Promise.all(
            sourceImages.map((file, index) => fileToGenerativePart(file).then(part => ({ ...part, index: index + 1 })))
        );
        
        // 顺序生成每张图片
        for (let i = 0; i < count; i++) {
            try {
                // 构建 prompt
                let fullPrompt = `Fuse the images. The main image is the one I'm editing. `;

                sourceImageParts.forEach(part => {
                    fullPrompt += `Source image ${part.index} is provided. `;
                });
                
                // 添加用户指令和变化描述
                fullPrompt += `Instructions: ${prompt}. Create ${variations[i % variations.length]}.`;
                
                const textPart = { text: fullPrompt };
                const allParts = [mainImagePart, ...sourceImageParts.map(p => ({ inlineData: p.inlineData })), textPart];
                
                // 根据变化强度调整温度（保持在0-1范围内）
                let temperature;
                switch (variationIntensity) {
                    case 'subtle':
                        // 0.4 到 0.6
                        temperature = 0.4 + (i * 0.2 / Math.max(count - 1, 1));
                        break;
                    case 'dramatic':
                        // 0.7 到 1.0
                        temperature = 0.7 + (i * 0.3 / Math.max(count - 1, 1));
                        break;
                    default: // moderate
                        // 0.5 到 0.8
                        temperature = 0.5 + (i * 0.3 / Math.max(count - 1, 1));
                        break;
                }
                
                // 为每个合成生成唯一的种子
                const seed = Math.floor(Math.random() * 1000000) + i * 1000;
                
                // 使用种子和温度调用
                const result = await callImageEditingModel(allParts, `合成 ${i + 1}/${count}`, seed, temperature);
                results.push(result);
                
                // 调用进度回调，通知UI有新图片生成
                if (onProgress) {
                    onProgress(result, i + 1, count);
                }
                
                // 添加延迟避免请求过快
                if (i < count - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5秒延迟
                }
            } catch (error: any) {
                console.error(`Failed to generate fusion image ${i + 1}/${count}:`, error);
                
                // 使用默认失败图片
                let errorPlaceholder;
                try {
                    const response = await fetch('./image_gen_failed.png');
                    if (response.ok) {
                        const blob = await response.blob();
                        errorPlaceholder = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    } else {
                        // 备用：1x1 透明像素
                        errorPlaceholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
                    }
                } catch (loadError) {
                    // 备用：1x1 透明像素
                    errorPlaceholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
                }
                
                // 记录错误信息，但继续处理
                const errorMessage = error.message || '未知错误';
                console.warn(`图片 ${i + 1}/${count} 生成失败: ${errorMessage}，跳过并继续...`);
                
                // 添加占位符到结果中（标记为错误）
                results.push(`${errorPlaceholder}#error=${encodeURIComponent(errorMessage)}`);
                
                // 如果有进度回调，通知失败但继续
                if (onProgress) {
                    onProgress(`${errorPlaceholder}#error=${encodeURIComponent(`图片 ${i + 1} 失败: ${errorMessage}`)}`, i + 1, count);
                }
                
                // 仍然添加延迟，避免过快请求
                if (i < count - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
        }
        
        if (results.length === 0) {
            throw new Error('所有图片生成都失败了');
        }
        
        return results;

    } catch (e) {
       throw handleApiError(e, '批量合成');
    }
};

export const generateCreativeSuggestions = async (imageFile: File, type: 'filter' | 'adjustment' | 'texture'): Promise<{ name: string, prompt: string }[]> => {
    try {
        const ai = getGoogleAI();
        const imagePart = await fileToGenerativePart(imageFile);
        const textPrompt = `Analyze this image. Suggest 4 creative and interesting image ${type}s that would look good on it. Provide a very short, catchy name (2-4 words, in Chinese) and the corresponding detailed English prompt for each suggestion.`;
        const textPart = { text: textPrompt };

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [ imagePart, textPart ]},
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING, description: "A very short, catchy name for the effect in Chinese." },
                                    prompt: { type: Type.STRING, description: "The detailed English prompt to achieve the effect." }
                                }
                            }
                        }
                    }
                }
            }
        });

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);
        return result.suggestions;
    } catch (e) {
        throw handleApiError(e, '获取灵感');
    }
};


// Past Forward Feature
const getFallbackPrompt = (decade: string) => `Create a photograph of the person in this image as if they were living in the ${decade}. The photograph should capture the distinct fashion, hairstyles, and overall atmosphere of that time period. Ensure the final image is a clear photograph that looks authentic to the era.`;

const extractDecade = (prompt: string) => {
    const match = prompt.match(/(\d{4}s)/);
    return match ? match[1] : null;
}

export const generateDecadeImage = async (imageDataUrl: string, prompt: string): Promise<string> => {
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!match) {
    throw new Error("Invalid image data URL format.");
  }
  const [, mimeType, base64Data] = match;

    const imagePart = {
        inlineData: { mimeType, data: base64Data },
    };

    try {
        // First attempt with the primary prompt
        const textPart = { text: prompt };
        return await callImageEditingModel([imagePart, textPart], `生成 ${extractDecade(prompt)} 图像`);
    } catch (error) {
        // If it failed because the model returned text (prompt was likely blocked)
        if (error instanceof Error && error.message.includes("Model responded with text instead of an image")) {
            console.warn("Original prompt failed. Trying a fallback.");
            const decade = extractDecade(prompt);
            if (!decade) throw error; 
            
            // Second attempt with a safer, fallback prompt
            const fallbackPrompt = getFallbackPrompt(decade);
            const fallbackTextPart = { text: fallbackPrompt };
            return await callImageEditingModel([imagePart, fallbackTextPart], `生成 ${decade} 图像 (fallback)`);
        }
        // For other errors, re-throw them
        throw error;
    }
};