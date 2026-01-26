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

function triggerCamera() {
    // This is still a simulation because browsers require HTTPS for real camera access
    const btn = document.getElementById('cameraBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
    btn.disabled = true;
    setTimeout(() => {
        const foundItems = ["Carrots", "Chicken Breast", "Soy Sauce"];
        foundItems.forEach(item => addIngredient(item));
        btn.innerHTML = originalText;
        btn.disabled = false;
    }, 1500);
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
        const standardSteps = recipe.standard?.steps || [];
        const healthySteps = recipe.healthy?.steps || [];

        const html = `
            <div class="recipe-card">
                <h2>${recipe.name}</h2>
                <div class="recipe-body">
                    <div class="version-box standard-ver">
                        <div class="version-title">標準版</div>
                        <p><strong>食材清單：</strong> ${recipe.standard.ingredients.join(', ')}</p>
                        <strong>料理步驟：</strong>
                        <ol>
                            ${standardSteps.map(step => `<li>${step}</li>`).join('')}
                        </ol>
                    </div>

                    <div class="version-box healthy-ver">
                        <div class="version-title">健康版</div>
                        <p><strong>健康秘訣：</strong> ${recipe.healthy.desc}</p>
                        <strong>調整步驟：</strong>
                        <ol>
                            ${healthySteps.length > 0 ? healthySteps.map(s => `<li>${s}</li>`).join('') : '<li>同標準版步驟，但減少鹽分與油脂。</li>'}
                        </ol>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}