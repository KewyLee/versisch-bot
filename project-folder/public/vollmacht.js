// Глобальные переменные для хранения основных элементов
let tg;
let formData = {};
let signatureData = null;
let isDrawingSignature = false;
let lastPos = { x: 0, y: 0 };

// Дожидаемся полной загрузки документа
document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем Telegram WebApp
    tg = window.Telegram.WebApp;
    tg.expand();
    
    // Получаем данные из URL параметров
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    const username = urlParams.get('username');
    const name = urlParams.get('name');
    
    console.log('URL параметры:', { userId, username, name });
    
    // Заполняем форму данными из URL, если они есть
    if (name) {
        document.getElementById('fullName').value = name;
    }
    
    // Инициализируем форму
    initForm();
    initSignature();
    initDateField();
    
    // Подключаем обработчики событий
    document.getElementById('vollmachtForm').addEventListener('submit', handleFormSubmit);
    document.querySelectorAll('.signature-method').forEach(method => {
        method.addEventListener('click', toggleSignatureMethod);
    });
    document.getElementById('clearSignature').addEventListener('click', clearSignature);
    document.getElementById('signatureUpload').addEventListener('change', handleSignatureUpload);
    
    // Загружаем сохраненные данные из localStorage, если они есть
    loadSavedData();
    
    // При закрытии WebApp сохраняем данные формы
    tg.onEvent('viewportChanged', saveFormData);
});

// Инициализация формы
function initForm() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            validateInput(this);
            saveFormData();
        });
        
        input.addEventListener('blur', function() {
            validateInput(this, true);
        });
    });
    
    // Показываем форму и скрываем индикатор загрузки
    document.getElementById('loadingIndicator').classList.add('hidden');
}

// Инициализация канваса для подписи
function initSignature() {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    
    // Устанавливаем параметры рисования
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    
    // Обработчики событий для рисования
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Поддержка сенсорных устройств
    canvas.addEventListener('touchstart', handleTouch(startDrawing));
    canvas.addEventListener('touchmove', handleTouch(draw));
    canvas.addEventListener('touchend', handleTouch(stopDrawing));
    
    // Функция для начала рисования
    function startDrawing(e) {
        isDrawingSignature = true;
        const pos = getPosition(e);
        lastPos = pos;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }
    
    // Функция для рисования линии
    function draw(e) {
        if (!isDrawingSignature) return;
        
        const pos = getPosition(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos = pos;
        
        // Сохраняем подпись как base64 изображение при каждом изменении
        saveSignature();
    }
    
    // Функция для остановки рисования
    function stopDrawing() {
        isDrawingSignature = false;
        saveSignature();
    }
    
    // Получение координат для рисования
    function getPosition(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX || e.pageX) - rect.left,
            y: (e.clientY || e.pageY) - rect.top
        };
    }
    
    // Обработка сенсорных событий
    function handleTouch(callback) {
        return function(e) {
            e.preventDefault();
            if (e.touches && e.touches.length > 0) {
                const touch = e.touches[0];
                touch.clientX = touch.clientX;
                touch.clientY = touch.clientY;
                callback(touch);
            }
        };
    }
}

// Инициализация поля даты с текущей датой
function initDateField() {
    const today = new Date();
    const formattedDate = formatDate(today);
    document.getElementById('datum').value = formattedDate;
}

// Форматирование даты в формат DD.MM.YYYY
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// Переключение метода подписи (рисование/загрузка)
function toggleSignatureMethod(e) {
    const method = e.target.getAttribute('data-method');
    const drawArea = document.getElementById('signatureDrawArea');
    const uploadArea = document.getElementById('signatureUploadArea');
    
    document.querySelectorAll('.signature-method').forEach(el => {
        el.classList.remove('active');
    });
    e.target.classList.add('active');
    
    if (method === 'draw') {
        drawArea.classList.remove('hidden');
        uploadArea.classList.add('hidden');
    } else {
        drawArea.classList.add('hidden');
        uploadArea.classList.remove('hidden');
    }
}

// Очистка подписи
function clearSignature() {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    signatureData = null;
    document.getElementById('signatureError').textContent = '';
}

// Обработка загрузки изображения подписи
function handleSignatureUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const preview = document.getElementById('signaturePreview');
            preview.innerHTML = '';
            preview.appendChild(img);
            
            // Сохраняем данные подписи
            signatureData = event.target.result;
            document.getElementById('signatureError').textContent = '';
        };
        img.src = event.target.result;
        img.className = 'preview-image';
    };
    reader.readAsDataURL(file);
}

// Сохранение подписи из канваса
function saveSignature() {
    const canvas = document.getElementById('signatureCanvas');
    signatureData = canvas.toDataURL('image/png');
}

// Валидация полей формы
function validateInput(input, showError = false) {
    let isValid = true;
    const errorElement = document.getElementById(`${input.id}Error`);
    
    if (input.hasAttribute('required') && input.value.trim() === '') {
        if (showError) {
            errorElement.textContent = 'Обязательное поле';
        }
        isValid = false;
    } else {
        errorElement.textContent = '';
        
        // Валидация email
        if (input.type === 'email' && input.value.trim() !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input.value)) {
                if (showError) {
                    errorElement.textContent = 'Некорректный email';
                }
                isValid = false;
            }
        }
        
        // Валидация даты
        if (input.id === 'birthDate' || input.id === 'datum') {
            const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
            if (input.value.trim() !== '' && !dateRegex.test(input.value)) {
                if (showError) {
                    errorElement.textContent = 'Формат даты: ДД.ММ.ГГГГ';
                }
                isValid = false;
            }
        }
    }
    
    return isValid;
}

// Валидация всей формы
function validateForm() {
    let isValid = true;
    const requiredInputs = document.querySelectorAll('input[required]');
    
    requiredInputs.forEach(input => {
        if (!validateInput(input, true)) {
            isValid = false;
        }
    });
    
    // Проверка подписи
    if (!signatureData) {
        document.getElementById('signatureError').textContent = 'Подпись обязательна';
        isValid = false;
    }
    
    return isValid;
}

// Сохранение данных формы в localStorage
function saveFormData() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');
    formData = {};
    
    inputs.forEach(input => {
        formData[input.id] = input.value;
    });
    
    // Добавляем флаг типа формы
    formData.isVollmachtForm = true;
    
    // Сохраняем данные в localStorage
    try {
        localStorage.setItem('vollmachtFormData', JSON.stringify(formData));
        console.log('Данные формы сохранены в localStorage');
    } catch (e) {
        console.error('Ошибка при сохранении данных в localStorage:', e);
    }
}

// Загрузка данных формы из localStorage
function loadSavedData() {
    try {
        const savedData = localStorage.getItem('vollmachtFormData');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            
            // Заполняем поля формы сохраненными данными
            for (const key in parsedData) {
                const input = document.getElementById(key);
                if (input) {
                    input.value = parsedData[key];
                }
            }
            
            console.log('Форма заполнена сохраненными данными');
        }
    } catch (e) {
        console.error('Ошибка при загрузке данных из localStorage:', e);
    }
}

// Обработка отправки формы
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Валидируем форму перед отправкой
    if (!validateForm()) {
        return;
    }
    
    // Показываем индикатор загрузки
    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('submitForm').disabled = true;
    
    // Собираем данные формы
    const formEl = document.getElementById('vollmachtForm');
    const formData = new FormData(formEl);
    
    // Добавляем флаг типа формы
    formData.append('isVollmachtForm', 'true');
    
    // Получаем URL параметры (telegramChatId и telegramUsername)
    const urlParams = new URLSearchParams(window.location.search);
    formData.append('telegramChatId', urlParams.get('userId') || '');
    formData.append('telegramUsername', urlParams.get('username') || '');
    
    // Конвертируем FormData в JSON для отправки
    const formDataObj = Object.fromEntries(formData.entries());
    
    // Добавляем подпись
    formData.append('signature', signatureData);
    
    try {
        // Создаем объект для отправки на сервер
        const submitData = new FormData();
        submitData.append('formData', JSON.stringify(formDataObj));
        submitData.append('signature', signatureData);
        
        // Отправляем данные на сервер
        const response = await fetch('/api/submit-form', {
            method: 'POST',
            body: submitData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Очищаем localStorage после успешной отправки
            localStorage.removeItem('vollmachtFormData');
            
            // Скрываем форму и показываем сообщение об успехе
            document.getElementById('vollmachtForm').classList.add('hidden');
            document.getElementById('successMessage').classList.remove('hidden');
            
            // Закрываем приложение через 2 секунды
            setTimeout(() => {
                tg.close();
            }, 2000);
        } else {
            alert('Ошибка при отправке формы: ' + (result.message || 'Неизвестная ошибка'));
            document.getElementById('loadingIndicator').classList.add('hidden');
            document.getElementById('submitForm').disabled = false;
        }
    } catch (error) {
        console.error('Ошибка при отправке формы:', error);
        alert('Произошла ошибка при отправке формы. Пожалуйста, попробуйте позже.');
        document.getElementById('loadingIndicator').classList.add('hidden');
        document.getElementById('submitForm').disabled = false;
    }
} 