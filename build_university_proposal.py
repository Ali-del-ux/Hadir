import win32com.client
import pymupdf
import os

def create_university_proposal():
    logo_path = os.path.abspath("extracted_page_0_0_X6.png")
    out_docx = os.path.abspath("Hadir_Project_Proposal.docx")
    out_pdf = os.path.abspath("Hadir_Project_Proposal.pdf")
    
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    word.DisplayAlerts = 0
    
    try:
        doc = word.Documents.Add()
        
        # Page Setup (A4, balanced margins 0.75 in top/bottom, 0.95 in left/right)
        doc.PageSetup.PaperSize = 7 # wdPaperA4
        doc.PageSetup.TopMargin = 50
        doc.PageSetup.BottomMargin = 50
        doc.PageSetup.LeftMargin = 68
        doc.PageSetup.RightMargin = 68
        
        sel = word.Selection
        sel.ParagraphFormat.ReadingOrder = 0 # wdReadingOrderRtl
        sel.Font.Name = "Arial"
        
        def reset_p(align=2, space_before=0, space_after=4, line_spacing=1.18):
            sel.ParagraphFormat.Reset()
            sel.ParagraphFormat.ReadingOrder = 0 # wdReadingOrderRtl
            sel.ParagraphFormat.Alignment = align # 1=Center, 2=Right, 3=Justify
            sel.ParagraphFormat.SpaceBefore = space_before
            sel.ParagraphFormat.SpaceAfter = space_after
            sel.ParagraphFormat.LineSpacingRule = 0
            sel.Font.Name = "Arial"
            
        def type_heading(text, size=13.5, space_before=11, space_after=6):
            reset_p(align=2, space_before=space_before, space_after=space_after)
            sel.Font.Size = size
            sel.Font.Bold = True
            sel.Font.Color = 0x000000
            sel.TypeText(text)
            sel.TypeParagraph()
            
        def type_subheading(text, size=11.5, space_before=6, space_after=3):
            reset_p(align=2, space_before=space_before, space_after=space_after)
            sel.Font.Size = size
            sel.Font.Bold = True
            sel.Font.Color = 0x000000
            sel.TypeText(text)
            sel.TypeParagraph()
            
        def type_body(text, size=10.5, space_before=0, space_after=6):
            reset_p(align=3, space_before=space_before, space_after=space_after)
            sel.Font.Size = size
            sel.Font.Bold = False
            sel.Font.Color = 0x000000
            sel.TypeText(text)
            sel.TypeParagraph()
            
        def type_bullet_items(items, bold_prefixes=None, space_after=2.8):
            for idx, text in enumerate(items):
                reset_p(align=2, space_before=0, space_after=space_after)
                sel.Range.ListFormat.ApplyBulletDefault()
                sel.Font.Size = 10.5
                if bold_prefixes and idx < len(bold_prefixes) and bold_prefixes[idx]:
                    sel.Font.Bold = True
                    sel.TypeText(bold_prefixes[idx] + " ")
                sel.Font.Bold = False
                sel.TypeText(text)
                sel.TypeParagraph()
            sel.Range.ListFormat.RemoveNumbers()
            
        # =========================================================================
        # PAGE 1: COVER
        # =========================================================================
        reset_p(align=1, space_before=10, space_after=12)
        if os.path.exists(logo_path):
            shape = sel.InlineShapes.AddPicture(FileName=logo_path)
            shape.Width = 205
            shape.Height = 145
        sel.TypeParagraph()
        
        reset_p(align=1, space_before=22, space_after=8)
        sel.Font.Size = 13
        sel.Font.Bold = True
        sel.TypeText("مقترح مشروع تخرج لنيل درجة البكالوريوس بعنوان :")
        sel.TypeParagraph()
        
        reset_p(align=1, space_before=4, space_after=6)
        sel.Font.Size = 15.5
        sel.Font.Bold = True
        sel.TypeText("منظومة حاضر : منصة جامعية متكاملة لإدارة وتنظيم العمليات والشؤون الأكاديمية")
        sel.TypeParagraph()
        
        reset_p(align=1, space_before=2, space_after=24)
        sel.Font.Size = 11
        sel.Font.Bold = True
        sel.TypeText("Hadir: An Integrated Academic Platform for University Operations & LMS")
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
        
        # =========================================================================
        # PAGE 2: 1 - المقدمة & 2 - الوضع الحالي ومشاكل النظام القديم
        # =========================================================================
        type_heading("1 - المقدمة", size=13.5, space_before=4, space_after=7)
        
        type_body(
            "يشهد قطاع التعليم العالي وإدارة المؤسسات الجامعية تحولاً رقمياً متسارعاً يفرض ضرورة الانتقال من الآليات التقليدية والأنظمة المنفصلة إلى منصات حوسبة أكاديمية مركزية وموحدة. وتواجه الجامعات والكليات تحدياً محورياً يتمثل في إدارة وتنظيم منظومة العمل الجامعي بمختلف أبعادها: بدءاً من تسجيل الطلاب في المقررات، وتوزيع الجداول والقاعات، وإدارة المحاضرات والتكليفات، وصولاً إلى الرصد الأكاديمي الموزون للدرجات، ومتابعة السجلات المالية، وضبط الحضور الجامعي، بصورة تضمن الشفافية والدقة والكفاءة الإدارية.",
            size=10.5, space_after=7
        )
        
        type_body(
            "في ظل اعتماد العديد من الكليات والأقسام على أساليب عمل مجزأة (ملفات إكسل متفرقة، كشوفات درجات يدوية، استلام ورقي للواجبات، وسجلات مالية منفصلة عن القيد الأكاديمي)، ظهرت إشكاليات أثرت سلباً على الإنتاجية وتسببت في هدر الوقت وتشتت البيانات. وعليه، جاء هذا المقترح لتطوير «منظومة حاضر»: منصة جامعية متكاملة لإدارة وتنظيم العمليات والشؤون الأكاديمية (Hadir Integrated Academic LMS Platform) لتوفر بيئة رقمية موحدة تجمع إدارة الكلية، أعضاء هيئة التدريس، والطلاب في منصة سحابية واحدة تدير المقررات، التقييم، التكليفات، الحسابات، والحضور الذكي بأعلى معايير الأمان السيبراني.",
            size=10.5, space_after=12
        )
        
        type_heading("2 - الوضع الحالي ومشاكل النظام القديم", size=13.5, space_before=6, space_after=7)
        
        type_subheading("الوضع الحالي:", size=11.5, space_before=3, space_after=3)
        items_cur = [
            "تشتت العمليات الجامعية بين ملفات ورقية وكشوفات حاسوبية غير مرتبطة بنظام مركزي موحد.",
            "رصد وتوزيع درجات الطلاب واحتساب المعدل التراكمي (GPA) بصورة يدوية دون معايير وزن موحدة.",
            "تبادل المحاضرات والمواد العلمية واستلام واجبات الطلاب عبر قنوات شخصية غير مؤمنة ومبعثرة.",
            "انفصال السجلات المالية وسداد الرسوم عن حالة القيد الأكاديمي وجداول المحاضرات للطلبة.",
            "الاعتماد على الكشوفات الورقية لتسجيل الحضور مع تفشي ظاهرة الحضور بالنيابة والتحضير الوهمي."
        ]
        type_bullet_items(items_cur, space_after=2.8)
        
        type_subheading("المشاكل المترتبة:", size=11.5, space_before=6, space_after=3)
        items_prob = [
            "إرهاق إداري وأكاديمي بالغ وهدر وقت المحاضرات في التدقيق اليدوي ومطابقة السجلات المبعثرة.",
            "تأخر صدور كشوفات الدرجات وضعف الشفافية وموثوقية التقييم واحتساب المعدلات التراكمية.",
            "ضياع تكليفات وواجبات الطلاب وغياب منصة موثوقة لحفظ السجلات وتوثيق التغذية الراجعة.",
            "صعوبة تنظيم حجز القاعات والمدرجات الدراسية وتكرار التضارب في الجداول الأسبوعية.",
            "غياب مؤشرات الأداء والتقارير الأكاديمية الفورية التي تدعم إدارة الكلية في اتخاذ القرارات."
        ]
        type_bullet_items(items_prob, space_after=2.8)
        
        sel.InsertBreak(7) # wdPageBreak
        
        # =========================================================================
        # PAGE 3: 3 - الحل المقترح & 4 - نطاق المشروع
        # =========================================================================
        type_heading("3 - الحل المقترح", size=13.5, space_before=4, space_after=7)
        
        type_body(
            "«منظومة حاضر» هي منصة جامعية متكاملة (Web-based Academic LMS Platform) تعمل كحلقة وصل مركزية تربط الإدارة الجامعية، المحاضرين، والطلاب لإدارة وتنسيق كافة الأنشطة والعمليات الأكاديمية والتعليمية والمالية بدقة عالية وأتمتة كاملة.",
            size=10.5, space_after=8
        )
        
        type_subheading("آلية عمله:", size=11.5, space_before=3, space_after=3)
        items_sol = [
            "بوابة موحدة لإدارة المقررات والشُعب الدراسية وتسكين الطلاب وتعيين أعضاء هيئة التدريس.",
            "نظام محتوى تعليمي ومحاضرات يتيح للأستاذ رفع المواد العلمية والمراجع وإعلان التوجيهات للطلبة.",
            "منظومة تكليفات وواجبات متكاملة لاستقبال ملفات الطلاب وفحصها أمنياً وتقييمها وتقديم التغذية الراجعة.",
            "دفتر درجات أكاديمي متوافق مع معايير Moodle يتيح توزيع أوزان التقييم (100%) واحتساب فوري للمعدل (GPA).",
            "سجل مالي جامعي يوثق الرسوم وسندات القبض ويفعل التجميد الأكاديمي التلقائي وفك التجميد فور السداد.",
            "تقنية الحضور الذكي بالـ QR الديناميكي المتغير كل 20 ثانية عبر خوارزمية مشفرة لمنع التحضير بالنيابة.",
            "مركز تقارير أكاديمية لاستخراج كشوفات الدرجات المعتمدة، نسب الحضور، والبيانات الإحصائية بضغطة زر."
        ]
        type_bullet_items(items_sol, space_after=2.8)
        
        type_heading("4 - نطاق المشروع (Scope of Work)", size=13.5, space_before=8, space_after=7)
        
        type_subheading("يشمل النظام:", size=11.5, space_before=3, space_after=3)
        items_sc = [
            "إدارة المقررات والشُعب الدراسية وتوزيع القاعات والمدرجات والجداول الأسبوعية.",
            "إدارة التسجيل الأكاديمي (Enrollment) وقيد الطلاب وإدارة الساعات المعتمدة.",
            "إدارة المحاضرات والمواد التعليمية والملفات المرفقة بصيغ متعددة.",
            "نظام الواجبات والتسليمات (Assignments) مع التحقق الأمني من امتدادات وأحجام الملفات.",
            "دفتر الدرجات الأكاديمي الشامل (Gradebook) وحساب المعدل التراكمي والفصلي (4.0 GPA).",
            "السجل المالي الجامعي (Financial Ledger) وسندات القبض وآلية التجميد الأكاديمي للحسابات.",
            "وحدة الحضور الذكي برمز الـ QR المتجدد كل 20 ثانية (Rotating QR Attendance).",
            "إدارة المستخدمين والصلاحيات المتعددة (مدير النظام Admin - المحاضر Teacher - الطالب Student).",
            "تأمين الجلسات والحسابات بالتحقق الثنائي (2FA) ومعايير الدفاع السيبراني الاستباقي (OWASP).",
            "قابلية التوسع والربط المستقبلي مع الأنظمة المركزية لوزارة التعليم العالي والجامعات."
        ]
        type_bullet_items(items_sc, space_after=2.6)
        
        sel.InsertBreak(7) # wdPageBreak
        
        # =========================================================================
        # PAGE 4: 5 - الواجهات & 6 - الفوائد والقيمة المضافة
        # =========================================================================
        type_heading("5 - الواجهات (Interfaces)", size=13.5, space_before=4, space_after=7)
        
        type_subheading("أ. واجهات المستخدم (الطلاب وأعضاء هيئة التدريس):", size=11.5, space_before=3, space_after=3)
        items_ui_u = [
            "بوابة الطالب: الواجهة الرئيسية الأكاديمية (المعدل التراكمي GPA، المقررات المسجلة، ملخص الحضور، والرصيد المالي).",
            "بوابة الطالب: شاشة المقررات والمحاضرات (استعراض المناهج، تحميل المراجع العلمية، والتواصل مع أستاذ المادة).",
            "بوابة الطالب: واجهة الواجبات والتسليمات (استعراض التكليفات المطلوبة، رفع الحلول والملفات، واستلام التقييم والدرجة).",
            "بوابة الطالب: كشف الدرجات الأكاديمي المعتمد والسجل التراكمي التفصيلي.",
            "بوابة الطالب: الجدول الدراسي الأسبوعي موزعاً حسب القاعات الدراسية والمدرجات.",
            "بوابة الطالب: السجل المالي الجامعي (كشف الرسوم، الأقساط المسددة، المتبقي، وأرقام إيصالات القبض).",
            "بوابة المحاضر: لوحة التدريس الرئيسية وإدارة المقررات وتوصيف المناهج الموكلة.",
            "بوابة المحاضر: مركز المحاضرات والملفات (رفع المحتوى الأكاديمي، الشرائح، وإعلانات الشعب).",
            "بوابة المحاضر: إدارة الواجبات (طرح التكليفات، ضبط المواعيد النهائية، وتنزيل تسليمات الطلبة وتصحيحها).",
            "بوابة المحاضر: دفتر درجات Moodle (ضبط أوزان أعمال الفصل 100%، رصد درجات الاختبارات، واحتساب المعدل).",
            "بوابة المحاضر: شاشة الـ QR المتغير كل 20 ثانية للتحضير الذكي، ومتابعة قائمة الحضور اللحظية."
        ]
        type_bullet_items(items_ui_u, space_after=2.5)
        
        type_subheading("ب. واجهات المسؤول / الإداري (Admin Portal):", size=11.5, space_before=5, space_after=3)
        items_ui_a = [
            "لوحة القيادة الإحصائية (إجمالي الطلاب، أعضاء التدريس، المقررات النشطة، ونسب الحضور ومؤشرات النظام).",
            "إدارة المستخدمين والدعم الفني (إضافة وتعديل بيانات الطلاب والأساتذة، قفل الحسابات، وإعادة تعيين كلمات المرور).",
            "إدارة المقررات والشُعب الدراسية وتسكين القاعات والمدرجات وضبط الساعات المعتمدة.",
            "إدارة التسجيل الأكاديمي وتوزيع الطلاب على الشُعب الدراسية وفق اللائحة الأكاديمية.",
            "الشؤون المالية الجامعية (إصدار إيصالات القبض، متابعة الأقساط، وتجميد/فك تجميد الحسابات آلياً).",
            "مركز التقارير الشاملة (كشوف الدرجات المعتمدة، تقارير الحضور والغياب، والسجلات المالية المفصلة)."
        ]
        type_bullet_items(items_ui_a, space_after=2.5)
        
        type_heading("6 - الفوائد والقيمة المضافة", size=13.5, space_before=7, space_after=5)
        prefixes_b = ["أكاديمية:", "إدارية:", "تعليمية:", "مالية:", "تنظيمية:", "إستراتيجية:"]
        items_b = [
            "توحيد معايير تقييم الطلاب ورصد الدرجات واحتساب المعدل التراكمي (GPA) بدقة وموثوقية تامة.",
            "أتمتة العمليات الجامعية وتوحيد السجلات وإلغاء المعاملات الورقية وتوفير وقت وجهد الكادر الإداري.",
            "تسهيل التواصل التعليمي وتبادل المواد العلمية وتوثيق استلام وتصحيح الواجبات الجامعية.",
            "إحكام الرقابة على تحصيل الرسوم الجامعية وربطها الآلي بانتظام القيد والخدمات الأكاديمية.",
            "القضاء الحاسم على ظاهرة التحضير بالنيابة وضبط حضور المحاضرات الجامعية بنسبة 100%.",
            "ترسيخ التحول الرقمي ودعم معايير الحرم الجامعي الذكي ورفع تصنيف وجودة المؤسسة الأكاديمية."
        ]
        type_bullet_items(items_b, bold_prefixes=prefixes_b, space_after=2.5)
        
        sel.InsertBreak(7) # wdPageBreak
        
        # =========================================================================
        # PAGE 5: 7 - المتطلبات التقنية & الخاتمة
        # =========================================================================
        type_heading("7 - المتطلبات التقنية", size=13.5, space_before=4, space_after=7)
        
        type_subheading("المتطلبات البرمجية (Software Architecture):", size=11.5, space_before=3, space_after=3)
        items_sw = [
            "الواجهة الأمامية (Frontend): مكتبة React 18، لغة TypeScript، إطار Tailwind CSS، مكتبة Lucide Icons، ومحرك البناء Vite.",
            "الخادم الخلفي (Backend API): بيئة Node.js (v20+) مع إطار العمل Express.js ولغة TypeScript بمعمارية Modular Services.",
            "قاعدة البيانات (Database): محرك MySQL 8.0 بدعم كامل لمعاملات الأمان المتزامنة (InnoDB ACID Transactions).",
            "الأمان والتشفير: مكتبة Zod للتحقق من البيانات، خوارزمية HMAC-SHA256 للـ QR، وتوثيق JWT، وتشفير Bcrypt لكلمات المرور."
        ]
        type_bullet_items(items_sw, space_after=2.6)
        
        type_subheading("المتطلبات التشغيلية (Hardware & Environment):", size=11.5, space_before=5, space_after=3)
        items_hw = [
            "أجهزة حاسوب (مكتبية أو محمولة) لإدارة النظام وعمادة الكلية وأعضاء هيئة التدريس.",
            "هواتف ذكية أو أجهزة لوحية أو حواسيب شخصية للطلاب مزودة بمتصفح حديث وكاميرا.",
            "خادم استضافة (محلي داخل الجامعة أو سحابي Cloud VM) بمواصفات ملائمة (4 Cores CPU, 8GB RAM فما فوق).",
            "شبكة اتصال محلية (Campus LAN / Wi-Fi) أو اتصال إنترنت مستقر لتأمين التزامن اللحظي للبيانات."
        ]
        type_bullet_items(items_hw, space_after=2.6)
        
        type_subheading("الاستضافة وبيئة النشر والربط:", size=11.5, space_before=5, space_after=3)
        items_host = [
            "نطاق مؤسسي مخصص ورسمي للجامعة (Custom University Domain).",
            "استضافة سحابية بسعة تخزينية وموارد مناسبة لتشغيل الخادم وتخزين الملفات والمحاضرات والواجبات.",
            "شهادة أمان مشفرة (SSL / HTTPS) لضمان سرية البيانات وتفعيل كاميرا المتصفح لمسح الـ QR بأمان.",
            "بيئة تشغيل بالحاويات (Docker Containers) تضمن سهولة نشر وتوسيع النظام عبر مختلف مراكز البيانات."
        ]
        type_bullet_items(items_host, space_after=2.6)
        
        type_heading("الخاتمة", size=13.5, space_before=7, space_after=5)
        
        type_body(
            "يمثل مقترح «منظومة حاضر» نقلة نوعية واستراتيجية نحو رقمنة العمل الجامعي وتحقيق مفهوم الحرم الجامعي الذكي (Smart Campus)، حيث يتجاوز النظام النمط التقليدي ليقدم منصة أكاديمية شاملة تدير الدورة التعليمية والإدارية والمالية بأعلى درجات الكفاءة والموثوقية.",
            size=10.5, space_after=5
        )
        
        type_subheading("النظام المقترح يعالج التحديات القائمة ويوفر قيمة مضافة عبر:", size=11.5, space_before=3, space_after=3)
        items_conc = [
            "حوكمة متكاملة لتسجيل المقررات والشُعب وتوزيع القاعات والمدرجات والجداول الدراسية.",
            "أتمتة دفتر الدرجات وتطبيق معايير التقييم العالمية مع حساب فوري للمعدل التراكمي (GPA).",
            "بيئة تعليمية تفاعلية لتبادل المحاضرات والمواد العلمية واستلام وتصحيح الواجبات الجامعية.",
            "ضبط الشؤون المالية وسندات القبض وربطها الآلي بالتجميد الأكاديمي لحماية حقوق المؤسسة.",
            "منظومة حضور ذكية مانعة للتزوير والتحضير بالنيابة تدعم انضباط العملية التعليمية."
        ]
        type_bullet_items(items_conc, space_after=2.6)
        
        type_body(
            "إن اعتماد هذا المشروع يعد استثماراً مؤسسياً طويل الأمد في تطوير بيئة التعليم الجامعي ورفع كفاءة الحوكمة الأكاديمية بما يتوافق مع الرؤية المستقبلية لوزارة التعليم العالي والجامعات المعاصرة الساعية إلى الجودة والاعتماد الأكاديمي.",
            size=10.5, space_before=5, space_after=0
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
    create_university_proposal()
    render_preview("Hadir_Project_Proposal.pdf")
