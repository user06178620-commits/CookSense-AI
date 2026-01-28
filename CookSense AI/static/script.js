let ingredients = [];
let savedRecipes = JSON.parse(localStorage.getItem('cooksense_saved')) || [];

const DAILY_INTAKE = {
    'younger': 1800, // 發育期/小孩
    'adult': 2200,   // 成人
    'older': 1600    // 高齡者
};

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

// --- 監聽器部分：解決 "Cannot read properties of null (reading 'click')" ---
document.addEventListener('DOMContentLoaded', () => {
    const cameraBtn = document.getElementById('cameraBtn');
    const fileInput = document.getElementById('fileInput');

    if (cameraBtn && fileInput) {
        // 當使用者點擊顯眼的相機按鈕時，觸發隱藏的檔案選擇器
        cameraBtn.addEventListener('click', () => {
            fileInput.click();
        });

        // 當檔案選擇器偵測到檔案改變（使用者選好了照片）
        fileInput.addEventListener('change', function() {
            uploadImage(this); // 呼叫你原本寫好的上傳函式
        });
    } else {
        console.error("錯誤：找不到 ID 為 'cameraBtn' 或 'fileInput' 的元素。請檢查 index.html。");
    }

    const calBtn = document.getElementById('calCameraBtn');
    const calInput = document.getElementById('calFileInput');
    const ageSelect = document.getElementById('ageGroup');
    const targetDisplay = document.getElementById('targetCal');

    function updateTargetCal() {
        const age = ageSelect.value;
        targetDisplay.innerText = DAILY_INTAKE[age];
    }
    ageSelect.addEventListener('change', updateTargetCal);
    updateTargetCal(); // 初始執行一次

    if (calBtn && calInput) {
        calBtn.addEventListener('click', () => calInput.click());
        calInput.addEventListener('change', function() {
            analyzeFoodCalories(this);
            });
    }
    updateSavedCount();
}); 


// --- 你原本的 uploadImage 函式 (保持不變) ---
async function uploadImage(input) {
    if (!input.files || !input.files[0]) return;

    const btn = document.getElementById('cameraBtn');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 辨識中...';
    btn.disabled = true;

    const formData = new FormData();
    formData.append('image', input.files[0]);

    try {
        const response = await fetch('/scan-fridge', {
            method: 'POST',
            body: formData
        });
        
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
    resultArea.classList.add('hidden'); // 先隱藏舊結果

    const formData = new FormData();
    formData.append('image', input.files[0]);

    try {
        const response = await fetch('/analyze-calories', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error("API 請求失敗");
        
        const data = await response.json();
        
        // 渲染結果
        renderCalorieResult(data);

    } catch (error) {
        console.error(error);
        alert("無法估算熱量，請稍後再試。");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        input.value = '';
    }
}

function renderCalorieResult(data) {
    const ageGroup = document.getElementById('ageGroup').value;
    const dailyLimit = DAILY_INTAKE[ageGroup];
    const estimated = data.estimated_calories || 0;
    const remaining = dailyLimit - estimated;

    document.getElementById('foodName').innerText = data.food_name || "未知食物";
    document.getElementById('calReason').innerText = data.reasoning || "";
    document.getElementById('foodCal').innerText = estimated;
    
    const remainingEl = document.getElementById('remainingCal');
    remainingEl.innerText = remaining;
    
    // 如果超標，變紅色
    remainingEl.style.color = remaining < 0 ? '#c0392b' : '#27ae60';

    document.getElementById('calResultArea').classList.remove('hidden');
}

async function generateRecipes() {
    if (ingredients.length === 0) {
        alert("Please add at least one ingredient!");
        return;
    }
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('resultsArea').innerHTML = '';

    const kitchenware = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    const ageGroup = document.getElementById('ageGroup').value;
    const people = document.getElementById('peopleCount').value;
    const cuisine = document.getElementById('cuisine').value;
    const maxCalories = document.getElementById('maxCalories').value;
    const difficulty = document.getElementById('difficulty').value; // 確保有抓到值
    const avoidFoods = document.getElementById('avoidFoods').value; // 新增過敏原

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const bodyData = { 
            ingredients, 
            kitchenware, 
            ageGroup, 
            people, 
            cuisine, 
            difficulty, 
            avoidFoods, // 傳送給後端
            maxCalories 
        };

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });
        const recipes = await response.json();
        renderRecipes(recipes);
        if (loadMoreBtn) {
            loadMoreBtn.style.display = 'block'; // 直接操作 Style 權重最高
            loadMoreBtn.classList.remove('hidden');
        }  
    } catch (error) {
        console.error(error);
        alert("Error generating recipes.");
    } finally {
        document.getElementById('loader').classList.add('hidden');
    }
}

function renderRecipes(recipes) {
    const container = document.getElementById('resultsArea');
    if (!recipes || recipes.length === 0) {
        container.innerHTML = "<p style='text-align:center'>未找到食譜，請嘗試其他食材。</p>";
        return;
    }

    recipes.forEach(recipe => {
        // 在卡片渲染的循環中更新這部分：

        const standardIngs = (recipe.standard && recipe.standard.ingredients) ? recipe.standard.ingredients : [];
        const healthyIngs = (recipe.healthy && recipe.healthy.ingredients) ? recipe.healthy.ingredients : [];
        const substitutions = recipe.substitutions || [];

        const isSaved = savedRecipes.some(r => r.id === recipe.id);
        const saveBtnHtml = `
            <button class="save-recipe-btn ${isSaved ? 'active' : ''}" 
                    onclick='toggleSave("${recipe.id}", ${JSON.stringify(recipe).replace(/'/g, "&apos;")})'>
                <i class="fas fa-heart"></i>
            </button>
        `;

        const html = `
            <div class="recipe-card">
                <div class="recipe-header">
                    ${saveBtnHtml}
                    <h2>${recipe.name || '未命名食譜'}</h2>
                    <div style="color:#666; font-size:0.9em">
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

                        <strong><i class="fas fa-list-ol"></i> 料理步驟:</strong>
                        <ol class="step-list">
                            ${recipe.standard?.steps?.map(step => `<li>${step}</li>`).join('') || '<li>暫無步驟資訊</li>'}
                        </ol>
                        
                    </div>
                    <div class="version-box healthy-ver">
                        <div class="version-title"><i class="fas fa-leaf"></i> 健康版 <span class="calories">${recipe.healthy?.calories || 0} kcal</span></div>
                        <strong><i class="fas fa-shopping-basket"></i> 食材:</strong>
                        <ul>${healthyIngs.map(a => `<li>${a}</li>`).join('')}</ul>
                        <strong><i class="fas fa-list-ol"></i> 料理步驟:</strong>
                        <ol class="step-list">
                            ${recipe.healthy?.steps?.map(step => `<li>${step}</li>`).join('') || '<li>同標準版，建議減少油鹽。</li>'}
                        </ol>
                        
                    </div>
                </div>
                <div class="substitutions">
                    <strong><i class="fas fa-exchange-alt"></i> 食材替換建議:</strong><br>
                    ${substitutions.length > 0 ? substitutions.map(s => `缺少 <u>${s.missing}</u>? 試試 <b>${s.suggestion}</b>`).join(' &nbsp;|&nbsp; ') : '無建議'}
                </div>
            </div>`;
        container.innerHTML += html;
    });
}

function updateSavedCount() {
    const countEl = document.getElementById('savedCount');
    if (countEl) {
        countEl.innerText = savedRecipes.length;
    }
}

function toggleSavedRecipes() {
    const panel = document.getElementById('savedRecipesPanel');
    if (panel) {
        panel.classList.toggle('hidden');
        renderSavedList();
    }
}

// 收藏/取消收藏邏輯
function toggleSave(recipeId, recipeData) {
    const index = savedRecipes.findIndex(r => r.id === recipeId);
    
    if (index === -1) {
        savedRecipes.push(recipeData);
        alert('已加入收藏！');
    } else {
        savedRecipes.splice(index, 1);
        alert('已從收藏中移除。');
    }
    
    localStorage.setItem('cooksense_saved', JSON.stringify(savedRecipes));
    updateSavedCount();
    
    // 更新按鈕樣式
    const btn = document.querySelector(`[onclick*="toggleSave('${recipeId}'"]`);
    if(btn) btn.classList.toggle('active');
}

// 渲染收藏清單
function renderSavedList() {
    const list = document.getElementById('savedList');
    if (!list) return;
    
    list.innerHTML = savedRecipes.length === 0 ? '<p>目前沒有收藏的食譜。</p>' : '';
    
    savedRecipes.forEach(recipe => {
        const item = document.createElement('div');
        item.className = 'saved-item';
        item.style.cssText = 'margin-bottom: 15px; padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 4px solid var(--primary);';
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <strong style="display: block; color: var(--dark);">${recipe.name}</strong>
                    <small style="color: var(--gray);">${recipe.time} | ${recipe.difficulty}</small>
                </div>
                <button onclick="removeSaved('${recipe.id}')" style="color:var(--danger); background:none; padding:0; font-size:1.2rem;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

function removeSaved(id) {
    savedRecipes = savedRecipes.filter(r => r.id !== id);
    localStorage.setItem('cooksense_saved', JSON.stringify(savedRecipes));
    updateSavedCount();
    renderSavedList();
    const btn = document.querySelector(`[onclick*="toggleSave('${id}'"]`);
    if(btn) btn.classList.remove('active');
}