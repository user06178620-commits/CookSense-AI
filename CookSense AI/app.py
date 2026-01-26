import os
import json
from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai import types # 必須匯入這個來處理設定
from dotenv import load_dotenv

app = Flask(__name__)
load_dotenv()

# 使用 os.getenv 讀取變數
api_key = os.getenv("API_KEY")

# 初始化 Client：強制使用 v1 穩定版路徑，避免 404 錯誤
# 初始化 Client (強制使用穩定版 v1)
# 1. 改回 v1beta 以便支持最新預覽模型，或移除 api_version 使用預設值
client = genai.Client(
    api_key=api_key,
    http_options={'api_version': 'v1beta'} # 預覽模型需要 beta 路徑
)

def get_ai_recipes(ingredients, kitchenware, age_group, people, cuisine):
    if not ingredients:
        return []

    # 提示詞中再次強調 JSON 格式，這是最保險的
    prompt = f"""
        請生成 3 道適合 {people} 人的食譜。
    現有食材：{ingredients}
    菜系：{cuisine}

    請務必返回嚴格格式的 JSON 陣列，每個物件必須包含：
    {{
        "id": 1,
        "name": "食譜名稱",
        "difficulty": "簡單",
        "time": "20分鐘",
        "portions": {people},
        "standard": {{
            "calories": 500,
            "ingredients": ["食材 A (份量)", "食材 B (份量)"]  <-- 確保這個欄位存在！,
            "steps": ["步驟 1：內容...", "步驟 2：內容..."]
        }},
        "healthy": {{
            "calories": 400,
            "ingredients": ["健康版食材 A (份量)", "健康版食材 B (份量)"],
            "steps": ["健康版步驟 1...", "健康版步驟 2..."]
        }},
        "substitutions": [
            {{"missing": "檸檬", "suggestion": "白醋"}}
        ]
    }}
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

@app.route('/scan-fridge', methods=['POST'])
def scan_fridge():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "未收到圖片"}), 400
            
        image_file = request.files['image']
        image_bytes = image_file.read()
        
        # 檢查檔案是否為空
        if len(image_bytes) == 0:
            return jsonify({"error": "圖片檔案損壞或為空"}), 400

        # 定義提示詞
        prompt = "分析這張照片中的食材，列出你看到的所有食物。請僅回傳 JSON 格式，包含一個 'ingredients' 陣列。"

        # 在 2026 年的 SDK 中，我們確保使用正確的視覺 Part 格式
        response = client.models.generate_content(
            model="gemini-2.0-flash", 
            contents=[
                prompt,
                types.Part.from_bytes(
                    data=image_bytes, 
                    mime_type=image_file.content_type or "image/jpeg"
                )
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        return response.text # 這會回傳 Gemini 生成的 JSON 字串
        
    except Exception as e:
        # 關鍵：這行會在 VSCode 終端機顯示到底哪裡出錯
        print(f"!!! 視覺辨識後端崩潰：{e} !!!")
        return jsonify({"error": str(e)}), 500

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