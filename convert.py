import json
import re
import openpyxl
from pathlib import Path
from datetime import datetime, date

# ====== 配置区 ======
EXCEL_FILE = "韩小说329部.xlsx"
OUTPUT_JSON = "data/resources.json"
SHEET_NAME = 0
# ====================

FIELD_ALIASES = {
    "title": ["资源", "资源名称", "名称", "name", "title"],
    "category": ["类型", "分类", "category", "type"],
    "date": ["日期", "时间", "date", "添加日期", "更新日期"],  # ← 新增
}

LINK_COLUMNS = ["百度", "夸克", "UC", "迅雷", "阿里", "115", "天翼", "移动云盘", "移动","城通"]  # ← 加了"移动"


def parse_categories(raw: str) -> list[str]:
    """将 '泰剧,泰剧原著小说' 拆分为 ['泰剧', '泰剧原著小说']"""
    if not raw:
        return []
    parts = re.split(r'[,，、]', raw)
    seen = set()
    result = []
    for p in parts:
        p = p.strip()
        if p and p not in seen:
            seen.add(p)
            result.append(p)
    return result


def format_date(val) -> str:
    """将 Excel 中的日期值统一转为 'YYYY-MM-DD' 字符串"""
    if val is None:
        return ""
    # openpyxl 读到的日期可能是 datetime 对象
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")
    # 也可能是字符串
    s = str(val).strip()
    if not s or s.lower() == "none":
        return ""
    # 尝试解析常见格式
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y年%m月%d日", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return s  # 无法解析就原样返回


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

    # 日期列是可选的，没有也不报错
    has_date = "date" in col_map
    if not has_date:
        print("⚠️  未找到日期列，所有资源的 date 将为空（归入「未分类」组）")
        print(f"   支持的日期列名: {FIELD_ALIASES['date']}")

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
            categories = ["未分类"]

        # 日期
        date_val = ""
        if has_date:
            date_val = format_date(row[col_map["date"]])

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
            "categories": categories,
            "date": date_val,  # ← 新增
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

    # 统计
    cats = {}
    total_links = 0
    platforms = {}
    dated_count = 0
    for r in resources:
        for c in r["categories"]:
            cats[c] = cats.get(c, 0) + 1
        total_links += len(r["links"])
        for lk in r["links"]:
            p = lk["platform"]
            platforms[p] = platforms.get(p, 0) + 1
        if r["date"]:
            dated_count += 1

    print(f"\n📊 分类统计（拆分后，共 {len(cats)} 个独立分类）:")
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"   {cat}: {count}")
    print(f"\n🔗 总链接数: {total_links}")
    print(f"📦 平台分布:")
    for plat, count in sorted(platforms.items(), key=lambda x: -x[1]):
        print(f"   {plat}: {count}")
    print(f"\n📅 有日期的资源: {dated_count}/{len(resources)}")


if __name__ == "__main__":
    convert()