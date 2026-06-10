import csv
import json
import urllib.request
import xml.etree.ElementTree as ET
import urllib.parse
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

API_KEY = "02356656"
INPUT_CSV = "Descartes_Papers_Filtered_Top600.csv"
OUTPUT_JSON = "Descartes_Enriched.json"

def clean_text(text):
    if not text:
        return ""
    return text.strip()

def search_kci(title):
    try:
        url = f"https://open.kci.go.kr/po/openapi/openApiSearch.kci?apiCode=articleSearch&key={API_KEY}&title={urllib.parse.quote(title)}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as response:
            xml_data = response.read()
            root = ET.fromstring(xml_data)
            
            # Find the first record
            record = root.find('.//record')
            if record is not None:
                article = record.find('.//articleInfo')
                journal = record.find('.//journalInfo')
                
                if article is not None and journal is not None:
                    return {
                        "kci_id": article.attrib.get('article-id', ''),
                        "citation_count": article.findtext('.//citation-count', '0'),
                        "kci_status": journal.findtext('.//kci-regist', ''),
                        "url": article.findtext('.//article-url', '')
                    }
    except Exception as e:
        pass
    return None

def process_row(row):
    title = clean_text(row.get('논문명', ''))
    if not title:
        return None
        
    # Get base data
    data = {
        "title": title,
        "authors": [clean_text(a) for a in row.get('저자명', '').split(';') if clean_text(a)],
        "institution": clean_text(row.get('주저자 소속기관', '')),
        "journal": clean_text(row.get('학술지명', '')),
        "year": clean_text(row.get('발행연도', '')),
        "citations": 0,
        "keywords": [clean_text(k) for k in row.get('저자키워드', '').split(',') if clean_text(k)],
        "abstract": clean_text(row.get('초록', '')),
        "url": ""
    }
    
    # Try to parse citation from CSV first
    try:
        data["citations"] = int(row.get('인용된 총 횟수', 0))
    except:
        pass
        
    # Enrich with KCI API
    api_data = search_kci(title)
    if api_data:
        try:
            api_citations = int(api_data.get("citation_count", 0))
            if api_citations > data["citations"]:
                data["citations"] = api_citations
        except:
            pass
        if api_data.get("url"):
            data["url"] = api_data["url"]
    
    return data

def main():
    print("Reading CSV...")
    results = []
    with open(INPUT_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        
    print(f"Found {len(rows)} rows. Processing with KCI API...")
    
    # We will only process first 50 papers due to API rate limits/time limits, 
    # but for dashboard demo we will mock the rest with their CSV data.
    enriched_data = []
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(process_row, row): row for row in rows}
        
        for i, future in enumerate(as_completed(futures)):
            result = future.result()
            if result:
                enriched_data.append(result)
            if (i + 1) % 50 == 0:
                print(f"Processed {i + 1}/{len(rows)}")

    print(f"Saving {len(enriched_data)} records to JSON...")
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(enriched_data, f, ensure_ascii=False, indent=2)
        
    print("Done!")

if __name__ == "__main__":
    main()
