# Dark Fantasy Graphics Implementation Plan

**Goal:** 승인된 다크 판타지 방향을 기존 게임에 적용한다.
**Architecture:** `index.html`의 시각 코드만 분리된 작업 범위로 수정한다. 절차적 이미지는 시작 시 캐시하고 매 프레임 렌더링 비용을 제한한다.
**Tech Stack:** HTML/CSS, Canvas 2D, 기존 JavaScript, Node 기본 테스트.
**Spec:** `../specs/2026-11-13-dark-fantasy-design.md`

## 제약과 검토

- 단일 HTML 실행, `TS=64`, 기존 저장 키와 전투 로직 유지.
- 어두운 적 식별성, 소형 지도 경계, HUD 겹침, 짧은 화면 메뉴 스크롤, 고화질 프레임 비용을 확인한다.
- 검증용 Canvas 패키지는 임시 디렉터리에만 설치한다.

## 작업

- [x] 석재·바닥·천장·횃불 텍스처와 층별 안개를 수정한다. 범위: `theme`, `render3D`.
- [x] 적·아이템 스프라이트를 교체한다. 범위: `spr`, `SPF`, `SP`.
- [x] 메뉴 CSS/HTML과 강화 선택 버튼을 수정하고 ID 보존·HTML 구조를 확인한다.
- [x] 무기와 HUD를 정리하고 6종 무기의 화면을 확인한다.
- [x] `rtk proxy node --test`와 실제 Canvas 렌더링을 실행하고 밝기·배치·비용을 확인한다.
