// script.js

// --- 1. 全域變數宣告 ---
let ingredients = [];
let savedRecipes = JSON.parse(localStorage.getItem('cooksense_saved')) || [];
let consumedFoodList = [];
let currentEstimatedCalories = 0;

// 新增這行：用來暫存當前生成的食譜，讓 ID 可以查找到完整資料
let currentRecipesMap = {};

const DAILY_INTAKE = {
    'younger': 1800, // 發育期/小孩
    'adult': 2200,   // 成人
    'older': 1600    // 高齡者
};

// --- 2. 食材標籤功能 ---
function addIngredient(val = null) {
    const input = document.getElementById('ingredientInput');
    const value = val || input.value.trim();
    if (value && !ingredients.includes(value)) {
        ingredients.push(value);
        renderTags();
        input.value = '';
    }
}

function renderTags() {
    const container = document.getElementById('ingredientList');
    container.innerHTML = '';
    ingredients.forEach(ing => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `${ing} <span onclick="removeIngredient('${ing}')">&times;</span>`;
        container.appendChild(tag);
    });
}

function removeIngredient(ing) {
    ingredients = ingredients.filter(item => item !== ing);
    renderTags();
}

// --- 3. 頁面初始化與監聽器 ---
document.addEventListener('DOMContentLoaded', () => {
    // 冰箱食材相機
    const cameraBtn = document.getElementById('cameraBtn');
    const fileInput = document.getElementById('fileInput');

    if (cameraBtn && fileInput) {
        cameraBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', function() { uploadImage(this); });
    } else {
        console.error("錯誤：找不到 ID 為 'cameraBtn' 或 'fileInput' 的元素。");
    }

    // 熱量相機與年齡選擇
    const calBtn = document.getElementById('calCameraBtn');
    const calInput = document.getElementById('calFileInput');
    const ageSelect = document.getElementById('ageGroup');
    
    // 綁定年齡變更事件：現在變更年齡會同時更新目標與剩餘熱量
    if (ageSelect) {
        ageSelect.addEventListener('change', updateCalorieStats);
        updateCalorieStats(); // 初始化顯示
    }

    if (calBtn && calInput) {
        calBtn.addEventListener('click', () => calInput.click());
        calInput.addEventListener('change', function() { analyzeFoodCalories(this); });
    }
    
    // 初始化收藏數量
    updateSavedCount();
}); 

// --- 4. 核心功能函式 ---

// 統一管理熱量計算 (解決問題 3：動態更新)
function updateCalorieStats() {
    const ageSelect = document.getElementById('ageGroup');
    const targetDisplay = document.getElementById('targetCal');
    const remainingEl = document.getElementById('remainingCal');
    const totalConsumedEl = document.getElementById('totalConsumed');
    
    if (!ageSelect) return;

    const age = ageSelect.value;
    const dailyLimit = DAILY_INTAKE[age];
    
    // 計算目前累積的總熱量
    const currentTotal = consumedFoodList.reduce((sum, item) => sum + item.calories, 0);

    // 更新每日建議顯示
    if (targetDisplay) targetDisplay.innerText = dailyLimit;
    
    // 更新已攝取總量顯示
    if (totalConsumedEl) totalConsumedEl.innerText = currentTotal;

    // 重新計算剩餘熱量
    const remaining = dailyLimit - currentTotal;
    
    if (remainingEl) {
        remainingEl.innerText = remaining;
        remainingEl.style.color = remaining < 0 ? '#c0392b' : '#27ae60';
        // 如果剩餘熱量是負的，加上驚嘆號提示
        if (remaining < 0) remainingEl.innerText += " (已超標!)";
    }
}

async function uploadImage(input) {
    if (!input.files || !input.files[0]) return;
    const btn = document.getElementById('cameraBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 辨識中...';
    btn.disabled = true;

    const formData = new FormData();
    formData.append('image', input.files[0]);

    try {
        const response = await fetch('/scan-fridge', { method: 'POST', body: formData });
        if (!response.ok) throw new Error("辨識失敗");
        const data = await response.json();
        
        if (data.ingredients && data.ingredients.length > 0) {
            data.ingredients.forEach(item => addIngredient(item));
        } else {
            alert("未能辨識到食材，請再試一次或手動輸入。");
        }
    } catch (error) {
        console.error("辨識錯誤:", error);
        alert("掃描失敗，請檢查網路連接。");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        input.value = ''; 
    }
}

async function analyzeFoodCalories(input) {
    if (!input.files || !input.files[0]) return;
    const btn = document.getElementById('calCameraBtn');
    const originalText = btn.innerHTML;
    const resultArea = document.getElementById('calResultArea');
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';
    btn.disabled = true;
    
    // 注意：這裡不再先隱藏 resultArea，因為使用者可能想看著舊紀錄等新結果
    resultArea.classList.remove('hidden'); 

    const formData = new FormData();
    formData.append('image', input.files[0]);

    try {
        const response = await fetch('/analyze-calories', { method: 'POST', body: formData });
        if (!response.ok) throw new Error("API 請求失敗");
        
        const data = await response.json();
        
        const newCalories = data.estimated_calories || 0;
        
        // 1. 將新資料推入陣列
        consumedFoodList.push({
            name: data.food_name || "未知食物",
            calories: newCalories,
            reason: data.reasoning || ""
        });

        // 2. 生成新項目的 HTML (類似收據的項目)
        const newItemHtml = `
            <div class="food-item-entry" style="border-bottom: 1px dashed #ccc; padding: 10px 0; animation: fadeIn 0.5s;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; color: #333;">
                    <span>${data.food_name || "未知食物"}</span>
                    <span>${newCalories} kcal</span>
                </div>
                <div style="font-size: 0.85em; color: #666; margin-top: 4px;">
                    ${data.reasoning || "AI 估算結果"}
                </div>
            </div>
        `;

        // 3. 插入到列表中 (beforeend = 加在最後面)
        const listContainer = document.getElementById('foodHistoryList');
        if(listContainer) {
            listContainer.insertAdjacentHTML('beforeend', newItemHtml);
        }

        // 4. 更新統計數據
        updateCalorieStats();

    } catch (error) {
        console.error(error);
        alert("無法估算熱量，請稍後再試。");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        input.value = '';
    }
}

async function generateRecipes(isLoadMore = false) {
    if (ingredients.length === 0) {
        alert("請先輸入冰箱裡的食材！");
        return;
    }
    
    const loader = document.getElementById('loader');
    const btn = document.getElementById('generateBtn');
    const resultsArea = document.getElementById('resultsArea');
    
    loader.classList.remove('hidden');
    loader.classList.add('show-flex');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在思考中...';
    
    if (!isLoadMore) {
        resultsArea.innerHTML = '';
        currentRecipesMap = {}; // 清空暫存
        if(loadMoreBtn) loadMoreBtn.classList.add('hidden');
    }

    const bodyData = { 
        ingredients, 
        kitchenware: Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value), 
        ageGroup: document.getElementById('ageGroup').value, 
        people: document.getElementById('peopleCount').value, 
        cuisine: document.getElementById('cuisine').value, 
        difficulty: document.getElementById('difficulty').value, 
        avoidFoods: document.getElementById('avoidFoods').value,
        maxCalories: document.getElementById('maxCalories').value 
    };

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });
        const recipes = await response.json();
        renderRecipes(recipes);
        
        const uniqueData = recipes.map(recipe => ({
            ...recipe,
            // 使用 "時間戳 + 亂數" 確保 ID 絕對唯一 (例如: recipe_17273849_xk3la)
            id: `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }));

        renderRecipes(uniqueData);

        
        if (loadMoreBtn) {
            loadMoreBtn.style.display = 'block'; 
            loadMoreBtn.classList.remove('hidden');
        }  
    } catch (error) {
        console.error(error);
        alert("Error generating recipes.");
    } finally {
        loader.classList.add('hidden');
        loader.classList.remove('show-flex');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-magic"></i> 用 AI 生成食譜';
    }
}

function renderRecipes(recipes) {
    const container = document.getElementById('resultsArea');
    if (!recipes || recipes.length === 0) {
        // 如果是清空狀態，顯示提示
        if (container.innerHTML === '') {
            container.innerHTML = "<p style='text-align:center'>未找到食譜，請嘗試其他食材。</p>";
        }
        return;
    }

    // 清空舊結果
    container.innerHTML = ''; 

    recipes.forEach((recipe, index) => {
        // --- 修正重點：使用 encodeURIComponent 進行安全編碼 ---
        // 這會將 JSON 轉為像 "%7B%22name%22..." 這樣的安全字串，絕對不會跟 HTML 引號衝突
        const safeRecipeString = encodeURIComponent(JSON.stringify(recipe));
        
        // 檢查是否已收藏 (確保 ID 轉為字串比對)
        const isSaved = savedRecipes.some(r => String(r.id) === String(recipe.id));

        const standardIngs = recipe.standard?.ingredients || [];
        const healthyIngs = recipe.healthy?.ingredients || [];
        const substitutions = recipe.substitutions || [];

        // 建立 HTML
        const html = `
            <div class="recipe-card" style="animation-delay: ${index * 0.15}s">
                <div class="recipe-header" style="position: relative;">
                     <button class="save-recipe-btn ${isSaved ? 'active' : ''}" 
                            data-id="${recipe.id}"
                            onclick="toggleSave('${recipe.id}', '${safeRecipeString}')">
                        <i class="${isSaved ? 'fas' : 'far'} fa-heart"></i>
                    </button>
                    <h2>${recipe.name || '未命名食譜'}</h2>
                    <div class="recipe-meta" style="color:#666; font-size:0.9em">
                        <i class="fas fa-clock"></i> ${recipe.time || '--'} &nbsp;|&nbsp; 
                        <i class="fas fa-chart-line"></i> ${recipe.difficulty || '--'} &nbsp;|&nbsp; 
                        <i class="fas fa-user-friends"></i> 份量: ${recipe.portions || '--'}
                    </div>
                </div>
                <div class="recipe-body">
                    <div class="version-box standard-ver">
                        <div class="version-title">標準版 <span class="calories">${recipe.standard?.calories || 0} kcal</span></div>
                        <strong><i class="fas fa-shopping-basket"></i> 食材:</strong>
                        <ul>${standardIngs.map(a => `<li>${a}</li>`).join('')}</ul>
                        <strong><i class="fas fa-list-ol"></i> 步驟:</strong>
                        <ol class="step-list">${recipe.standard?.steps?.map(s => `<li>${s}</li>`).join('') || ''}</ol>
                    </div>
                    <div class="version-box healthy-ver">
                        <div class="version-title"><i class="fas fa-leaf"></i> 健康版 <span class="calories">${recipe.healthy?.calories || 0} kcal</span></div>
                        <strong><i class="fas fa-shopping-basket"></i> 食材:</strong>
                        <ul>${healthyIngs.map(a => `<li>${a}</li>`).join('')}</ul>
                        <strong><i class="fas fa-list-ol"></i> 步驟:</strong>
                        <ol class="step-list">${recipe.healthy?.steps?.map(s => `<li>${s}</li>`).join('') || ''}</ol>
                    </div>
                </div>
                <div class="substitutions">
                    <strong><i class="fas fa-exchange-alt"></i> 替換建議:</strong><br>
                    ${substitutions.length > 0 ? substitutions.map(s => `缺 <u>${s.missing}</u>? 試試 <b>${s.suggestion}</b>`).join(' | ') : '無建議'}
                </div>
            </div>`;
        
        container.insertAdjacentHTML('beforeend', html);
    });
}

// --- 5. 收藏功能邏輯 ---

function updateSavedCount() {
    const countEl = document.getElementById('savedCount');
    if (countEl) countEl.innerText = savedRecipes.length;
}

function toggleSavedRecipes() {
    const panel = document.getElementById('savedRecipesPanel');
    if (panel) {
        panel.classList.toggle('hidden');
        renderSavedList();
    }
}

function toggleSave(recipeId, recipeData) {
    let dataToSave = recipeData;

    // --- 修正重點：解碼資料 ---
    if (typeof recipeData === 'string') {
        try {
            // 使用 decodeURIComponent 還原 JSON 字串，再轉為物件
            dataToSave = JSON.parse(decodeURIComponent(recipeData));
        } catch (e) {
            console.error("食譜資料解析失敗:", e);
            return;
        }
    }

    // 尋找是否已存在 (轉為字串比較以防萬一)
    const index = savedRecipes.findIndex(r => String(r.id) === String(recipeId));
    
    // 尋找畫面上所有對應的按鈕 (包含主列表和收藏列表中的刪除鈕)
    const btns = document.querySelectorAll(`.save-recipe-btn[data-id="${recipeId}"]`);
    
    if (index === -1) {
        // 加入收藏
        savedRecipes.push(dataToSave);
        btns.forEach(btn => {
            btn.classList.add('active');
            const icon = btn.querySelector('i');
            if(icon) {
                icon.classList.remove('far');
                icon.classList.add('fas');
            }
        });
    } else {
        // 移除收藏
        savedRecipes.splice(index, 1);
        btns.forEach(btn => {
            btn.classList.remove('active');
            const icon = btn.querySelector('i');
            if(icon) {
                icon.classList.remove('fas');
                icon.classList.add('far');
            }
        });
    }
    
    // 存入 LocalStorage 並更新計數
    localStorage.setItem('cooksense_saved', JSON.stringify(savedRecipes));
    updateSavedCount();
    
    // 如果收藏面板正開著，即時刷新列表內容
    const panel = document.getElementById('savedRecipesPanel');
    if (panel && !panel.classList.contains('hidden')) {
        renderSavedList();
    }
}

// 解決問題 2：渲染收藏清單時顯示詳細資訊
function renderSavedList() {
    const list = document.getElementById('savedList');
    if (!list) return;
    
    list.innerHTML = savedRecipes.length === 0 ? '<p>目前沒有收藏的食譜。</p>' : '';
    
    savedRecipes.forEach(recipe => {
        const item = document.createElement('div');
        item.className = 'saved-item';
        
        // 準備詳細資料的 HTML
        const standardSteps = recipe.standard?.steps?.map(s => `<li>${s}</li>`).join('') || '';
        const standardIngs = recipe.standard?.ingredients?.join(', ') || '';

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="width: 100%;">
                    <strong>${recipe.name}</strong>
                    <div style="font-size:0.85em; color:#666; margin-bottom:5px;">
                        <i class="fas fa-clock"></i> ${recipe.time} | 
                        <i class="fas fa-fire"></i> ${recipe.standard?.calories || 0} kcal
                    </div>
                    
                    <details style="font-size: 0.9em; margin-top: 5px; color: #444; cursor: pointer;">
                        <summary style="color: var(--primary);">查看食材與步驟</summary>
                        <div style="margin-top: 8px; padding-left: 10px; border-left: 2px solid #eee;">
                            <p><strong>食材:</strong> ${standardIngs}</p>
                            <p><strong>步驟:</strong></p>
                            <ol style="padding-left: 15px; margin: 5px 0;">${standardSteps}</ol>
                        </div>
                    </details>
                </div>
                <button onclick="removeSaved('${recipe.id}')" style="color:var(--danger); background:none; cursor:pointer; padding:0 0 0 10px;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

function removeSaved(id) {
    savedRecipes = savedRecipes.filter(r => String(r.id) !== String(id));
    localStorage.setItem('cooksense_saved', JSON.stringify(savedRecipes));
    updateSavedCount();
    renderSavedList();
    
    const btns = document.querySelectorAll(`.save-recipe-btn[data-id="${id}"]`);
    btns.forEach(btn => {
        btn.classList.remove('active');
        btn.querySelector('i').className = 'far fa-heart';
    });
}