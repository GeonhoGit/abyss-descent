# Pause, balance, and resume implementation plan

**Goal:** 능력·지도 확인 중 전투 정지, 근거 있는 무기/성장 밸런스 조정, 현재 원정 저장·이어하기.

**Architecture:** 기존 단일 HTML/Canvas 구조를 유지한다. `infoView`가 시뮬레이션과 전투 입력을 막고, 기존 영구 진행 저장과 분리된 버전 있는 원정 스냅샷을 사용한다. 밸런스는 기존 수치의 비교 및 재현 가능한 맵/전투 검사로 범위를 제한한다.

**Tech Stack:** standalone HTML, Canvas, localStorage, Node test harness, optional native Canvas previews.

**Spec:** 사용자 요청(2026-11-15): Tab/M 토글 창을 열면 정지하고 닫으면 재개. 앞서 제안한 2번 난이도·성장 밸런스와 3번 중간 저장·이어하기 구현. 최신 개선본 복원은 별도 사용자 승인 완료.

## Constraints and evidence

- 기존 그래픽, 영구 강화 및 저장 키는 유지한다.
- 복원 전 사용자 파일은 Temp/abyss-user-file-before-recovery-20261115.html에 보관했다.
- 레벨업/상인 미리보기에서 각각 복원한 원본이 동일함을 검증했다.
- 실행 브라우저의 저장 데이터는 직접 읽거나 바꾸지 않는다. 검증은 격리된 하네스에서 수행한다.
- 전체 파일 덮어쓰기 없이 작업 영역별 패치를 사용한다.

## Task 1: pause inspection views

- [x] `frame`/`update`에서 `infoView`가 열린 동안 시뮬레이션 정지.
- [x] 마우스 시점, 발사, 이동, 무기 변경, 액션 입력 차단 및 토글 시 기존 입력 초기화.
- [x] 창 전환은 정지를 유지하고 닫으면 시간 점프 없이 재개.
- [x] 능력창·지도 안내를 일시정지 동작에 맞춘다.
- [x] `tests/info-pause.test.cjs`: 실제 플레이어/적/탄환/쿨타임 동결 및 재개 확인.

## Task 2: measured balance pass

- [x] 무기 초당 피해와 자원 효율, 층별 일반·엘리트 체력/피해 및 성장 보상 비교.
- [x] 확인한 과도한 격차만 조정하고 근거를 문서화.
- [x] `tests/balance.test.cjs`: 변경 수치의 의도와 생성된 맵/보상 검증.

## Task 3: persistent runs

- [x] `abyss_run_v1`에 플레이어·월드·보스·탄환·선택 및 상인 상태를 저장.
- [x] 진행 중 주기 저장, 주요 선택/구매/층 이동 및 종료 시 체크포인트.
- [x] 이어하기/저장 후 나가기/포기 메뉴와 저장 상태 표시.
- [x] 복원 전 자료 검증, 사망/종료 시 저장 제거, 실패 시 원정과 영구 기록 보존.
- [x] `tests/run-save.test.cjs`: 새 하네스로 round trip, 손상/실패/보상 중복 검사.
- [x] 미리보기의 원정 저장도 명시적으로 비활성화.

## Final proof

- [x] 변경 영역의 기존 테스트와 새 테스트를 실행한다.
- [x] 5개 테마/무기/능력창의 실제 Canvas 렌더를 확인한다.
- [x] 밸런스 검증은 자동 검증 범위와 체감 플레이 한계를 구분해 보고한다.

최종 증거: `node --test --test-concurrency=1` 39개 통과(134초). Native Canvas 던전 45회/무기 18회/능력창 9회 렌더링 통과. `tools/render-resume.cjs`에서 실제 저장·이어하기 버튼 클릭 후 새 하네스 세션의 Canvas PNG가 저장 전과 동일함을 확인했다. 두 미리보기 빌더는 영구 기록 및 원정 기록에 쓰지 않는 것을 검증했다. 브라우저 실시간 조작 및 장시간 난이도 플레이는 이 검증에 포함하지 않는다.
