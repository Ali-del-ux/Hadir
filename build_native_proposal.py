import win32com.client
import pymupdf
import os

def create_hadir_proposal():
    logo_path = os.path.abspath("extracted_page_0_0_X6.png")
    out_docx = os.path.abspath("Hadir_Project_Proposal.docx")
    out_pdf = os.path.abspath("Hadir_Project_Proposal.pdf")
    
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    word.DisplayAlerts = 0
    
    try:
        doc = word.Documents.Add()
        
        # Page Setup (A4, balanced margins)
        doc.PageSetup.PaperSize = 7 # wdPaperA4
        doc.PageSetup.TopMargin = 55
        doc.PageSetup.BottomMargin = 55
        doc.PageSetup.LeftMargin = 72
        doc.PageSetup.RightMargin = 72
        
        sel = word.Selection
        sel.ParagraphFormat.ReadingOrder = 0 # wdReadingOrderRtl
        sel.Font.Name = "Arial"
        
        def reset_p(align=2, space_before=0, space_after=6, line_spacing=1.2):
            sel.ParagraphFormat.Reset()
            sel.ParagraphFormat.ReadingOrder = 0 # wdReadingOrderRtl
            sel.ParagraphFormat.Alignment = align # 1=Center, 2=Right, 3=Justify
            sel.ParagraphFormat.SpaceBefore = space_before
            sel.ParagraphFormat.SpaceAfter = space_after
            sel.ParagraphFormat.LineSpacingRule = 0
            sel.Font.Name = "Arial"
            
        def type_heading(text, size=14, space_before=14, space_after=8):
            reset_p(align=2, space_before=space_before, space_after=space_after)
            sel.Font.Size = size
            sel.Font.Bold = True
            sel.Font.Color = 0x000000
            sel.TypeText(text)
            sel.TypeParagraph()
            
        def type_subheading(text, size=12, space_before=8, space_after=4):
            reset_p(align=2, space_before=space_before, space_after=space_after)
            sel.Font.Size = size
            sel.Font.Bold = True
            sel.Font.Color = 0x000000
            sel.TypeText(text)
            sel.TypeParagraph()
            
        def type_body(text, size=11, space_before=0, space_after=8):
            reset_p(align=3, space_before=space_before, space_after=space_after)
            sel.Font.Size = size
            sel.Font.Bold = False
            sel.Font.Color = 0x000000
            sel.TypeText(text)
            sel.TypeParagraph()
            
        def type_bullet_items(items, bold_prefixes=None, space_after=3.5):
            for idx, text in enumerate(items):
                reset_p(align=2, space_before=0, space_after=space_after)
                sel.Range.ListFormat.ApplyBulletDefault()
                sel.Font.Size = 11
                if bold_prefixes and idx < len(bold_prefixes) and bold_prefixes[idx]:
                    sel.Font.Bold = True
                    sel.TypeText(bold_prefixes[idx] + " ")
                sel.Font.Bold = False
                sel.TypeText(text)
                sel.TypeParagraph()
            sel.Range.ListFormat.RemoveNumbers()
            
        # ================= PAGE 1: COVER =================
        reset_p(align=1, space_before=10, space_after=12)
        if os.path.exists(logo_path):
            shape = sel.InlineShapes.AddPicture(FileName=logo_path)
            shape.Width = 200 # ~2.75 inches
            shape.Height = 141
        sel.TypeParagraph()
        
        reset_p(align=1, space_before=24, space_after=8)
        sel.Font.Size = 13
        sel.Font.Bold = True
        sel.TypeText("مقترح مشروع تخرج لنيل درجة البكالوريوس بعنوان :")
        sel.TypeParagraph()
        
        reset_p(align=1, space_before=4, space_after=6)
        sel.Font.Size = 16
        sel.Font.Bold = True
        sel.TypeText("منظومة حاضر : منصة رقمية لإدارة الحضور وتنظيم العمل الأكاديمي")
        sel.TypeParagraph()
        
        reset_p(align=1, space_before=2, space_after=24)
        sel.Font.Size = 11.5
        sel.Font.Bold = True
        sel.TypeText("Hadir: A digital platform for attendance and academic management")
        sel.TypeParagraph()
        
        reset_p(align=1, space_before=8, space_after=22)
        sel.Font.Size = 13
        sel.Font.Bold = True
        sel.TypeText("قسم : حاسب الآلي")
        sel.TypeParagraph()
        
        reset_p(align=1, space_before=8, space_after=22)
        sel.Font.Size = 13
        sel.Font.Bold = True
        sel.TypeText("إشراف")
        sel.TypeParagraph()
        
        reset_p(align=1, space_before=8, space_after=14)
        sel.Font.Size = 13
        sel.Font.Bold = True
        sel.TypeText("إعداد وتقديم:")
        sel.TypeParagraph()
        
        # Student table (5 rows, clean blanks, names removed as requested)
        reset_p(align=1, space_before=0, space_after=0)
        table = doc.Tables.Add(Range=sel.Range, NumRows=5, NumColumns=2)
        table.Borders.Enable = False
        table.Rows.Alignment = 1 # Center
        
        for r_idx in range(1, 6):
            row = table.Rows(r_idx)
            # Left cell (Registration number blank)
            c_left = row.Cells(1)
            c_left.Width = 190
            c_left.Range.ParagraphFormat.ReadingOrder = 0
            c_left.Range.ParagraphFormat.Alignment = 0 # Left in RTL
            c_left.Range.Font.Name = "Arial"
            c_left.Range.Font.Size = 11
            c_left.Range.Font.Bold = False
            c_left.Range.Text = "رقم القيد ...................."
            
            # Right cell (Student line blank)
            c_right = row.Cells(2)
            c_right.Width = 220
            c_right.Range.ParagraphFormat.ReadingOrder = 0
            c_right.Range.ParagraphFormat.Alignment = 2 # Right
            c_right.Range.Font.Name = "Arial"
            c_right.Range.Font.Size = 11
            c_right.Range.Font.Bold = False
            c_right.Range.Text = ".................................................."
            
        # Move selection after table
        sel.SetRange(table.Range.End + 1, table.Range.End + 1)
        
        reset_p(align=1, space_before=36, space_after=0)
        sel.Font.Size = 12
        sel.Font.Bold = True
        sel.TypeText("الفصل الدراسي: ربيع 2026")
        sel.InsertBreak(7) # wdPageBreak
        
        # ================= PAGE 2 =================
        type_heading("1 - المقدمة", size=14, space_before=4, space_after=8)
        
        type_body(
            "يشهد قطاع التعليم العالي وتقنية المعلومات في المؤسسات الأكاديمية تطوراً سريعاً يتطلب تحديثاً مستمراً في آليات العمل وإدارة البيئة التعليمية داخل القاعات الدراسية. ومن أبرز التحديات التي تواجه الإدارات الجامعية وأعضاء هيئة التدريس والحاسب الآلي، هو تنظيم وضبط حضور الطلاب ومتابعة سجلات التقييم والدرجات بشكل يضمن السرعة والدقة والشفافية.",
            size=11, space_after=8
        )
        
        type_body(
            "في ظل الاعتماد الحالي على الطرق التقليدية (الاتصالات الهاتفية - المراسلات الورقية - كشوفات الحضور اليدوية - المتابعات الفردية)، ظهرت العديد من الإشكاليات التي أثرت سلباً على كفاءة العملية التعليمية والجهد الإداري. وعليه، جاء هذا المقترح لتطوير منظومة حاضر: منصة رقمية لإدارة الحضور وتنظيم العمل الأكاديمي كمنصة مركزية متكاملة A digital platform for attendance and academic management تدير حضور الطلاب وسجلات التقييم والعمليات الأكاديمية بين الأقسام بشكل رقمي متطور.",
            size=11, space_after=14
        )
        
        type_heading("2 - الوضع الحالي ومشاكل النظام القديم", size=14, space_before=8, space_after=8)
        
        type_subheading("الوضع الحالي:", size=12, space_before=4, space_after=4)
        items_cur = [
            "استقبال طلبات الحضور والمشاكل الأكاديمية عبر قنوات متعددة (ورق، اتصالات، ملفات مبعثرة).",
            "تسجيل وتوزيع رصد الدرجات والحضور يدوياً دون نظام متابعة موحد.",
            "صعوبة التحقق من الحضور الفعلي للطلاب وتفشي ظاهرة الحضور بالنيابة (التحضير الوهمي).",
            "غياب سجل مركزي موحد يربط حضور الطالب بدرجاته وسجلاته الإدارية والمالية."
        ]
        type_bullet_items(items_cur, space_after=3.5)
        
        type_subheading("المشاكل المترتبة:", size=12, space_before=8, space_after=4)
        items_prob = [
            "البطء وهدر وقت المحاضرة الثمين لغياب آلية رقمية سريعة لتسجيل الحضور.",
            "ضياع دقة البيانات وانعدام الموثوقية بسبب سهولة التوقيع عن الطلاب المتغيبين.",
            "ضعف الشفافية بين الإدارة وأعضاء هيئة التدريس والطلاب في رصد التقييمات.",
            "غياب مؤشرات الأداء وعدم توفر تقارير دقيقة تساعد الإدارة على اتخاذ القرار الأكاديمي.",
            "إرهاق إداري وأكاديمي نتيجة المتابعات الورقية والمراسلات المتكررة."
        ]
        type_bullet_items(items_prob, space_after=3.5)
        
        sel.InsertBreak(7) # wdPageBreak
        
        # ================= PAGE 3 =================
        type_heading("3 - الحل المقترح", size=14, space_before=4, space_after=8)
        
        type_body(
            "منظومة حاضر هي تطبيق ويب أكاديمي حديث يوفر منصة مركزية لإدارة حضور الطلاب، دفتر الدرجات الأكاديمي، وتوزيع ومتابعة المهام والعمليات التعليمية.",
            size=11, space_after=10
        )
        
        type_subheading("آلية عمله:", size=12, space_before=4, space_after=4)
        items_sol = [
            "تسجيل الحضور إلكترونياً عبر رمز QR ديناميكي يتجدد تلقائياً كل 20 ثانية عبر النظام لمنع تصوير الشاشة.",
            "مسح الرمز مباشرة من قبل الطالب عبر كاميرا جهازه لتوثيق الحضور الفوري في قاعدة البيانات.",
            "إشعارات فورية وتنبيهات تفاعلية عبر النظام بشأن الجلسات وحالة الحضور والواجبات.",
            "دفتر درجات أكاديمي شامل (بمعايير عالمية) يتيح ضبط أوزان التقييمات 100% واحتساب فوري للمعدل التراكمي.",
            "توثيق كامل لكل جلسة تحضير وتقييم أكاديمي من البداية وحتى الاعتماد النهائي.",
            "استخراج تقارير إحصائية عامة وفردية بضغطة زر."
        ]
        type_bullet_items(items_sol, space_after=3.5)
        
        type_heading("4 - نطاق المشروع (Scope of Work)", size=14, space_before=10, space_after=8)
        
        type_subheading("يشمل النظام:", size=12, space_before=4, space_after=4)
        items_sc = [
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
        type_bullet_items(items_sc, space_after=3.0)
        
        sel.InsertBreak(7) # wdPageBreak
        
        # ================= PAGE 4 =================
        type_heading("5 - الواجهات (Interfaces)", size=14, space_before=4, space_after=8)
        
        type_subheading("أ. واجهات المستخدم (الطلاب والمحاضرون):", size=12, space_before=4, space_after=4)
        items_ui_u = [
            "تسجيل الدخول والملف الشخصي.",
            "الواجهة الرئيسية للطالب (ملخص المواد المسجلة - نسبة الحضور - المعدل التراكمي).",
            "واجهة مسح رمز الحضور الذكي (QR Scanner).",
            "واجهة كشف الدرجات الأكاديمي وجدول المحاضرات الموزع بالقاعات.",
            "واجهة السجل المالي الجامعي والإيصالات.",
            "واجهة المحاضر الرئيسية وقائمة المقررات الموكلة.",
            "شاشة توليد وعرض الـ QR المتغير كل 20 ثانية مع عداد تنازلي حي.",
            "دفتر درجات المحاضر (رصد وتعديل الدرجات وضبط أوزان التقييمات)."
        ]
        type_bullet_items(items_ui_u, space_after=3.0)
        
        type_subheading("ب. واجهات المسؤول / الإداري:", size=12, space_before=8, space_after=4)
        items_ui_a = [
            "تسجيل الدخول الإداري.",
            "الواجهة الرئيسية (إحصائيات عامة ورسوم بيانية لنشاط النظام).",
            "إدارة المستخدمين (إضافة، تعديل، قفل، وإعادة تعيين كلمات المرور).",
            "إدارة المقررات وتوزيع القاعات والجداول الدراسية.",
            "إدارة الشؤون المالية وتجميد الحسابات الأكاديمية.",
            "التقارير الأكاديمية والإحصائية (عامة - فردية)."
        ]
        type_bullet_items(items_ui_a, space_after=3.0)
        
        type_heading("6 - الفوائد والقيمة المضافة", size=14, space_before=10, space_after=6)
        prefixes_b = ["إدارية:", "تشغيلية:", "تنظيمية:", "إحصائية:", "إستراتيجية:"]
        items_b = [
            "تنظيم العمل الأكاديمي وتوحيد بيانات الطلاب وتقليل الجهد الإداري.",
            "سرعة الاستجابة وإنجاز التحضير ورصد التقييمات في ثوانٍ معدودة.",
            "توثيق شامل ودقيق لكافة بيانات الحضور ومنع التحضير بالنيابة.",
            "تقارير دقيقة وحساب فوري للمعدل التراكمي لدعم اتخاذ القرار.",
            "دعم التحول الرقمي وترسيخ معايير الحرم الجامعي الذكي."
        ]
        type_bullet_items(items_b, bold_prefixes=prefixes_b, space_after=3.0)
        
        sel.InsertBreak(7) # wdPageBreak
        
        # ================= PAGE 5 =================
        type_heading("7 - المتطلبات التقنية", size=14, space_before=4, space_after=8)
        
        type_subheading("المتطلبات البرمجية (Software):", size=12, space_before=4, space_after=4)
        items_sw = [
            "بيئة الواجهة الأمامية: React 18 مع لغة TypeScript ومكتبة Tailwind CSS و Vite.",
            "الخادم الخلفي (Backend): بيئة Node.js مع إطار العمل Express.js ولغة TypeScript.",
            "قاعدة البيانات: MySQL 8.0 مع دعم المعاملات المتزامنة (InnoDB Transactions).",
            "الأمان والتشفير: مكتبات Zod للتحقق، خوارزمية HMAC-SHA256 للـ QR، وتشفير JWT و Bcrypt."
        ]
        type_bullet_items(items_sw, space_after=3.0)
        
        type_subheading("المتطلبات التشغيلية (Hardware/Hosting):", size=12, space_before=6, space_after=4)
        items_hw = [
            "جهاز إلكتروني (هاتف محمول، حاسوب لوحي، حاسوب مكتبي أو محمول).",
            "خادم استضافة محلي أو سحابي لتشغيل المنظومة وقاعدة البيانات.",
            "شبكة اتصال محلية (Wi-Fi) أو اتصال إنترنت ثابت."
        ]
        type_bullet_items(items_hw, space_after=3.0)
        
        type_subheading("الاستضافة عبر مزود خدمة خارجي:", size=12, space_before=6, space_after=4)
        items_host = [
            "نطاق رسمي مخصص (Domain).",
            "استضافة بسعة تخزينية وموارد مناسبة لتشغيل الخادم وقاعدة البيانات.",
            "شهادة أمان SSL لتشفير الاتصال وضمان عمل كاميرا المتصفح ومسح الـ QR بأمان."
        ]
        type_bullet_items(items_host, space_after=3.0)
        
        type_heading("الخاتمة", size=14, space_before=8, space_after=6)
        
        type_body(
            "يمثل هذا المقترح خطوة إستراتيجية لدعم التحول الرقمي داخل إدارة تقنية المعلومات والحاسب الآلي والأقسام الأكاديمية.",
            size=11, space_after=6
        )
        
        type_subheading("النظام المقترح يعالج التحديات الحالية ويوفر قيمة مضافة عبر:", size=12, space_before=4, space_after=4)
        items_conc = [
            "تسريع وضبط الحضور بالـ QR المتغير ومنع التحضير بالنيابة.",
            "تعزيز الشفافية والموثوقية في رصد وتوزيع الدرجات الأكاديمية.",
            "استخراج تقارير أكاديمية وإحصائية دقيقة لدعم الإدارة.",
            "تقديم خدمات تعليمية رقمية أكثر كفاءة وموثوقية."
        ]
        type_bullet_items(items_conc, space_after=3.0)
        
        type_body(
            "إن اعتماد هذا المشروع يعد استثماراً طويلاً الأمد في تطوير بيئة العمل ورفع كفاءة الإدارة بما يتماشى مع الرؤية المستقبلية لأي مؤسسة تعليمية تسعى إلى تطوير أدائها الأكاديمي ومهامها.",
            size=11, space_before=6, space_after=0
        )
        
        # Save DOCX and PDF
        doc.SaveAs2(out_docx, 16) # wdFormatXMLDocument
        doc.SaveAs2(out_pdf, 17)  # wdFormatPDF
        doc.Close()
        print(f"Generated DOCX: {out_docx}")
        print(f"Generated PDF: {out_pdf}")
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
    create_hadir_proposal()
    render_preview("Hadir_Project_Proposal.pdf")
