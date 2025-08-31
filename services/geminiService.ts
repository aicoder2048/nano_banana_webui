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
        
        // 构建请求配置，包含变化参数
        const requestConfig: any = {
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: parts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
                // 添加温度控制以增加变化
                temperature: temperature ?? 0.9,
                // 如果API支持seed参数，可以尝试添加
                ...(seed !== undefined && { seed: seed })
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
        throw handleApiError(e, '生成图片');
    }
};

export const generateEditedImage = async (imageFile: File, prompt: string, hotspot: { x: number; y: number }): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: `Apply this edit at hotspot (${hotspot.x}, ${hotspot.y}): ${prompt}` };
    return callImageEditingModel([imagePart, textPart], '修饰');
};

export const generateFilteredImage = async (imageFile: File, prompt: string): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: `Apply this filter: ${prompt}` };
    return callImageEditingModel([imagePart, textPart], '滤镜');
};

export const generateAdjustedImage = async (imageFile: File, prompt: string): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: `Apply this adjustment: ${prompt}` };
    return callImageEditingModel([imagePart, textPart], '调整');
};

export const generateTexturedImage = async (imageFile: File, prompt: string): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: `Apply this texture: ${prompt}` };
    return callImageEditingModel([imagePart, textPart], '纹理');
};

export const removeBackgroundImage = async (imageFile: File): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: 'Remove the background of this image, leaving only the main subject with a transparent background.' };
    return callImageEditingModel([imagePart, textPart], '抠图');
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
        
        return await callImageEditingModel(allParts, '合成');

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
        
        // 根据变化强度定义不同的摄影风格变化描述，保持照片真实性
        const variationSets = {
            subtle: [
                "standard photographic composition with natural lighting and balanced colors, maintaining photographic realism",
                "slightly warmer color temperature with gentle shadows, keeping natural photo appearance",
                "marginally enhanced contrast with soft highlights, preserving realistic photo quality",
                "delicate color grading with subtle tone adjustments, maintaining photographic authenticity",
                "refined lighting with gentle depth enhancement, keeping natural photo characteristics",
                "minor composition tweaks with natural flow, preserving realistic photographic style",
                "soft focus variations with subtle detail enhancement, maintaining photo realism",
                "gentle color harmony with minimal adjustments, keeping authentic photographic look"
            ],
            moderate: [
                "natural outdoor full-body portrait in park or garden setting with trees and greenery background, maintaining photographic realism",
                "close-up portrait photography focusing on face and shoulders only, with shallow depth of field and natural lighting", 
                "elegant standing pose with one hand on hip and confident posture against neutral background",
                "side profile view photography showing elegant silhouette from 90-degree angle with dramatic lighting",
                "single person walking pose captured in mid-step with natural stride and balanced movement",
                "back view or over-shoulder perspective showing person looking away or turning head back toward camera",
                "medium shot composition from waist up with arms and upper body clearly visible in frame",
                "overhead angle photography shot from above looking down at subject with unique bird's-eye perspective",
                "three-quarter angle portrait showing face and body from 45-degree angle with natural lighting",
                "full-body portrait with arms crossed pose showing confidence and strength in composition",
                "elegant kneeling pose on one knee with upright posture and graceful positioning",
                "standing against wall or architectural element with one shoulder leaning for support"
            ],
            dramatic: [
                "dramatic low-angle shot looking up at subject from below with powerful perspective and strong lighting contrast",
                "artistic black and white portrait with high contrast lighting and emotional facial expression in monochrome style",
                "fashion model pose with one leg slightly forward and hands positioned elegantly at sides", 
                "fashion editorial with bold geometric poses and dramatic hand gestures against minimalist background",
                "intimate close-up beauty shot focusing on eyes and facial features with soft romantic lighting",
                "urban street photography style with natural city environment and candid documentary approach",
                "artistic lying down pose photographed from interesting angle with creative composition and depth",
                "dramatic backlighting silhouette with rim lighting effect creating striking outline against bright background",
                "high-contrast studio portrait with dramatic shadow patterns across face and body",
                "elegant full-body pose with flowing fabric or clothing creating dynamic visual interest",
                "moody atmospheric portrait with dramatic chiaroscuro lighting technique and deep shadows",
                "architectural portrait using building elements or columns to frame the subject creatively"
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
                
                // 为每张图片生成不同的种子和温度
                const seed = Math.floor(Math.random() * 1000000);
                
                // 根据变化强度调整温度范围
                let baseTemp, tempRange;
                switch (variationIntensity) {
                    case 'subtle':
                        baseTemp = 0.6;
                        tempRange = 0.2; // 0.6 到 0.8
                        break;
                    case 'dramatic':
                        baseTemp = 0.8;
                        tempRange = 0.5; // 0.8 到 1.3
                        break;
                    default: // moderate
                        baseTemp = 0.7;
                        tempRange = 0.3; // 0.7 到 1.0
                        break;
                }
                
                const temperature = baseTemp + (i * tempRange / Math.max(count - 1, 1));
                
                // 直接调用，不重试以节省时间
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
            } catch (error) {
                console.error(`Failed to generate fusion image ${i + 1}:`, error);
                // 如果是第一张就失败，抛出错误
                if (i === 0 && results.length === 0) {
                    throw error;
                }
                // 否则继续生成其他图片
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