import json
import re
import openpyxl
from pathlib import Path

# ====== 配置区 ======
EXCEL_FILE = "zaozi2.xlsx"
OUTPUT_JSON = "data/resources.json"
SHEET_NAME = 0
# ====================

FIELD_ALIASES = {
    "title": ["资源", "资源名称", "名称", "name", "title"],
    "category": ["类型", "分类", "category", "type"],
}

LINK_COLUMNS = ["百度", "夸克", "UC", "迅雷", "阿里", "115", "天翼", "移动云盘"]


def parse_categories(raw: str) -> list[str]:
    """将 '泰剧,泰剧原著小说' 拆分为 ['泰剧', '泰剧原著小说']"""
    if not raw:
        return []
    # 支持中文逗号、英文逗号、顿号分隔
    parts = re.split(r'[,，、]', raw)
    # 去空格、去空值、去重（保持顺序）
    seen = set()
    result = []
    for p in parts:
        p = p.strip()
        if p and p not in seen:
            seen.add(p)
            result.append(p)
    return result


def convert():
    wb = openpyxl.load_workbook(EXCEL_FILE, read_only=True)
    ws = wb.worksheets[SHEET_NAME] if isinstance(SHEET_NAME, int) else wb[SHEET_NAME]

    rows = list(ws.iter_rows(values_only=True))
    headers = [str(h).strip() if h else "" for h in rows[0]]

    col_map = {}
    for field, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if alias in headers:
                col_map[field] = headers.index(alias)
                break

    link_cols = []
    for col_name in LINK_COLUMNS:
        if col_name in headers:
            link_cols.append((col_name, headers.index(col_name)))

    missing = []
    if "title" not in col_map:
        missing.append("资源(title)")
    if "category" not in col_map:
        missing.append("类型(category)")
    if not link_cols:
        missing.append(f"至少一个网盘列({LINK_COLUMNS})")
    if missing:
        raise ValueError(f"Excel 缺少必要列: {missing}\n当前表头: {headers}")

    resources = []
    empty_category_count = 0

    for row in rows[1:]:
        title = str(row[col_map["title"]] or "").strip()
        raw_cat = str(row[col_map["category"]] or "").strip()
        categories = parse_categories(raw_cat)

        if not title:
            continue

        if not categories:
            empty_category_count += 1
            categories = ["未分类"]  # 给空分类一个兜底标签

        # 收集链接
        links = []
        for col_name, col_idx in link_cols:
            val = str(row[col_idx] or "").strip()
            if val and val.lower() != "none":
                links.append({"platform": col_name, "url": val})

        if not links:
            continue

        resources.append({
            "title": title,
            "categories": categories,  # ← 现在是数组！
            "links": links,
        })

    wb.close()

    # 输出
    out_path = Path(OUTPUT_JSON)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(resources, f, ensure_ascii=False, indent=2)

    print(f"✅ 转换完成: {len(resources)} 条资源 → {OUTPUT_JSON}")
    if empty_category_count:
        print(f"⚠️  {empty_category_count} 条资源无分类，已标记为「未分类」")

    # 统计（基于拆分后的分类）
    cats = {}
    total_links = 0
    platforms = {}
    for r in resources:
        for c in r["categories"]:
            cats[c] = cats.get(c, 0) + 1
        total_links += len(r["links"])
        for lk in r["links"]:
            p = lk["platform"]
            platforms[p] = platforms.get(p, 0) + 1

    print(f"\n📊 分类统计（拆分后，共 {len(cats)} 个独立分类）:")
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"   {cat}: {count}")
    print(f"\n🔗 总链接数: {total_links}")
    print(f"📦 平台分布:")
    for plat, count in sorted(platforms.items(), key=lambda x: -x[1]):
        print(f"   {plat}: {count}")


if __name__ == "__main__":
    convert()