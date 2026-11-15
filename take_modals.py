import os
import sys
import time

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from playwright.sync_api import sync_playwright

DESKTOP = os.path.expanduser('~/OneDrive/Desktop')
BASE_DIR = os.path.join(DESKTOP, 'Hadir_Screenshots')
BASE_URL = 'http://localhost:8091'

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    context = browser.new_context(viewport={'width': 1600, 'height': 1000}, device_scale_factor=1.5, locale='ar-LY')
    page = context.new_page()

    # Clear everything and go to login
    page.goto(f'{BASE_URL}/login')
    page.evaluate("() => localStorage.clear()")
    page.reload()
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    page.click("button:has-text('طالب')")
    page.click("button[type='submit']")
    page.wait_for_load_state('networkidle')
    time.sleep(1.5)

    page.click("aside button:has-text('السجل والمعدل')")
    time.sleep(1)
    transcript_btn = page.locator("button:has-text('كشف درجات معتمد')")
    if transcript_btn.count() > 0:
        transcript_btn.first.click()
        time.sleep(1)
        page.screenshot(path=os.path.join(BASE_DIR, '01_حساب_الطالب_علي_بي', '03_كشف_الدرجات_المعتمد_Official_Transcript.png'))
        print("Captured Official Transcript modal")

    browser.close()
