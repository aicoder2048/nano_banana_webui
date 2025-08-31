/**
 * 提示词加载工具
 */

export const loadCustomPrompts = async (): Promise<string[]> => {
  try {
    const response = await fetch('./custom-prompts.md');
    if (!response.ok) {
      console.warn('无法加载 custom-prompts.md 文件');
      return [];
    }
    
    const text = await response.text();
    const lines = text.split('\n');
    
    // 过滤掉空行、标题行和以#开头的行
    const prompts = lines
      .filter(line => line.trim() !== '' && !line.startsWith('#'))
      .map(line => line.trim());
    
    return prompts;
  } catch (error) {
    console.error('读取提示词文件时出错:', error);
    return [];
  }
};