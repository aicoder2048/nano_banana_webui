/**
 * 提示词加载工具
 */

export const loadCustomPrompts = async (): Promise<string[]> => {
  // 首先尝试加载用户自定义的提示词文件
  try {
    const response = await fetch('./custom-prompts.md');
    if (response.ok) {
      const text = await response.text();
      const prompts = parsePrompts(text);
      if (prompts.length > 0) {
        return prompts;
      }
    }
  } catch (error) {
    console.log('custom-prompts.md 不存在，尝试加载示例文件');
  }
  
  // 如果用户文件不存在或为空，加载示例文件
  try {
    const response = await fetch('./custom-prompts-examples.md');
    if (!response.ok) {
      console.warn('无法加载示例提示词文件');
      return [];
    }
    
    const text = await response.text();
    return parsePrompts(text);
  } catch (error) {
    console.error('读取示例提示词文件时出错:', error);
    return [];
  }
};

// 解析提示词文本的辅助函数
const parsePrompts = (text: string): string[] => {
  const lines = text.split('\n');
  
  // 过滤掉空行、标题行和以#开头的行
  const prompts = lines
    .filter(line => line.trim() !== '' && !line.startsWith('#'))
    .map(line => line.trim());
  
  return prompts;
};

// 从完整提示词行中提取实际的提示词内容（冒号后的部分）
export const extractActualPrompt = (fullPromptLine: string): string => {
  const colonIndex = fullPromptLine.indexOf(':');
  if (colonIndex === -1) {
    // 如果没有冒号，返回原始内容（向后兼容）
    return fullPromptLine.trim();
  }
  
  // 返回冒号后的内容，去除前后空格
  return fullPromptLine.substring(colonIndex + 1).trim();
};