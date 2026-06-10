# 🔬 Descartes Neural Analytics - 연구 노트 (Research Notes)

본 문서는 **Descartes Neural Analytics** 프로젝트의 지금까지의 개발 작업 내용, 아키텍처 구조, 구현된 핵심 기능 및 다음 개발 단계를 정리한 연구 노트입니다. 집, 학교, 피시방 등 다른 PC 환경에서 작업을 연속적으로 수행할 때 가이드라인으로 활용할 수 있도록 구성되었습니다.

---

## 📅 프로젝트 개요 & 연구 목적
- **프로젝트명**: Descartes Neural Analytics (Descartes Neural Engine)
- **목적**: 르네 데카르트(René Descartes) 관련 학술 문헌 데이터셋(KCI 등재 논문 약 600여 건)의 메타데이터를 정제 및 시각화하고, AI 기반 인프라스트럭처(연구 공백 탐색기, 논문 분석 코파일럿 등)를 적용하여 연구 트렌드를 분석하는 현대적인 웹 대시보드 구축.

---

## 🛠️ 기술 스택 & 종속성 (Tech Stack & Dependencies)

웹 표준 기술과 모던 프레임워크 없는 Vanilla 스택을 활용하여 성능 최적화와 이식성을 극대화했습니다. 별도의 설치 없이 브라우저에서 즉시 구동 가능합니다.

1. **Frontend Core**: HTML5, JavaScript (ES6+ Vanilla)
2. **Styling**: Vanilla CSS (글래스모피즘, 다크 모드, 네온 Accent 컬러 테마, 마이크로 인터랙션 애니메이션 적용)
3. **Libraries (CDN)**:
   - **Chart.js (v4.x)**: 연도별 추이, 피인용 히스토그램, 점유율 도넛 차트 및 트렌드 라인 차트 구현
   - **Vis.js Network (Standalone)**: 키워드 동시 출현(Co-occurrence) 및 공동 연구 네트워크 그래프 구현
   - **FontAwesome (v6.4.0)**: 대시보드 아이콘 시스템
   - **Google Fonts**: `Outfit` (영문/숫자 가독성), `Noto Sans KR` (한글 가독성)
4. **Data Preprocessing**: Python 3.x (`urllib`, `xml.etree.ElementTree`, `csv`, `json`, `concurrent.futures`)

---

## 📂 파일 및 폴더 구조 (Project Directory Structure)

```bash
dc/
├── Descartes_Papers_Filtered_Top600.csv  # KCI에서 추출한 데카르트 관련 논문 원본 데이터 (600건)
├── Descartes_Enriched.json               # Python 전처리기를 통해 KCI OpenAPI 정보를 추가한 데이터
├── preprocess.py                         # KCI OpenAPI 연동 및 데이터 가공용 Python 스크립트
├── data.js                               # 웹 대시보드 로드용 JS 포맷 데이터 (var kciData = [...])
├── index.html                            # 대시보드 UI 구조 정의 및 외부 라이브러리 연동
├── style.css                             # 전체 레이아웃 스타일, 글래스모피즘, 애니메이션 등 CSS 시스템
├── app.js                                # 대시보드 상태 관리, 필터링 파이프라인 및 차트/AI 분석 엔진 로직
└── research_notes.md                     # [본 파일] 연속 작업을 위한 연구 노트 가이드라인
```

---

## 💎 구현 완료된 핵심 기능 (Key Features)

### 1. KCI OpenAPI 데이터 보완 및 전처리 (`preprocess.py` -> `data.js`)
- CSV 파일의 논문 제목을 기준으로 **KCI 학술지 검색 OpenAPI**(`apiCode=articleSearch`)를 병렬 호출(`ThreadPoolExecutor`).
- KCI 등록 정보로부터 누적 피인용 수(Citation Count) 및 공식 논문 URL을 대조하여 기존 CSV 데이터를 최신화 및 보완.
- 결과를 가벼운 `Descartes_Enriched.json` 파일로 빌드한 후, 브라우저가 바로 로드할 수 있게 `data.js` 파일의 `kciData` 변수로 가공.

### 2. 다차원 필터링 & 실시간 요약 엔진 (`app.js` -> `applyFilters`)
- **연도 범위 슬라이더**: 1990년~2024년 범위의 양방향 드래그 조작으로 실시간 차트/네트워크 맵 업데이트.
- **검색 및 하이라이트**: 논문명, 저자, 학술지 검색 지원. '초록/키워드 매칭 배지'를 우측에 시각화하여 정보 습득성 극대화.
- **AI Insight 패널**: 현재 필터링된 데이터셋의 대표 키워드, 피인용 기준 최다 영향력 연구자, 최고 인용 논문을 동적으로 연산하여 **타이핑 효과(Typing Effect)**로 브리핑 제공.
- **핵심 메트릭 카드**: 총 논문 수, 누적 피인용 수, H-Index(영향력 지수), 평균 피인용률을 부드러운 숫자 카운팅 애니메이션(`animVal`)으로 표현하고 미니 스파크라인 트렌드 제공.

### 3. 지식 구조 시각화 네트워크 맵 (`vis.js`)
- **키워드 네트워크**: 논문 키워드 간의 동시 출현 빈도를 분석하여 관계망을 구성.
- **공동 연구 네트워크**: 공동 저자 관계를 네트워크 맵으로 재현하고, 3편 이상 게재 또는 상위 40% 이상 피인용된 연구자를 **Hub 연구자(Glow Effect)**로 특별 시각화하여 중심 인물 추적 가능.

### 4. 고급 분석 차트 구현 (`Chart.js`)
- **연도별 지식 생산 추이**: 영역 그래프를 통해 학술적 관심의 성쇠 표현.
- **피인용 분포 히스토그램**: 인용 구간별(0, 1-2, 3-4, 5-9 등) 바 차트를 통해 논문 질적 수준 분포 도출.
- **핵심 담론 점유율**: 상위 키워드의 비중 분석.
- **키워드 트렌드 히트맵/라인**: 상위 8대 키워드의 연도별 출현 빈도를 라인 그래프로 매핑하고, 범례 클릭 시 실시간 차트 업데이트 기능 구현.

### 5. AI Research Gap Navigator (연구 공백 탐색기)
- **원리**: 현재 필터링된 데이터셋에서 개별 출현 빈도가 높은 상위 15대 키워드를 추출한 뒤, **서로의 동시 출현(Co-occurrence) 빈도가 0에 가깝거나 가장 낮은 조합**을 탐색.
- **동작**: Cyberpunk 스타일의 의미론적 스캔 로그 연출이 끝난 후, 융합 가능성이 높으나 개척되지 않은 3개의 융합 연구 후보 주제와 예측 적합도를 카드 형태로 제안.

### 6. AI Paper Copilot (논문별 3단 요약 및 Q&A)
- 데이터 원장에서 행(Row) 클릭 시 해당 논문의 상세 모달 팝업.
- **AI 3단 요약**: 문장 분할 정규식을 이용해 초록 데이터에서 **연구 목적, 주요 기여, 학술적 의의**를 추출 및 보완하여 실시간 브리핑.
- **대화형 Q&A**: 논문의 핵심 주장, 학술적 의의, 보완 가능한 연구의 한계점 질문 클릭 시 휴리스틱 NLP 모델이 답변 연산 시뮬레이션 수행.

### 7. 유틸리티 편의 기능
- **찜하기(Favorites)**: 관심 논문 하트 클릭 시 로컬 스토리지(`dc_favs`)에 저장되어 브라우저 재시작 시에도 유지. 찜 목록만 보기 필터 기능 제공.
- **CSV 내보내기**: 현재 필터링된 조건의 데이터 원장을 CSV 파일(`Descartes_Export.csv`, BOM 적용하여 한글 깨짐 방지)로 즉시 다운로드.
- **전체화면 확장**: 개별 차트나 테이블 영역의 `Expand` 버튼을 누르면 오버레이와 함께 단독 줌인 확대 가능.

---

## 💻 다른 환경에서 작업을 이어서 시작하는 방법 (PC Bang / Home Guide)

새로운 PC에서 이 프로젝트를 열고 개발을 지속하려면 다음 단계를 따르세요.

### Step 1. 개발 환경 설정
1. **Python 설치**: 전처리 파이프라인 수정이 필요한 경우 Python 3.x가 설치되어 있어야 합니다.
2. **VS Code 설치 및 Live Server 확장 기능 추천**:
   - `index.html` 파일을 단순히 더블클릭해서 열 경우, 보안 정책(CORS)으로 인해 일부 기능이나 데이터 내보내기가 제한될 수 있으므로 **로컬 웹 서버**를 띄우는 것이 좋습니다.
   - VS Code에서 `Live Server` 확장을 설치한 후 우측 하단의 `Go Live`를 누르거나,
   - 파이썬 CLI가 설치되어 있다면 터미널에서 프로젝트 폴더로 이동 후 아래 명령어를 입력하여 로컬 서버를 구동합니다.
     ```bash
     python -m http.server 8000
     ```
     구동 후 브라우저에서 `http://localhost:8000`으로 접속합니다.

### Step 2. KCI OpenAPI 연동 및 전처리 데이터 갱신
새로운 논문 원본 데이터(`Descartes_Papers_Filtered_Top600.csv`)를 추가했거나 데이터 리프레시가 필요하다면 터미널에서 다음 명령어를 실행합니다.
```bash
python preprocess.py
```
> [!NOTE]
> `preprocess.py` 파일 내에 `API_KEY` 변수가 존재합니다. 만약 API 트래픽 한계에 도달하면 KCI 오픈 API 서비스에 재등록하여 새로운 인증키를 발급받아 교체해야 할 수 있습니다.

### Step 3. data.js 업데이트 방법
`preprocess.py`를 실행하여 생긴 `Descartes_Enriched.json` 데이터를 브라우저에 바로 전달하려면, JSON 데이터를 다음과 같이 `data.js` 형식으로 랩핑해야 합니다:
```javascript
// data.js 파일 구조 예시
var kciData = [
  {
    "title": "논문명",
    "authors": ["저자1", "저자2"],
    "institution": "소속기관",
    "journal": "학술지명",
    "year": "2024",
    "citations": 12,
    "keywords": ["키워드1", "키워드2"],
    "abstract": "초록 내용...",
    "url": "http://..."
  },
  ...
];
```

---

## 🚀 향후 마일스톤 및 고도화 과제 (Roadmap & Next Steps)

다음 번 작업 시 이어서 구현하면 좋은 추천 기능 리스트입니다:

1. **LLM API 연동 실시간 요약 (AI Paper Copilot 실체화)**:
   - 현재 `app.js`에서 정규식 및 키워드 대조를 통해 휴리스틱하게 요약/답변하는 모크(Mock) 로직을, 실제 **Gemini API** 또는 **OpenAI API**를 백엔드/서버리스 함수로 연동하여 완벽한 논문 내용 요약 및 실제 자유 질문 Q&A가 가능하도록 고도화.
2. **가상 스크롤(Virtual Scrolling) 적용**:
   - 데이터 원장(Data Table)에 600개 이상의 논문이 렌더링되면서 스크롤 시 약간의 끊김이 발생할 수 있습니다. 스크롤 뷰포트에 보이는 영역만 돔(DOM)을 생성하는 가상 스크롤 로직 도입 검토.
3. **네트워크 시각화 물리 시뮬레이션 가속화**:
   - Vis.js의 물리 연산(`physics`)이 최초 로딩 시 다소 리소스를 점유합니다. 네트워크 노드 배치가 완료되면 물리 엔진을 중지(`networkInstance.stabilize()`)시키는 최적화 코드 추가.
4. **고도화된 CSV Import 기능**:
   - 사용자가 대시보드 화면 내에서 직접 새로운 CSV 파일을 업로드하여 브라우저 메모리 상에서 실시간으로 분석 결과를 재컴파일할 수 있는 `CSV Import File Uploader` UI 기능 추가.

---

*본 연구 노트를 참고하여 홈/PC방/노트북 등 다양한 환경에서 완성도 높은 Descartes Neural Analytics 개발을 이어 나가시길 바랍니다.*
