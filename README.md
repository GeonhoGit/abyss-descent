# 심연 강하

검과 총을 사용해 던전을 내려가는 PC용 1인칭 로그라이크 게임입니다. Canvas 2D 레이캐스팅으로 2.5D 화면을 그리며, 진행 기록은 현재 브라우저의 로컬 저장소에 보관합니다.

## 실행과 조작

`index.html`을 PC 브라우저에서 엽니다. 게임 실행에는 패키지 설치나 네트워크 연결이 필요하지 않습니다. 키보드와 마우스를 사용하며 게임 화면에서 마우스 포인터 잠금을 허용합니다.

- WASD로 이동하고 마우스로 시점을 돌립니다. 좌클릭은 공격, 우클릭은 빠른 검 베기입니다.
- Shift 또는 Space로 대시합니다. 숫자 1~6, 마우스 휠 또는 Q로 무기를 바꿉니다.
- E로 상인이나 포탈과 상호작용하고 F로 획득한 충격파를 사용합니다.
- Tab은 획득 능력, M은 전체 지도를 열고 닫습니다. 정보창이 열린 동안 전투가 멈춥니다. Esc는 일시정지 메뉴입니다.

영구 강화와 영혼은 `abyss_save_v2`, 진행 중인 원정은 `abyss_run_v1`에 따로 저장됩니다. 같은 브라우저에서도 파일로 연 주소와 서버 주소의 저장 공간은 다를 수 있습니다. 원정 저장 형식과 실패 처리는 [원정 저장 계약](docs/run-save.md)에 설명합니다.

## 검증

Node.js가 설치되어 있으면 프로젝트 폴더에서 다음 명령을 실행합니다. 테스트 하네스는 격리된 저장소를 사용합니다.

```sh
node --test --test-concurrency=1 tests/*.test.cjs
```

선택적인 오프라인 Canvas 이미지 검사는 `@napi-rs/canvas` 모듈이 필요합니다. 예를 들어 `node tools/render-preview.cjs <canvas-모듈-경로>`로 실제 게임 렌더러를 검사할 수 있습니다. 도구는 미리보기 파일을 생성하거나 덮어쓸 수 있으므로 출력 경로를 확인하세요. 기획 PDF 생성기에는 Python과 ReportLab이 필요합니다. 자동 테스트와 오프라인 렌더는 실제 브라우저에서의 조작이나 장시간 밸런스 플레이를 대신하지 않습니다.

## 실행 파일

| 파일 | 역할 |
| --- | --- |
| `index.html` | 게임의 HTML, CSS, JavaScript를 모두 포함하는 실행 파일입니다. 화면, 렌더링, 전투, 사운드와 저장을 처리합니다. |
| `README.md` | 실행·검증 방법과 프로젝트 파일 역할을 설명하는 이 문서입니다. |
| `.gitattributes` | PDF를 Git에서 바이너리 파일로 처리하도록 지정합니다. |

### `index.html` 내부 구성

별도 소스 모듈 없이 한 파일에 다음 기능이 모여 있습니다.

| 구성 | 역할 |
| --- | --- |
| HTML·CSS | 타이틀, Canvas, 일시정지·설정·상점·레벨업 등 화면과 스타일을 정의합니다. |
| 영구 진행·설정 | 영혼, 영구 강화, 기록, 감도·음량·화질을 읽고 저장합니다. |
| 텍스처·스프라이트 | 돌과 바닥 등의 재질, 몬스터·아이템 이미지를 코드로 생성합니다. |
| 게임 데이터 | 적, 무기, 강화 능력과 층별 테마의 수치 및 동작을 정의합니다. |
| 맵·이동·길찾기 | 방과 통로, 층·보스·상점·아이템을 생성하고 충돌과 적의 경로를 계산합니다. |
| 사운드 | Web Audio로 효과음과 배경음을 합성하고 음량을 조절합니다. |
| 전투·시뮬레이션 | 플레이어와 적의 이동, 공격·피해·투사체·보상·포탈 상태를 갱신합니다. |
| 화면 렌더링 | 레이캐스팅으로 던전을 그리고 스프라이트, 무기 동작, 미니맵, HUD와 능력창을 표시합니다. |
| 원정 저장·복원 | 원정 스냅샷을 검증하고 자동 저장, 이어하기, 저장 후 나가기와 종료 정산을 처리합니다. |
| 메뉴·입력·게임 루프 | 시작, 강화 선택, 상점, 설정과 키보드·마우스 입력을 연결하고 프레임을 진행합니다. |

## 문서와 기획 산출물

| 파일 | 역할 |
| --- | --- |
| `docs/심연_강하_게임_기획서.md` | 게임의 조작, 시스템, 화면, 기술 범위와 검증을 정리한 편집 가능한 기획서입니다. |
| `docs/run-save.md` | 원정 저장 데이터, 체크포인트, 복원과 실패 처리 계약입니다. |
| `docs/balance-2026-11-15.md` | 무기와 적·보상의 밸런스 조정 근거와 검사 결과입니다. |
| `docs/superpowers/specs/2026-11-13-dark-fantasy-design.md` | 다크 판타지 그래픽 방향과 구현 제약을 기록합니다. |
| `docs/superpowers/plans/2026-11-13-dark-fantasy.md` | 그래픽 개선 작업 계획과 확인 사항입니다. |
| `docs/superpowers/plans/2026-11-15-pause-balance-resume.md` | 정보창 정지, 밸런스와 원정 이어하기 작업 계획 및 검증 기록입니다. |
| `output/pdf/심연_강하_게임_기획서.pdf` | Markdown 기획서를 바탕으로 생성한 공유용 PDF입니다. |

## 테스트

| 파일 | 역할 |
| --- | --- |
| `tests/game-harness.cjs` | 게임 스크립트를 격리된 가상 DOM·Canvas·저장소에서 실행하는 공통 하네스입니다. |
| `tests/ability-overlay.test.cjs` | 능력창·지도 전환과 획득 능력 표시를 검사합니다. |
| `tests/balance.test.cjs` | 무기 효율, 적 성장·보상과 첫 층 무기 상자를 검사합니다. |
| `tests/combat.test.cjs` | 공격, 투사체 방어와 폭발·벽 충돌 판정을 검사합니다. |
| `tests/info-pause.test.cjs` | 정보창을 연 동안의 정지, 입력 차단과 재개를 검사합니다. |
| `tests/input.test.cjs` | 키 반복, 포인터 잠금·포커스, 입력 초기화와 설정 복원을 검사합니다. |
| `tests/run-save.test.cjs` | 원정 저장·복원, 상점·승리 상태, 손상 데이터와 저장 실패를 검사합니다. |
| `tests/weapon-motion.test.cjs` | 총기 자세, 이동·조준과 반동 애니메이션을 검사합니다. |

## 개발 도구

| 파일 | 역할 |
| --- | --- |
| `tools/build-game-design.py` | Markdown 기획서와 이미지를 이용해 기획 PDF를 만듭니다. |
| `tools/build-levelup-preview.cjs` | 실제 게임에서 레벨업 화면으로 시작하는 독립 미리보기 HTML을 만듭니다. |
| `tools/build-shop-preview.cjs` | 실제 게임의 상점 화면으로 시작하는 독립 미리보기 HTML을 만듭니다. |
| `tools/render-abilities.cjs` | 실제 HUD의 능력창을 오프라인 Canvas로 렌더링합니다. |
| `tools/render-dungeon.cjs` | 던전 렌더러의 테마·재질을 오프라인 Canvas로 검사합니다. |
| `tools/render-monsters.cjs` | 적 텍스처와 렌더링을 이미지 또는 애니메이션으로 검사합니다. |
| `tools/render-preview.cjs` | 고정 테스트 장면에서 화질과 무기별 게임 화면을 렌더링합니다. |
| `tools/render-resume.cjs` | 격리된 저장소에서 저장·이어하기와 복원 화면을 검사합니다. |
| `tools/render-sword-preview.cjs` | 검의 렌더링과 동작을 오프라인 Canvas로 검사합니다. |
| `tools/render-weapon-motion.cjs` | 무기 자세와 움직임을 이미지 또는 애니메이션으로 검사합니다. |

## 미리보기

`previews/`는 개발 중 화면과 그래픽을 비교한 산출물입니다. 게임을 실행하는 데는 필요하지 않습니다. 파일명에 `before`가 있는 것은 변경 전 비교 자료이고, GIF는 움직임을 살펴보는 자료입니다.

| 파일 | 역할 |
| --- | --- |
| `abilities.png`, `abilities-empty.png`, `abilities-all.png` | 능력 표시와 빈 목록·전체 획득 상태의 미리보기입니다. |
| `boss.png` | 보스 화면 미리보기입니다. |
| `dungeon-after.png`, `dungeon-materials.png`, `dungeon-themes.png` | 변경된 던전 화면, 재질과 층별 테마 미리보기입니다. |
| `graphics-before.png`, `graphics-after.png` | 그래픽 변경 전후 비교 자료입니다. |
| `gun-details.png` | 총기 세부 그래픽 미리보기입니다. |
| `levelup-preview.html`, `shop-preview.html` | 레벨업·상점 화면을 독립적으로 살펴보는 HTML입니다. |
| `map-key-m.png` | M 키로 여는 지도 화면 미리보기입니다. |
| `monster-details.png`, `monster-details.gif`, `monsters-before.png` | 몬스터 세부 모습과 움직임, 변경 전 비교 자료입니다. |
| `relic-weapons-before.png`, `relic-weapons-before-detail.png` | 유물 무기의 변경 전 전체·상세 비교 자료입니다. |
| `relic-weapons-detailed.png`, `relic-weapons-detailed.gif`, `relic-weapons-detailed-detail.png` | 개선된 유물 무기의 전체·동작·상세 미리보기입니다. |
| `resumed-run.png` | 저장 후 이어서 불러온 원정 화면입니다. |
| `shop-art.png` | 상점의 상품 그림 미리보기입니다. |
| `sword-before.png`, `sword-before-detail.png` | 검의 변경 전 전체·상세 비교 자료입니다. |
| `sword-detailed.png`, `sword-detailed.gif`, `sword-detailed-detail.png` | 개선된 검의 전체·동작·상세 미리보기입니다. |
| `upgrade-sigils.png` | 강화 선택 문양 미리보기입니다. |
| `weapon-centered.png`, `weapon-centered.gif` | 중앙에 놓인 무기의 자세와 동작 미리보기입니다. |
| `weapon-detailed.png`, `weapon-detailed.gif` | 무기의 상세 그래픽과 동작 미리보기입니다. |
| `weapon-motion-before.png`, `weapon-motion-before.gif` | 무기 동작 변경 전 비교 자료입니다. |
| `weapon-motion.png`, `weapon-motion.gif` | 무기 동작의 현재 미리보기입니다. |
| `weapons.png` | 무기별 화면 미리보기입니다. |
