import os
import json
from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai import types # 必須匯入這個來處理設定

app = Flask(__name__)

# --- 設定 ---
# 請在此處填入您的 API Key
API_KEY = "AIzaSyDvOBnFxImKmwBS3aTVboPRJo7Lt3pde6o"

# 初始化 Client：強制使用 v1 穩定版路徑，避免 404 錯誤
# 初始化 Client (強制使用穩定版 v1)
# 1. 改回 v1beta 以便支持最新預覽模型，或移除 api_version 使用預設值
client = genai.Client(
    api_key=API_KEY,
    http_options={'api_version': 'v1beta'} # 預覽模型需要 beta 路徑
)

def get_ai_recipes(ingredients, kitchenware, age_group, people, cuisine):
    if not ingredients:
        return []

    # 提示詞中再次強調 JSON 格式，這是最保險的
    prompt = f"""
    作為專業主廚，請根據以下條件生成 3 道詳細食譜：
    - 食材：{', '.join(ingredients)}
    - 廚具：{', '.join(kitchenware)}
    - 菜系：{cuisine}
    - 份量：{people} 人份
    - 對象：{age_group}

    請嚴格依照以下 JSON 格式回傳，不要包含任何額外文字：
    [
      {{
        "id": 1,
        "name": "食譜名稱",
        "difficulty": "簡單/中等/困難",
        "time": "預估時間",
        "portions": {people},
        "standard": {{
          "calories": 500,
          "desc": "菜色簡介",
          "ingredients": ["食材 A (份量)", "食材 B (份量)"],
          "steps": ["步驟 1：內容...", "步驟 2：內容..."] 
        }},
        "healthy": {{
          "calories": 400,
          "desc": "健康化調整說明",
          "adjustments": ["調整點 1", "調整點 2"],
          "steps": ["健康版步驟 1...", "健康版步驟 2..."]
        }},
        "substitutions": [
          {{"missing": "原本食材", "suggestion": "可替換食材"}}
        ]
      }}
    ]
    """

    try:
        # 2. 使用目前 2026 年初最建議的穩定模型名稱
        response = client.models.generate_content(
            model="gemini-2.5-flash", # 或者使用 "gemini-3-flash-preview"
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "temperature": 0.7
            }
        )
        return json.loads(response.text)
        
    except Exception as e:
        # 如果還是報錯，最後的絕招：印出所有可用的模型，讓您知道現在哪個模型活著
        print(f"!!! 出錯：{e} !!!")
        print("當前您的 Key 可用的模型列表：")
        for m in client.models.list():
            print(f" - {m.name}")
        return []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate():
    data = request.json
    recipes = get_ai_recipes(
        data.get('ingredients', []),
        data.get('kitchenware', []),
        data.get('ageGroup', 'adult'),
        data.get('people', 1),
        data.get('cuisine', 'western')
    )
    return jsonify(recipes)

if __name__ == '__main__':
    app.run(debug=True)