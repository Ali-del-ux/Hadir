import os
import sys
import time

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8091"
DESKTOP = os.path.expanduser("~/OneDrive/Desktop")
OUTPUT_BASE = os.path.join(DESKTOP, "Hadir_Screenshots")

DIR_LOGIN = os.path.join(OUTPUT_BASE, "00_تسجيل_الدخول")
DIR_STUDENT = os.path.join(OUTPUT_BASE, "01_حساب_الطالب_علي_بي")
DIR_TEACHER = os.path.join(OUTPUT_BASE, "02_حساب_المحاضر_د_احمد")
DIR_ADMIN = os.path.join(OUTPUT_BASE, "03_حساب_المدير_ادارة_النظام")

for d in [DIR_LOGIN, DIR_STUDENT, DIR_TEACHER, DIR_ADMIN]:
    os.makedirs(d, exist_ok=True)

def run():
    with sync_playwright() as p:
        print("Launching Edge browser...")
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(
            viewport={"width": 1600, "height": 1000},
            device_scale_factor=1.5,
            locale="ar-LY",
        )
        page = context.new_page()

        # ==========================================
        # 1. LOGIN SCREENSHOTS
        # ==========================================
        print("1. Capturing Login Page...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Light mode login
        page.screenshot(path=os.path.join(DIR_LOGIN, "01_تسجيل_الدخول_الوضع_الفاتح.png"), full_page=True)
        print(" -> Captured 01_تسجيل_الدخول_الوضع_الفاتح.png")

        # Toggle to dark mode on login
        theme_btn = page.locator("button[title='تبديل المظهر']")
        if theme_btn.count() > 0:
            theme_btn.click()
            time.sleep(0.5)
            page.screenshot(path=os.path.join(DIR_LOGIN, "02_تسجيل_الدخول_الوضع_الليلي.png"), full_page=True)
            print(" -> Captured 02_تسجيل_الدخول_الوضع_الليلي.png")
            # switch back to light or keep dark
            theme_btn.click()
            time.sleep(0.3)

        # ==========================================
        # 2. STUDENT ACCOUNT (علي بي)
        # ==========================================
        print("\n2. Logging in as Student (student1@test.com)...")
        # Click student demo button
        student_btn = page.locator("button:has-text('طالب')")
        if student_btn.count() > 0:
            student_btn.first.click()
        else:
            page.fill("input[name='identifier'], input[placeholder*='name@university']", "student1@test.com")
            page.fill("input[type='password']", "password123")

        time.sleep(0.5)
        page.click("button[type='submit']")
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        student_tabs = [
            ("الرئيسية", "01_الرئيسية_والنظرة_العامة.png"),
            ("تسجيل الحضور", "02_تسجيل_الحضور_QR.png"),
            ("السجل والمعدل", "03_السجل_والمعدل_Moodle_GPA.png"),
            ("السجل المالي", "04_السجل_المالي_والإيصالات.png"),
            ("الواجبات", "05_الواجبات_والتكليفات.png"),
            ("الجدول الدراسي", "06_الجدول_الدراسي_والقاعات.png"),
            ("حسابي الجامعي", "07_حسابي_الجامعي.png"),
            ("الإعدادات والأمان", "08_الإعدادات_والأمان_2FA.png"),
        ]

        for label, filename in student_tabs:
            print(f" -> Navigating to Student tab: {label}...")
            tab_btn = page.locator(f"aside button:has-text('{label}')")
            if tab_btn.count() > 0:
                tab_btn.first.click()
                time.sleep(1)
                page.screenshot(path=os.path.join(DIR_STUDENT, filename), full_page=True)
                print(f"    Saved: {filename}")
            else:
                print(f"    Warning: tab '{label}' not found")

        # Logout
        print(" Logging out student...")
        logout_btn = page.locator("aside button:has-text('تسجيل الخروج')")
        if logout_btn.count() > 0:
            logout_btn.first.click()
            page.wait_for_load_state("networkidle")
            time.sleep(1.5)

        # ==========================================
        # 3. TEACHER ACCOUNT (د. أحمد علي)
        # ==========================================
        print("\n3. Logging in as Teacher (teacher@test.com)...")
        teacher_btn = page.locator("button:has-text('محاضر')")
        if teacher_btn.count() > 0:
            teacher_btn.first.click()
        else:
            page.fill("input[name='identifier'], input[placeholder*='name@university']", "teacher@test.com")
            page.fill("input[type='password']", "password123")

        time.sleep(0.5)
        page.click("button[type='submit']")
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        teacher_tabs = [
            ("لوحة التدريس", "01_لوحة_التدريس_الرئيسية.png"),
            ("جلسات الحضور", "02_جلسات_الحضور_QR_20s.png"),
            ("دفتر الدرجات", "03_دفتر_الدرجات_Moodle_رصد.png"),
            ("الواجبات والتسليمات", "04_الواجبات_والتسليمات.png"),
            ("المحاضرات والملفات", "05_المحاضرات_والملفات.png"),
            ("تقارير الحضور", "06_تقارير_الحضور_الأكاديمية.png"),
            ("الملف الأكاديمي", "07_الملف_الأكاديمي.png"),
            ("الإعدادات", "08_الإعدادات_والأمان.png"),
        ]

        for label, filename in teacher_tabs:
            print(f" -> Navigating to Teacher tab: {label}...")
            tab_btn = page.locator(f"aside button:has-text('{label}')")
            if tab_btn.count() > 0:
                tab_btn.first.click()
                time.sleep(1)
                page.screenshot(path=os.path.join(DIR_TEACHER, filename), full_page=True)
                print(f"    Saved: {filename}")
            else:
                print(f"    Warning: tab '{label}' not found")

        # Logout
        print(" Logging out teacher...")
        logout_btn = page.locator("aside button:has-text('تسجيل الخروج')")
        if logout_btn.count() > 0:
            logout_btn.first.click()
            page.wait_for_load_state("networkidle")
            time.sleep(1.5)

        # ==========================================
        # 4. ADMIN ACCOUNT (مدير النظام)
        # ==========================================
        print("\n4. Logging in as Admin (admin)...")
        admin_btn = page.locator("button:has-text('مدير')")
        if admin_btn.count() > 0:
            admin_btn.first.click()
        else:
            page.fill("input[name='identifier'], input[placeholder*='name@university']", "admin")
            page.fill("input[type='password']", "admin123")

        time.sleep(0.5)
        page.click("button[type='submit']")
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        admin_tabs = [
            ("لوحة الإحصائيات", "01_لوحة_الإحصائيات_المركزية.png"),
            ("إدارة المستخدمين والدعم", "02_إدارة_المستخدمين_والدعم.png"),
            ("الشؤون المالية والتجميد", "03_الشؤون_المالية_والتجميد.png"),
            ("المقررات والشُعب", "04_المقررات_والقاعات_الدراسية.png"),
            ("التسجيل الأكاديمي", "05_التسجيل_الأكاديمي_والتوزيع.png"),
            ("حساب المدير", "06_حساب_المدير.png"),
            ("إعدادات النظام", "07_إعدادات_النظام_والأمان.png"),
        ]

        for label, filename in admin_tabs:
            print(f" -> Navigating to Admin tab: {label}...")
            tab_btn = page.locator(f"aside button:has-text('{label}')")
            if tab_btn.count() > 0:
                tab_btn.first.click()
                time.sleep(1)
                page.screenshot(path=os.path.join(DIR_ADMIN, filename), full_page=True)
                print(f"    Saved: {filename}")
            else:
                print(f"    Warning: tab '{label}' not found")

        browser.close()
        print("\n✅ All screenshots captured and saved successfully!")
        print(f"Location: {OUTPUT_BASE}")

if __name__ == "__main__":
    run()
