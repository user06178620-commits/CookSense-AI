import os
import json
from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai import types # 必須匯入這個來處理設定
from dotenv import load_dotenv
from PIL import Image
import io

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

def get_ai_recipes(ingredients, kitchenware, age_group, people, cuisine, max_calories=None):
    if not ingredients:
        return []

    # 處理熱量限制的提示詞
    calorie_instruction = ""
    if max_calories and int(max_calories) > 0:
        calorie_instruction = f"每一份的熱量必須嚴格控制在 {max_calories} 大卡以內。"
    
    prompt = f"""
    請生成 3 道適合 {people} 人的食譜。
    現有食材：{ingredients}
    廚具：{kitchenware}
    菜系：{cuisine}
    對象：{age_group}
    {calorie_instruction}

    重要要求：
    1. 請根據食材的實際熱量進行科學估算，不要隨意填寫數字。
    2. 請務必返回嚴格格式的 JSON 陣列。
    
    JSON 結構範例：
    [
      {{
        "id": 1,
        "name": "食譜名稱",
        "difficulty": "簡單",
        "time": "20分鐘",
        "portions": {people},
        "standard": {{
            "calories": 500,
            "ingredients": ["食材A (克數)", "食材B (克數)"],
            "steps": ["步驟1", "步驟2"]
        }},
        "healthy": {{
            "calories": 350,
            "ingredients": ["替代食材..."],
            "steps": ["..."]
        }},
        "substitutions": [{{"missing": "...", "suggestion": "..."}}]
      }}
    ]
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "temperature": 0.5 # 降低溫度以獲得更精確的數字
            }
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"!!! 生成食譜出錯：{e} !!!")
        return []

@app.route('/scan-fridge', methods=['POST'])
def scan_fridge():
    try:
        # 1. 取得圖片並壓縮
        if 'image' not in request.files:
            return jsonify({"error": "未收到圖片", "ingredients": []}), 400
            
        image_file = request.files['image']
        img = Image.open(image_file)
        
        # 壓縮處理
        img.thumbnail((640, 640))
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG', quality=70)
        image_bytes = img_byte_arr.getvalue()

        # 2. 呼叫 Gemini 視覺模型
        prompt = "分析照片中的食材，僅回傳 JSON 陣列：{'ingredients': ['食材1', '食材2']}"

        response = client.models.generate_content(
            model="gemini-2.0-flash", 
            contents=[
                prompt,
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
            ],
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        # 3. 解析 JSON 回傳值
        try:
            # 先嘗試直接解析
            output = json.loads(response.text)
            return jsonify(output)
        except json.JSONDecodeError:
            # 如果包含 Markdown 語法，清理後再解析
            clean_text = response.text.replace("```json", "").replace("```", "").strip()
            return jsonify(json.loads(clean_text))
            
    except Exception as e:
        # 4. 錯誤處理 (這是唯一的萬能捕捉)
        error_msg = str(e)
        print(f"!!! Python 後端報錯：{error_msg} !!!")
        
        # 針對配額限制 (429) 給予友善提示
        if "429" in error_msg:
            return jsonify({"error": "API 次數達到上限，請等一分鐘後再試一次。", "ingredients": []}), 429
            
        return jsonify({"error": "伺服器內部錯誤", "details": error_msg, "ingredients": []}), 500

@app.route('/analyze-calories', methods=['POST'])
def analyze_calories():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "未收到圖片"}), 400
            
        image_file = request.files['image']
        img = Image.open(image_file)
        
        # 壓縮圖片 (為了配額與速度)
        img.thumbnail((800, 800))
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG', quality=70)
        image_bytes = img_byte_arr.getvalue()

        prompt = """
        你是一位營養師。請分析這張照片中的食物：
        1. 辨識食物名稱。
        2. 估算這整份食物的總熱量 (Total Calories)。
        
        請僅回傳此 JSON 格式：
        {
            "food_name": "食物名稱",
            "estimated_calories": 500,
            "reasoning": "簡短說明估算依據 (例如：一碗白飯約280大卡 + 炸豬排約300大卡)"
        }
        """

        response = client.models.generate_content(
            model="gemini-2.0-flash", # 使用 1.5 以分散配額壓力
            contents=[
                prompt,
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
            ],
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        return jsonify(json.loads(response.text))

    except Exception as e:
        print(f"熱量分析失敗: {e}")
        return jsonify({"error": str(e), "estimated_calories": 0}), 500

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
        data.get('cuisine', 'western'),
        data.get('maxCalories', None) # 接收新參數
    )
    return jsonify(recipes)

if __name__ == '__main__':
    app.run(debug=True)