import urllib.request
import json

# 1. データの取得（GASから）
import ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://script.google.com/macros/s/AKfycbwJP2Ep80n7AdZrqYdgNlkdTpr2h41l6fqLT2pvXe1cxOzd3FR1rkhyhi7XcsXGIVx8/exec"
try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, context=ctx) as response:
        data = json.loads(response.read().decode('utf-8'))
        practices = data.get('practices', [])
except Exception as e:
    practices = []

# 2. HTML要素の生成
html_content = ""
day_classes = {"月": "mon", "火": "tue", "水": "wed", "木": "thu", "金": "fri", "土": "sat", "日": "sun"}

if not practices:
    html_content = '<div style="text-align: center; padding: 10px;">今後の練習予定は未登録です。</div>'
else:
    for p in practices:
        display_date = p.get("displayDate", "")
        full_date = p.get("fullDateStr", "")
        day_label = p.get("dayLabel", "")
        location = p.get("location", "")
        station = p.get("station", "")
        lat = p.get("lat", "")
        lon = p.get("lon", "")
        time = p.get("time", "")
        
        day_class = day_classes.get(day_label, "")

        html_content += f'''
                <div class="day-row practice-item" data-lat="{lat}" data-lon="{lon}" data-date="{full_date}" data-time="{time}">
                    <div class="date-badge-container">
                        <span class="practice-date">{display_date}</span>
                        <div class="day-badge {day_class}">{day_label}</div>
                    </div>
                    <div class="loc-time-container">
                        <div class="loc-details">
                            <span class="day-loc">{location}</span>
                            <span class="day-station">{station}</span>
                        </div>
                        <div class="time-weather-container">
                            <span class="day-time">{time}</span>
                            <div class="weather-box" style="display:none;"></div>
                        </div>
                    </div>
                </div>'''

# 3. テンプレートの読み込みと置換
with open('template.html', 'r', encoding='utf-8') as f:
    template = f.read()

# 目印の部分を、生成したHTMLに置き換える
final_html = template.replace('<!-- INJECT_PRACTICE_HERE -->', html_content)

# 4. index.html として書き出し（これがクローラーに読まれる実体となる）
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(final_html)
