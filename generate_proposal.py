import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls
import win32com.client
import pymupdf
import os

FONT_FAMILY = "Arial"

def set_section_rtl(section):
    sectPr = section._sectPr
    sectPr.append(parse_xml(f'<w:bidi {nsdecls("w")}/>'))

def add_styled_run(p, text, font_name=FONT_FAMILY, size_pt=11, bold=False, italic=False, color=RGBColor(25, 25, 25)):
    run = p.add_run(text)
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color
    
    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.append(rFonts)
    rFonts.set(qn('w:cs'), font_name)
    rFonts.set(qn('w:ascii'), font_name)
    rFonts.set(qn('w:hAnsi'), font_name)
    
    rtl = OxmlElement('w:rtl')
    rtl.set(qn('w:val'), '1')
    rPr.append(rtl)
    return run

def add_heading_1(doc, text, size_pt=14, space_before=14, space_after=8):
    p = doc.add_paragraph()
    p._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
    p._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="right"/>'))
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.keep_with_next = True
    add_styled_run(p, text, size_pt=size_pt, bold=True, color=RGBColor(15, 23, 42))
    return p

def add_subheading(doc, text, size_pt=12, space_before=8, space_after=5):
    p = doc.add_paragraph()
    p._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
    p._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="right"/>'))
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.keep_with_next = True
    add_styled_run(p, text, size_pt=size_pt, bold=True, color=RGBColor(30, 41, 59))
    return p

def add_body_p(doc, text, size_pt=11, space_before=0, space_after=8, line_spacing=1.22):
    p = doc.add_paragraph()
    p._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
    p._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="both"/>'))
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing
    add_styled_run(p, text, size_pt=size_pt, bold=False, color=RGBColor(40, 40, 40))
    return p

def add_bullet_list_table(doc, items, bold_prefixes=None, space_after_p=3.5, font_size=11):
    table = doc.add_table(rows=len(items), cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.RIGHT
    
    # Enable RTL table layout
    tblPr = table._tbl.tblPr
    tblPr.append(parse_xml(f'<w:bidiVisual {nsdecls("w")}/>'))
    
    # Borderless
    tblBorders = parse_xml(f'''
    <w:tblBorders {nsdecls("w")}>
        <w:top w:val="none"/>
        <w:left w:val="none"/>
        <w:bottom w:val="none"/>
        <w:right w:val="none"/>
        <w:insideH w:val="none"/>
        <w:insideV w:val="none"/>
    </w:tblBorders>
    ''')
    tblPr.append(tblBorders)
    
    for idx, item in enumerate(items):
        row = table.rows[idx]
        
        # Cell 0: Bullet icon
        c_b = row.cells[0]
        c_b.width = Inches(0.22)
        tcPr0 = c_b._tc.get_or_add_tcPr()
        tcMar0 = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="30" w:type="dxa"/>
            <w:bottom w:w="30" w:type="dxa"/>
            <w:left w:w="0" w:type="dxa"/>
            <w:right w:w="0" w:type="dxa"/>
        </w:tcMar>
        ''')
        tcPr0.append(tcMar0)
        
        pb = c_b.paragraphs[0]
        pb._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
        pb._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="center"/>'))
        pb.paragraph_format.space_before = Pt(0)
        pb.paragraph_format.space_after = Pt(space_after_p)
        r_bullet = add_styled_run(pb, "●", size_pt=8, bold=True, color=RGBColor(30, 30, 30))
        
        # Cell 1: Content text
        c_t = row.cells[1]
        c_t.width = Inches(6.05)
        tcPr1 = c_t._tc.get_or_add_tcPr()
        tcMar1 = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="30" w:type="dxa"/>
            <w:bottom w:w="30" w:type="dxa"/>
            <w:left w:w="0" w:type="dxa"/>
            <w:right w:w="60" w:type="dxa"/>
        </w:tcMar>
        ''')
        tcPr1.append(tcMar1)
        
        pt = c_t.paragraphs[0]
        pt._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
        pt._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="right"/>'))
        pt.paragraph_format.space_before = Pt(0)
        pt.paragraph_format.space_after = Pt(space_after_p)
        pt.paragraph_format.line_spacing = 1.16
        
        if bold_prefixes and idx < len(bold_prefixes) and bold_prefixes[idx]:
            add_styled_run(pt, bold_prefixes[idx] + " ", size_pt=font_size, bold=True, color=RGBColor(15, 23, 42))
        add_styled_run(pt, item, size_pt=font_size, bold=False, color=RGBColor(35, 35, 35))

def build_complete_proposal(docx_path):
    doc = docx.Document()
    
    section = doc.sections[0]
    section.top_margin = Inches(0.9)
    section.bottom_margin = Inches(0.9)
    section.left_margin = Inches(1.0)
    section.right_margin = Inches(1.0)
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    set_section_rtl(section)
    
    # =========================================================================
    # PAGE 1: COVER
    # =========================================================================
    p_logo = doc.add_paragraph()
    p_logo._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
    p_logo._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="center"/>'))
    p_logo.paragraph_format.space_before = Pt(12)
    p_logo.paragraph_format.space_after = Pt(15)
    
    logo_path = os.path.abspath("extracted_page_0_0_X6.png")
    if os.path.exists(logo_path):
        r_logo = p_logo.add_run()
        r_logo.add_picture(logo_path, width=Inches(2.75))
        
    p_prop = doc.add_paragraph()
    p_prop._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
    p_prop._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="center"/>'))
    p_prop.paragraph_format.space_before = Pt(28)
    p_prop.paragraph_format.space_after = Pt(10)
    add_styled_run(p_prop, "مقترح مشروع تخرج لنيل درجة البكالوريوس بعنوان :", size_pt=13, bold=True)
    
    p_tit_ar = doc.add_paragraph()
    p_tit_ar._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
    p_tit_ar._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="center"/>'))
    p_tit_ar.paragraph_format.space_before = Pt(4)
    p_tit_ar.paragraph_format.space_after = Pt(6)
    add_styled_run(p_tit_ar, "منظومة رقمية ذكية لإدارة الحضور والتقييم الأكاديمي", size_pt=16, bold=True, color=RGBColor(15, 23, 42))
    
    p_tit_en = doc.add_paragraph()
    p_tit_en._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="center"/>'))
    p_tit_en.paragraph_format.space_before = Pt(2)
    p_tit_en.paragraph_format.space_after = Pt(28)
    r_en = p_tit_en.add_run("A smart academic platform for attendance and LMS operations")
    r_en.font.name = FONT_FAMILY
    r_en.font.size = Pt(11.5)
    r_en.bold = True
    r_en.font.color.rgb = RGBColor(60, 60, 60)
    
    p_dept = doc.add_paragraph()
    p_dept._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
    p_dept._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="center"/>'))
    p_dept.paragraph_format.space_before = Pt(8)
    p_dept.paragraph_format.space_after = Pt(26)
    add_styled_run(p_dept, "قسم : حاسب الآلي", size_pt=13, bold=True)
    
    p_sup = doc.add_paragraph()
    p_sup._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
    p_sup._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="center"/>'))
    p_sup.paragraph_format.space_before = Pt(8)
    p_sup.paragraph_format.space_after = Pt(26)
    add_styled_run(p_sup, "إشراف", size_pt=13, bold=True)
    
    p_prep = doc.add_paragraph()
    p_prep._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
    p_prep._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="center"/>'))
    p_prep.paragraph_format.space_before = Pt(8)
    p_prep.paragraph_format.space_after = Pt(16)
    add_styled_run(p_prep, "إعداد وتقديم:", size_pt=13, bold=True)
    
    # 5 Blank student placeholder rows (Names deleted as strictly instructed)
    table_stu = doc.add_table(rows=5, cols=2)
    table_stu.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_stu.autofit = False
    
    # Make table borderless
    tblPr_s = table_stu._tbl.tblPr
    tblBorders_s = parse_xml(f'''
    <w:tblBorders {nsdecls("w")}>
        <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/>
        <w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/>
    </w:tblBorders>
    ''')
    tblPr_s.append(tblBorders_s)
    
    for row in table_stu.rows:
        row.height = Pt(20)
        c_left = row.cells[0]
        c_left.width = Inches(2.7)
        p_l = c_left.paragraphs[0]
        p_l._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
        p_l._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="left"/>'))
        p_l.paragraph_format.space_before = Pt(1)
        p_l.paragraph_format.space_after = Pt(1)
        add_styled_run(p_l, "رقم القيد ....................", size_pt=11, color=RGBColor(90, 90, 90))
        
        c_right = row.cells[1]
        c_right.width = Inches(2.7)
        p_r = c_right.paragraphs[0]
        p_r._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
        p_r._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="right"/>'))
        p_r.paragraph_format.space_before = Pt(1)
        p_r.paragraph_format.space_after = Pt(1)
        add_styled_run(p_r, "..................................................", size_pt=11, color=RGBColor(90, 90, 90))
        
    p_term = doc.add_paragraph()
    p_term._p.get_or_add_pPr().append(parse_xml(f'<w:bidi {nsdecls("w")} w:val="1"/>'))
    p_term._p.get_or_add_pPr().append(parse_xml(f'<w:jc {nsdecls("w")} w:val="center"/>'))
    p_term.paragraph_format.space_before = Pt(45)
    p_term.paragraph_format.space_after = Pt(0)
    add_styled_run(p_term, "الفصل الدراسي: ربيع 2026", size_pt=12, bold=True)
    
    # =========================================================================
    # PAGE 2: 1 - المقدمة & 2 - الوضع الحالي ومشاكل النظام القديم
    # =========================================================================
    doc.add_page_break()
    
    add_heading_1(doc, "1 - المقدمة", size_pt=14, space_before=6, space_after=8)
    
    add_body_p(doc,
        "يشهد قطاع التعليم العالي وتقنية المعلومات في المؤسسات الأكاديمية تطوراً سريعاً يتطلب تحديثاً مستمراً في آليات العمل وإدارة البيئة التعليمية داخل القاعات الدراسية. ومن أبرز التحديات التي تواجه الإدارات الجامعية وأعضاء هيئة التدريس والحاسب الآلي، هو تنظيم وضبط حضور الطلاب ومتابعة سجلات التقييم والدرجات بشكل يضمن السرعة والدقة والشفافية.",
        size_pt=11, space_after=8)
        
    add_body_p(doc,
        "في ظل الاعتماد الحالي على الطرق التقليدية (الاتصالات الهاتفية - المراسلات الورقية - كشوفات الحضور اليدوية - المتابعات الفردية)، ظهرت العديد من الإشكاليات التي أثرت سلباً على كفاءة العملية التعليمية والجهد الإداري. وعليه، جاء هذا المقترح لتطوير منصة رقمية لإدارة وتنظيم العمل الإلكتروني A digital platform for managing and organizing electronic work كمنصة مركزية متكاملة تدير حضور الطلاب وسجلات التقييم والعمليات الأكاديمية بين الأقسام بشكل رقمي متطور.",
        size_pt=11, space_after=14)
        
    add_heading_1(doc, "2 - الوضع الحالي ومشاكل النظام القديم", size_pt=14, space_before=8, space_after=8)
    
    add_subheading(doc, "الوضع الحالي:", size_pt=12, space_before=4, space_after=4)
    items_current = [
        "استقبال طلبات الحضور والمشاكل الأكاديمية عبر قنوات متعددة (ورق، اتصالات، ملفات مبعثرة).",
        "تسجيل وتوزيع رصد الدرجات والحضور يدوياً دون نظام متابعة موحد.",
        "صعوبة التحقق من الحضور الفعلي للطلاب وتفشي ظاهرة الحضور بالنيابة (التحضير الوهمي).",
        "غياب سجل مركزي موحد يربط حضور الطالب بدرجاته وسجلاته الإدارية والمالية."
    ]
    add_bullet_list_table(doc, items_current, space_after_p=3.5)
    
    add_subheading(doc, "المشاكل المترتبة:", size_pt=12, space_before=8, space_after=4)
    items_problems = [
        "البطء وهدر وقت المحاضرة الثمين لغياب آلية رقمية سريعة لتسجيل الحضور.",
        "ضياع دقة البيانات وانعدام الموثوقية بسبب سهولة التوقيع عن الطلاب المتغيبين.",
        "ضعف الشفافية بين الإدارة وأعضاء هيئة التدريس والطلاب في رصد التقييمات.",
        "غياب مؤشرات الأداء وعدم توفر تقارير دقيقة تساعد الإدارة على اتخاذ القرار الأكاديمي.",
        "إرهاق إداري وأكاديمي نتيجة المتابعات الورقية والمراسلات المتكررة."
    ]
    add_bullet_list_table(doc, items_problems, space_after_p=3.5)
    
    # =========================================================================
    # PAGE 3: 3 - الحل المقترح & 4 - نطاق المشروع
    # =========================================================================
    doc.add_page_break()
    
    add_heading_1(doc, "3 - الحل المقترح", size_pt=14, space_before=6, space_after=8)
    
    add_body_p(doc,
        "منصة رقمية لإدارة وتنظيم العمل الإلكتروني هي تطبيق ويب حديث يوفر منصة مركزية لإدارة حضور الطلاب، دفتر الدرجات الأكاديمي، وتوزيع ومتابعة المهام والعمليات التعليمية.",
        size_pt=11, space_after=10)
        
    add_subheading(doc, "آلية عمله:", size_pt=12, space_before=4, space_after=4)
    items_solution = [
        "تسجيل الحضور إلكترونياً عبر رمز QR ديناميكي يتجدد تلقائياً كل 20 ثانية عبر النظام لمنع تصوير الشاشة.",
        "مسح الرمز مباشرة من قبل الطالب عبر كاميرا جهازه لتوثيق الحضور الفوري في قاعدة البيانات.",
        "إشعارات فورية وتنبيهات تفاعلية عبر النظام بشأن الجلسات وحالة الحضور والواجبات.",
        "دفتر درجات أكاديمي شامل (بمعايير عالمية) يتيح ضبط أوزان التقييمات 100% واحتساب فوري للمعدل التراكمي.",
        "توثيق كامل لكل جلسة تحضير وتقييم أكاديمي من البداية وحتى الاعتماد النهائي.",
        "استخراج تقارير إحصائية عامة وفردية بضغطة زر."
    ]
    add_bullet_list_table(doc, items_solution, space_after_p=3.5)
    
    add_heading_1(doc, "4 - نطاق المشروع (Scope of Work)", size_pt=14, space_before=10, space_after=8)
    
    add_subheading(doc, "يشمل النظام:", size_pt=12, space_before=4, space_after=4)
    items_scope = [
        "إدارة جلسات الحضور الذكي بالـ QR المتغير (بدء الجلسة - تسجيل - إغلاق).",
        "إدارة المستخدمين والصلاحيات (إضافة - تعديل - حذف - قفل الحسابات).",
        "إدارة المقررات الدراسية والجداول وتوزيع القاعات وربطها بالأساتذة والطلبة.",
        "دفتر الدرجات الأكاديمي الشامل واحتساب المعدل التراكمي (GPA) تلقائياً.",
        "لوحات متابعة تفاعلية مخصصة للمهام والعمليات (لوحة الطالب، لوحة المحاضر، لوحة الإدارة).",
        "إدارة السجلات والرسوم المالية الجامعية وإصدار الإيصالات وتجميد الحسابات غير المسددة.",
        "تقارير إحصائية عامة وفردية لكشوف الدرجات ونسب الحضور.",
        "حماية البيانات وتأمين الجلسات وخيارات الأمان المتقدمة.",
        "إمكانية التطوير والتوسع الأكاديمي مستقبلاً."
    ]
    add_bullet_list_table(doc, items_scope, space_after_p=3.0)
    
    # =========================================================================
    # PAGE 4: 5 - الواجهات & 6 - الفوائد والقيمة المضافة
    # =========================================================================
    doc.add_page_break()
    
    add_heading_1(doc, "5 - الواجهات (Interfaces)", size_pt=14, space_before=6, space_after=8)
    
    add_subheading(doc, "أ. واجهات المستخدم (الطلاب والمحاضرون):", size_pt=12, space_before=4, space_after=4)
    items_interfaces_u = [
        "تسجيل الدخول والملف الشخصي.",
        "الواجهة الرئيسية للطالب (ملخص المواد المسجلة - نسبة الحضور - المعدل التراكمي).",
        "واجهة مسح رمز الحضور الذكي (QR Scanner).",
        "واجهة كشف الدرجات الأكاديمي وجدول المحاضرات الموزع بالقاعات.",
        "واجهة السجل المالي الجامعي والإيصالات.",
        "واجهة المحاضر الرئيسية وقائمة المقررات الموكلة.",
        "شاشة توليد وعرض الـ QR المتغير كل 20 ثانية مع عداد تنازلي حي.",
        "دفتر درجات المحاضر (رصد وتعديل الدرجات وضبط أوزان التقييمات)."
    ]
    add_bullet_list_table(doc, items_interfaces_u, space_after_p=3.0)
    
    add_subheading(doc, "ب. واجهات المسؤول / الإداري:", size_pt=12, space_before=8, space_after=4)
    items_interfaces_a = [
        "تسجيل الدخول الإداري.",
        "الواجهة الرئيسية (إحصائيات عامة ورسوم بيانية لنشاط النظام).",
        "إدارة المستخدمين (إضافة، تعديل، قفل، وإعادة تعيين كلمات المرور).",
        "إدارة المقررات وتوزيع القاعات والجداول الدراسية.",
        "إدارة الشؤون المالية وتجميد الحسابات الأكاديمية.",
        "التقارير الأكاديمية والإحصائية (عامة - فردية)."
    ]
    add_bullet_list_table(doc, items_interfaces_a, space_after_p=3.0)
    
    add_heading_1(doc, "6 - الفوائد والقيمة المضافة", size_pt=14, space_before=10, space_after=6)
    prefixes_benefits = ["إدارية:", "تشغيلية:", "تنظيمية:", "إحصائية:", "إستراتيجية:"]
    items_benefits = [
        "تنظيم العمل الأكاديمي وتوحيد بيانات الطلاب وتقليل الجهد الإداري.",
        "سرعة الاستجابة وإنجاز التحضير ورصد التقييمات في ثوانٍ معدودة.",
        "توثيق شامل ودقيق لكافة بيانات الحضور ومنع التحضير بالنيابة.",
        "تقارير دقيقة وحساب فوري للمعدل التراكمي لدعم اتخاذ القرار.",
        "دعم التحول الرقمي وترسيخ معايير الحرم الجامعي الذكي."
    ]
    add_bullet_list_table(doc, items_benefits, bold_prefixes=prefixes_benefits, space_after_p=3.0)
    
    # =========================================================================
    # PAGE 5: 7 - المتطلبات التقنية & الخاتمة
    # =========================================================================
    doc.add_page_break()
    
    add_heading_1(doc, "7 - المتطلبات التقنية", size_pt=14, space_before=6, space_after=8)
    
    add_subheading(doc, "المتطلبات البرمجية (Software):", size_pt=12, space_before=4, space_after=4)
    items_software = [
        "بيئة الواجهة الأمامية: React 18 مع لغة TypeScript ومكتبة Tailwind CSS و Vite.",
        "الخادم الخلفي (Backend): بيئة Node.js مع إطار العمل Express.js ولغة TypeScript.",
        "قاعدة البيانات: MySQL 8.0 مع دعم المعاملات المتزامنة (InnoDB Transactions).",
        "الأمان والتشفير: مكتبات Zod للتحقق، خوارزمية HMAC-SHA256 للـ QR، وتشفير JWT و Bcrypt."
    ]
    add_bullet_list_table(doc, items_software, space_after_p=3.0)
    
    add_subheading(doc, "المتطلبات التشغيلية (Hardware/Hosting):", size_pt=12, space_before=6, space_after=4)
    items_hardware = [
        "جهاز إلكتروني (هاتف محمول، حاسوب لوحي، حاسوب مكتبي أو محمول).",
        "خادم استضافة محلي أو سحابي لتشغيل المنظومة وقاعدة البيانات.",
        "شبكة اتصال محلية (Wi-Fi) أو اتصال إنترنت ثابت."
    ]
    add_bullet_list_table(doc, items_hardware, space_after_p=3.0)
    
    add_subheading(doc, "الاستضافة عبر مزود خدمة خارجي:", size_pt=12, space_before=6, space_after=4)
    items_hosting = [
        "نطاق رسمي مخصص (Domain).",
        "استضافة بسعة تخزينية وموارد مناسبة لتشغيل الخادم وقاعدة البيانات.",
        "شهادة أمان SSL لتشفير الاتصال وضمان عمل كاميرا المتصفح ومسح الـ QR بأمان."
    ]
    add_bullet_list_table(doc, items_hosting, space_after_p=3.0)
    
    add_heading_1(doc, "الخاتمة", size_pt=14, space_before=8, space_after=6)
    
    add_body_p(doc,
        "يمثل هذا المقترح خطوة إستراتيجية لدعم التحول الرقمي داخل إدارة تقنية المعلومات والحاسب الآلي والأقسام الأكاديمية.",
        size_pt=11, space_after=6)
        
    add_subheading(doc, "النظام المقترح يعالج التحديات الحالية ويوفر قيمة مضافة عبر:", size_pt=12, space_before=4, space_after=4)
    items_conclusion = [
        "تسريع وضبط الحضور بالـ QR المتغير ومنع التحضير بالنيابة.",
        "تعزيز الشفافية والموثوقية في رصد وتوزيع الدرجات الأكاديمية.",
        "استخراج تقارير أكاديمية وإحصائية دقيقة لدعم الإدارة.",
        "تقديم خدمات تعليمية رقمية أكثر كفاءة وموثوقية."
    ]
    add_bullet_list_table(doc, items_conclusion, space_after_p=3.0)
    
    add_body_p(doc,
        "إن اعتماد هذا المشروع يعد استثماراً طويلاً الأمد في تطوير بيئة العمل ورفع كفاءة الإدارة بما يتماشى مع الرؤية المستقبلية لأي مؤسسة تعليمية تسعى إلى تطوير أدائها الأكاديمي ومهامها.",
        size_pt=11, space_before=6, space_after=0)
        
    doc.save(docx_path)
    print(f"Generated DOCX: {docx_path}")

def convert_to_pdf(docx_path, pdf_path):
    abs_docx = os.path.abspath(docx_path)
    abs_pdf = os.path.abspath(pdf_path)
    
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    word.DisplayAlerts = 0
    try:
        wdoc = word.Documents.Open(abs_docx)
        wdoc.SaveAs(abs_pdf, FileFormat=17)
        wdoc.Close()
        print(f"Converted to PDF: {abs_pdf}")
    finally:
        word.Quit()

def render_preview(pdf_path, out_dir="pdf_preview"):
    os.makedirs(out_dir, exist_ok=True)
    doc = pymupdf.open(pdf_path)
    print(f"Total pages in final PDF: {len(doc)}")
    for i in range(len(doc)):
        pix = doc[i].get_pixmap(dpi=150)
        p_path = os.path.join(out_dir, f"page_{i+1}.png")
        pix.save(p_path)
        print(f"Saved page preview: {p_path}")

if __name__ == "__main__":
    docx_file = "Hadir_Project_Proposal.docx"
    pdf_file = "Hadir_Project_Proposal.pdf"
    build_complete_proposal(docx_file)
    convert_to_pdf(docx_file, pdf_file)
    render_preview(pdf_file)
