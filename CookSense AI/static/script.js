let ingredients = [];

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

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ingredients, kitchenware, ageGroup, people, cuisine })
        });
        const recipes = await response.json();
        renderRecipes(recipes);
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

        const html = `
            <div class="recipe-card">
                <div class="recipe-header">
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