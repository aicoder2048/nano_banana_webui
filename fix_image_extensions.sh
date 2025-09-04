#!/bin/bash
# 批量修复图片扩展名脚本
# 将实际为PNG格式但扩展名为jpg的文件改为png

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
    echo -e "${BLUE}🔧 图片扩展名修复工具${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
    echo "用法: $0 [目录路径]"
    echo ""
    echo "参数:"
    echo "  目录路径    要处理的目录路径 (可选)"
    echo ""
    echo "示例:"
    echo "  $0                    # 处理当前目录"
    echo "  $0 outputs            # 处理 outputs 目录"
    echo "  $0 /path/to/images    # 处理指定路径"
    echo ""
    echo "选项:"
    echo "  -h, --help           显示此帮助信息"
    echo ""
}

# 检查帮助参数
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

echo -e "${BLUE}🔧 图片扩展名修复工具${NC}"
echo -e "${BLUE}================================${NC}"

# 确定工作目录
TARGET_DIR="."

if [ $# -eq 0 ]; then
    # 没有参数，检查是否有 outputs 目录作为默认
    if [ -d "outputs" ]; then
        TARGET_DIR="outputs"
        echo -e "${GREEN}✓ 未指定目录，将使用默认的 outputs 目录${NC}"
    else
        echo -e "${BLUE}📁 未指定目录，将使用当前目录${NC}"
        TARGET_DIR="."
    fi
elif [ $# -eq 1 ]; then
    # 有一个参数，作为目标目录
    TARGET_DIR="$1"
    
    # 检查目录是否存在
    if [ ! -d "$TARGET_DIR" ]; then
        echo -e "${RED}❌ 错误: 目录不存在: $TARGET_DIR${NC}"
        echo -e "${YELLOW}💡 提示: 使用 -h 查看帮助信息${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ 使用指定目录: $TARGET_DIR${NC}"
else
    echo -e "${RED}❌ 错误: 参数过多${NC}"
    echo -e "${YELLOW}💡 提示: 使用 -h 查看帮助信息${NC}"
    exit 1
fi

# 切换到目标目录
if [ "$TARGET_DIR" != "." ]; then
    cd "$TARGET_DIR" || {
        echo -e "${RED}❌ 错误: 无法进入目录: $TARGET_DIR${NC}"
        exit 1
    }
fi

echo -e "${BLUE}📂 工作目录: $(pwd)${NC}"

# 统计文件
total_jpg_files=$(find . -name "*.jpg" -type f 2>/dev/null | wc -l)
echo "发现 $total_jpg_files 个 .jpg 文件"

if [ "$total_jpg_files" -eq 0 ]; then
    echo -e "${YELLOW}😐 没有找到需要处理的 .jpg 文件${NC}"
    exit 0
fi

# 分析文件类型
echo -e "\n${BLUE}🔍 分析文件格式...${NC}"
png_count=0
jpeg_count=0
other_count=0

for file in *.jpg; do
    if [ -f "$file" ]; then
        file_type=$(file "$file" 2>/dev/null)
        if echo "$file_type" | grep -qi "PNG"; then
            png_count=$((png_count + 1))
        elif echo "$file_type" | grep -qi "JPEG\|JPG"; then
            jpeg_count=$((jpeg_count + 1))
        else
            other_count=$((other_count + 1))
        fi
    fi
done

echo "分析结果:"
echo -e "  ${GREEN}PNG 格式但扩展名为 .jpg: $png_count 个${NC}"
echo -e "  ${BLUE}JPEG 格式: $jpeg_count 个${NC}"
echo -e "  ${YELLOW}其他格式: $other_count 个${NC}"

if [ "$png_count" -eq 0 ]; then
    echo -e "\n${GREEN}🎉 太好了! 所有 .jpg 文件都是正确的格式，无需修复${NC}"
    exit 0
fi

echo -e "\n${YELLOW}⚠️  发现 $png_count 个需要修复的文件${NC}"
echo -e "这些文件实际是 PNG 格式，但扩展名错误地标记为 .jpg"
echo ""

# 询问用户是否继续
read -p "是否要修复这些文件? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}👋 操作已取消${NC}"
    exit 0
fi

# 开始修复
echo -e "\n${BLUE}🔧 开始修复...${NC}"
fixed_count=0
skipped_count=0

for file in *.jpg; do
    if [ -f "$file" ]; then
        file_type=$(file "$file" 2>/dev/null)
        if echo "$file_type" | grep -qi "PNG"; then
            new_name="${file%.jpg}.png"
            
            # 检查目标文件是否已存在
            if [ -f "$new_name" ]; then
                echo -e "${YELLOW}⚠️  跳过: $file (目标文件 $new_name 已存在)${NC}"
                skipped_count=$((skipped_count + 1))
            else
                mv "$file" "$new_name"
                echo -e "${GREEN}✓ 修复: $file → $new_name${NC}"
                fixed_count=$((fixed_count + 1))
            fi
        fi
    fi
done

# 显示结果
echo -e "\n${BLUE}🎉 修复完成!${NC}"
echo -e "  ${GREEN}成功修复: $fixed_count 个文件${NC}"
if [ "$skipped_count" -gt 0 ]; then
    echo -e "  ${YELLOW}跳过: $skipped_count 个文件${NC}"
fi

if [ "$fixed_count" -gt 0 ]; then
    echo -e "\n${GREEN}✨ 现在这些文件应该能在 macOS Finder 中正常预览了!${NC}"
fi

echo -e "\n${BLUE}提示: 今后下载的新文件将自动使用正确的 .png 扩展名${NC}"