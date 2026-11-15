"""Build the Korean design PDF from its editable Markdown source."""
from __future__ import annotations

import hashlib
import html
import re
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak,
    KeepTogether,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs' / '심연_강하_게임_기획서.md'
OUTPUT = ROOT / 'output' / 'pdf' / '심연_강하_게임_기획서.pdf'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Malgun', r'C:\Windows\Fonts\malgun.ttf'))
pdfmetrics.registerFont(TTFont('MalgunBold', r'C:\Windows\Fonts\malgunbd.ttf'))
pdfmetrics.registerFontFamily('Malgun', normal='Malgun', bold='MalgunBold')

INK = colors.HexColor('#192D2C')
MUTED = colors.HexColor('#5C6966')
GOLD = colors.HexColor('#A47B3E')
RULE = colors.HexColor('#CCD5D1')
PALE = colors.HexColor('#F1F5F2')
WIDTH, HEIGHT = A4
MARGIN = 42
CONTENT = WIDTH - 2 * MARGIN

base = dict(fontName='Malgun', textColor=INK, wordWrap='CJK', alignment=TA_LEFT)
styles = {
    'title': ParagraphStyle('title', fontName='MalgunBold', fontSize=28, leading=36, textColor=INK, spaceAfter=8, wordWrap='CJK'),
    'h2': ParagraphStyle('h2', fontName='MalgunBold', fontSize=20, leading=28, textColor=INK, spaceBefore=0, spaceAfter=14, keepWithNext=True, wordWrap='CJK'),
    'h3': ParagraphStyle('h3', fontName='MalgunBold', fontSize=12, leading=18, textColor=INK, spaceBefore=12, spaceAfter=6, keepWithNext=True, wordWrap='CJK'),
    'body': ParagraphStyle('body', fontSize=10.5, leading=16.5, spaceAfter=9, **base),
    'caption': ParagraphStyle('caption', fontName='Malgun', fontSize=8.5, leading=12, textColor=MUTED, wordWrap='CJK', spaceBefore=5, spaceAfter=10),
    'meta': ParagraphStyle('meta', fontName='Malgun', fontSize=9, leading=14, textColor=MUTED, spaceAfter=18),
    'cell': ParagraphStyle('cell', fontSize=9.4, leading=14, **base),
    'th': ParagraphStyle('th', fontName='MalgunBold', fontSize=9.4, leading=14, textColor=colors.white, wordWrap='CJK'),
}

def markup(text):
    text = html.escape(text)
    return re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)

def paragraph(text, style='body'):
    return Paragraph(markup(text), styles[style])

def column_widths(header):
    presets = {
        ('항목', '기획 내용'): [1.05, 4.1],
        ('단계', '플레이어 행동과 결과'): [1.05, 4.1],
        ('입력', '기능'): [1.65, 3.5],
        ('층', '환경 테마', '주요 진행'): [0.7, 1.25, 3.2],
        ('무기', '기본 피해', '간격', '소모', '전술적 역할'): [0.75, 0.85, 0.62, 0.67, 2.26],
        ('기본 선택지', '1회 선택 효과', '최대 단계'): [1.15, 3.25, 0.75],
        ('고유 능력', '실제 효과', '최대'): [0.95, 3.7, 0.5],
        ('일반 적', '최초 층', '체력', '공격', '역할'): [1.05, 0.55, 0.5, 0.5, 2.55],
        ('보스', '최초 층과 체력', '주요 패턴'): [1.05, 1.05, 3.05],
        ('획득 경로', '규칙'): [1.25, 3.9],
        ('상품', '효과', '가격'): [1.05, 2.85, 1.25],
        ('영구 강화', '단계별 효과', '최대', '다음 구매 비용'): [1.05, 2.05, 0.45, 1.6],
        ('구분', '원정 중 용도', '원정 종료 후'): [1.05, 1.8, 2.3],
        ('영역', '전달할 정보'): [1.2, 3.95],
        ('보존 대상', '저장 내용'): [1.2, 3.95],
        ('항목', '이전', '현재'): [2.1, 1.4, 1.65],
        ('우선순위', '제안', '완료 판단 기준'): [0.65, 1.45, 3.05],
        ('자료', '확인 범위'): [1.9, 3.25],
    }
    weights = presets.get(tuple(header), [1] * len(header))
    return [CONTENT * weight / sum(weights) for weight in weights]

def make_table(lines):
    cells = [[v.strip() for v in line.strip().strip('|').split('|')] for line in lines]
    rows = [cells[0]] + cells[2:]
    data = [[paragraph(v, 'th' if idx == 0 else 'cell') for v in row] for idx, row in enumerate(rows)]
    table = Table(data, colWidths=column_widths(rows[0]), hAlign='LEFT', repeatRows=1, spaceBefore=3, spaceAfter=11)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), INK),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, PALE]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
        ('LINEBELOW', (0, 1), (-1, -1), 0.35, RULE),
    ]))
    return table

def image_block(caption, path):
    image_path = (SOURCE.parent / path).resolve()
    with PILImage.open(image_path) as source:
        w, h = source.size
    max_height = 208 if 'monster' in path else (242 if 'dungeon-after' in path else 230)
    factor = min(CONTENT / w, max_height / h)
    pic = Image(str(image_path), width=w * factor, height=h * factor, hAlign='LEFT')
    return KeepTogether([Spacer(1, 3), pic, paragraph(caption, 'caption')])

def decorate(canvas, doc):
    canvas.saveState()
    canvas.setTitle('심연 강하 게임 기획서')
    canvas.setAuthor('심연 강하 개발 프로젝트')
    canvas.setSubject('현재 구현 기준의 게임 기획 및 후속 개발 제안')
    if doc.page > 1:
        canvas.setFont('MalgunBold', 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN, HEIGHT - 27, '심연 강하  /  게임 기획서')
        canvas.setFont('Malgun', 8)
        canvas.drawRightString(WIDTH - MARGIN, HEIGHT - 27, 'v1.0  ·  2026.11.15')
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 33, WIDTH - MARGIN, 33)
    canvas.setFillColor(MUTED)
    canvas.setFont('Malgun', 8)
    canvas.drawString(MARGIN, 20, '현재 구현 기준 · 후속 개발 제안 별도 표기')
    canvas.setFont('MalgunBold', 9)
    canvas.drawRightString(WIDTH - MARGIN, 20, f'{doc.page:02d}')
    canvas.restoreState()

class DesignDocument(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == 'h2':
            title = flowable.getPlainText()
            anchor = 'section-' + hashlib.sha1(title.encode('utf-8')).hexdigest()[:12]
            self.canv.bookmarkPage(anchor)
            self.canv.addOutlineEntry(title, anchor, level=0, closed=False)


def build():
    lines = SOURCE.read_text(encoding='utf-8-sig').splitlines()
    flow = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line == '<!-- pagebreak -->':
            flow.append(PageBreak())
        elif line.startswith('# '):
            flow.append(paragraph(line[2:], 'title'))
        elif line.startswith('## '):
            flow.append(paragraph(line[3:], 'h2'))
        elif line.startswith('### '):
            flow.append(paragraph(line[4:], 'h3'))
        elif line.startswith('|'):
            block = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                block.append(lines[i])
                i += 1
            flow.append(make_table(block))
            continue
        elif (match := re.fullmatch(r'!\[(.*?)\]\((.*?)\)', line)):
            flow.append(image_block(*match.groups()))
        else:
            block = [line]
            while i + 1 < len(lines) and lines[i + 1].strip():
                if lines[i + 1].startswith(('#', '|', '![', '<!--')):
                    break
                i += 1
                block.append(lines[i].strip())
            flow.append(paragraph(' '.join(block), 'meta' if line.startswith('버전 ') else 'body'))
        i += 1
    doc = DesignDocument(str(OUTPUT), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=47, bottomMargin=45, pageCompression=1)
    doc.build(flow, onFirstPage=decorate, onLaterPages=decorate)
    print(f'PDF: {OUTPUT}')
    print(f'PDF bytes: {OUTPUT.stat().st_size}')
    print(f'Game SHA256: {hashlib.sha256((ROOT / "index.html").read_bytes()).hexdigest()}')

if __name__ == '__main__':
    build()
