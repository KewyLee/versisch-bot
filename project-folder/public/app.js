// app.js - Клиентский JavaScript для Telegram Mini App

// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand(); // Разворачиваем приложение на весь экран

// Получаем DOM-элементы
const form = document.getElementById('applicationForm');
const pdfSection = document.getElementById('pdfSection');
const fullNameInput = document.getElementById('fullName');
const birthSurnameInput = document.getElementById('birthSurname');
const hometownInput = document.getElementById('hometown');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const photoInput = document.getElementById('photo');
const photoPreview = document.getElementById('photoPreview');
const signatureCanvas = document.getElementById('signatureCanvas');
const clearSignatureBtn = document.getElementById('clearSignature');
const submitSignatureBtn = document.getElementById('submitSignature');
const birthDateInput = document.getElementById('birthDate');
const insuranceAddressInput = document.getElementById('insuranceAddress');

// Функция для проверки латинских символов
function isLatin(text) {
    return /^[A-Za-z\s]+$/.test(text);
}

// Функция для валидации email
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Функция для валидации телефона
function isValidPhone(phone) {
    return /^\+?[0-9\s\-\(\)]{10,20}$/.test(phone);
}

// Функция для валидации даты в формате ДД.ММ.ГГГГ
function isValidDate(dateStr) {
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
        return false;
    }
    
    const parts = dateStr.split('.');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    
    return date.getDate() === day && 
           date.getMonth() === month && 
           date.getFullYear() === year;
}

// Форматирование даты рождения
birthDateInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, ''); // Удаляем все нецифровые символы
    
    if (value.length > 0) {
        // Форматируем как ДД.ММ.ГГГГ
        if (value.length <= 2) {
            // Только день
            birthDateInput.value = value;
        } else if (value.length <= 4) {
            // День и месяц
            birthDateInput.value = value.substring(0, 2) + '.' + value.substring(2);
        } else {
            // Полная дата
            birthDateInput.value = value.substring(0, 2) + '.' + value.substring(2, 4) + '.' + value.substring(4, 8);
        }
    }
    
    // Проверяем валидность даты
    if (value.length === 8) {
        if (!isValidDate(birthDateInput.value)) {
            document.getElementById('birthDateError').textContent = 'Пожалуйста, введите корректную дату';
        } else {
            document.getElementById('birthDateError').textContent = '';
        }
    }
});

// Проверка полей при переходе к следующему полю
fullNameInput.addEventListener('blur', function() {
    if (!isLatin(fullNameInput.value)) {
        document.getElementById('fullNameError').textContent = 'Пожалуйста, используйте только латинские буквы';
    } else {
        document.getElementById('fullNameError').textContent = '';
    }
});

birthSurnameInput.addEventListener('blur', function() {
    if (!isLatin(birthSurnameInput.value)) {
        document.getElementById('birthSurnameError').textContent = 'Пожалуйста, используйте только латинские буквы';
    } else {
        document.getElementById('birthSurnameError').textContent = '';
    }
});

hometownInput.addEventListener('blur', function() {
    if (!isLatin(hometownInput.value)) {
        document.getElementById('hometownError').textContent = 'Пожалуйста, используйте только латинские буквы';
    } else {
        document.getElementById('hometownError').textContent = '';
    }
});

emailInput.addEventListener('blur', function() {
    if (!isValidEmail(emailInput.value)) {
        document.getElementById('emailError').textContent = 'Пожалуйста, введите корректный email';
    } else {
        document.getElementById('emailError').textContent = '';
    }
});

phoneInput.addEventListener('blur', function() {
    if (!isValidPhone(phoneInput.value)) {
        document.getElementById('phoneError').textContent = 'Пожалуйста, введите корректный номер телефона';
    } else {
        document.getElementById('phoneError').textContent = '';
    }
});

// Автоматическая отправка формы при заполнении адреса
insuranceAddressInput.addEventListener('blur', function() {
    if (insuranceAddressInput.value.trim() !== '') {
        // Проверяем валидность формы перед отправкой
        if (validateForm()) {
            submitFormWithoutSignature();
        }
    }
});

// Инициализация холста для подписи
let context = signatureCanvas.getContext('2d');
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Настройка холста для подписи
function setupSignatureCanvas() {
    // Задаем стиль линии
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.strokeStyle = 'black';
    
    // Обработчики событий для рисования
    signatureCanvas.addEventListener('mousedown', startDrawing);
    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', stopDrawing);
    signatureCanvas.addEventListener('mouseout', stopDrawing);
    
    // Обработчики для сенсорных устройств
    signatureCanvas.addEventListener('touchstart', startDrawingTouch);
    signatureCanvas.addEventListener('touchmove', drawTouch);
    signatureCanvas.addEventListener('touchend', stopDrawing);
    
    // Кнопка очистки подписи
    clearSignatureBtn.addEventListener('click', clearSignature);
}

// Функции для рисования подписи
function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
}

function startDrawingTouch(e) {
    e.preventDefault();
    isDrawing = true;
    const rect = signatureCanvas.getBoundingClientRect();
    const touch = e.touches[0];
    [lastX, lastY] = [touch.clientX - rect.left, touch.clientY - rect.top];
}

function draw(e) {
    if (!isDrawing) return;
    context.beginPath();
    context.moveTo(lastX, lastY);
    context.lineTo(e.offsetX, e.offsetY);
    context.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
}

function drawTouch(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const rect = signatureCanvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    context.beginPath();
    context.moveTo(lastX, lastY);
    context.lineTo(x, y);
    context.stroke();
    [lastX, lastY] = [x, y];
}

function stopDrawing() {
    isDrawing = false;
}

function clearSignature() {
    context.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
}

// Функция для получения данных подписи
function getSignatureData() {
    return signatureCanvas.toDataURL('image/png');
}

// Обработка отправки формы
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Проверяем валидность формы
    if (!validateForm()) {
        return;
    }
    
    // Если указан адрес, отправляем форму без подписи
    if (insuranceAddressInput.value.trim() !== '') {
        submitFormWithoutSignature();
        return;
    }
    
    // Скрываем форму и показываем PDF-секцию
    form.classList.add('hidden');
    pdfSection.classList.remove('hidden');
    
    // Настраиваем холст для подписи
    setupSignatureCanvas();
});

// Функция для отправки формы без подписи
async function submitFormWithoutSignature() {
    // Показываем индикатор загрузки
    tg.MainButton.setText('Отправка...');
    tg.MainButton.show();
    tg.MainButton.disable();
    
    // Собираем данные формы
    const formData = new FormData(form);
    
    // Преобразуем данные формы в JSON для отправки
    const formDataObj = {};
    for (const [key, value] of formData.entries()) {
        if (key !== 'photo') {
            formDataObj[key] = value;
        }
    }
    
    // Добавляем фото, если оно есть
    if (photoInput.files.length > 0) {
        formData.append('photo', photoInput.files[0]);
    }
    
    // Добавляем данные формы как JSON
    formData.append('formData', JSON.stringify(formDataObj));
    
    // Отправляем данные на сервер
    try {
        const response = await fetch('/api/submit-form', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Закрываем Mini App с успешным результатом
            tg.MainButton.setText('Готово!');
            tg.MainButton.enable();
            tg.MainButton.onClick(() => {
                tg.close();
            });
        } else {
            alert('Произошла ошибка при отправке данных: ' + result.message);
            tg.MainButton.hide();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Произошла ошибка при отправке данных');
        tg.MainButton.hide();
    }
}

// Обработка подтверждения подписи
submitSignatureBtn.addEventListener('click', async () => {
    // Проверяем, что подпись не пустая
    const signatureData = getSignatureData();
    const emptySignature = signatureCanvas.toDataURL('image/png');
    
    if (signatureData === emptySignature || !hasSignature()) {
        alert('Пожалуйста, поставьте подпись перед отправкой');
        return;
    }
    
    // Показываем индикатор загрузки
    tg.MainButton.setText('Отправка...');
    tg.MainButton.show();
    tg.MainButton.disable();
    
    // Собираем данные формы
    const formData = new FormData(form);
    
    // Преобразуем данные формы в JSON для отправки
    const formDataObj = {};
    for (const [key, value] of formData.entries()) {
        if (key !== 'photo') {
            formDataObj[key] = value;
        }
    }
    
    // Добавляем фото, если оно есть
    if (photoInput.files.length > 0) {
        formData.append('photo', photoInput.files[0]);
    }
    
    // Добавляем данные формы как JSON
    formData.append('formData', JSON.stringify(formDataObj));
    
    // Добавляем данные о подписи
    formData.append('signature', signatureData);
    
    // Отправляем данные на сервер
    try {
        const response = await fetch('/api/submit-form', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Закрываем Mini App с успешным результатом
            tg.MainButton.setText('Готово!');
            tg.MainButton.enable();
            tg.MainButton.onClick(() => {
                tg.close();
            });
        } else {
            alert('Произошла ошибка при отправке данных: ' + result.message);
            tg.MainButton.hide();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Произошла ошибка при отправке данных');
        tg.MainButton.hide();
    }
});

// Проверка наличия подписи
function hasSignature() {
    const canvas = signatureCanvas;
    const context = canvas.getContext('2d');
    const pixelData = context.getImageData(0, 0, canvas.width, canvas.height).data;
    
    // Проверяем, есть ли непрозрачные пиксели (подпись)
    for (let i = 3; i < pixelData.length; i += 4) {
        if (pixelData[i] > 0) {
            return true;
        }
    }
    
    return false;
}

// Валидация формы
function validateForm() {
    let isValid = true;
    
    // Проверка имени и фамилии на латиницу
    if (!isLatin(fullNameInput.value)) {
        document.getElementById('fullNameError').textContent = 'Пожалуйста, используйте только латинские буквы';
        isValid = false;
    } else {
        document.getElementById('fullNameError').textContent = '';
    }
    
    // Проверка фамилии при рождении на латиницу
    if (!isLatin(birthSurnameInput.value)) {
        document.getElementById('birthSurnameError').textContent = 'Пожалуйста, используйте только латинские буквы';
        isValid = false;
    } else {
        document.getElementById('birthSurnameError').textContent = '';
    }
    
    // Проверка родного города на латиницу
    if (!isLatin(hometownInput.value)) {
        document.getElementById('hometownError').textContent = 'Пожалуйста, используйте только латинские буквы';
        isValid = false;
    } else {
        document.getElementById('hometownError').textContent = '';
    }
    
    // Проверка даты рождения
    if (!isValidDate(birthDateInput.value)) {
        document.getElementById('birthDateError').textContent = 'Пожалуйста, введите корректную дату в формате ДД.ММ.ГГГГ';
        isValid = false;
    } else {
        document.getElementById('birthDateError').textContent = '';
    }
    
    // Проверка email
    if (!isValidEmail(emailInput.value)) {
        document.getElementById('emailError').textContent = 'Пожалуйста, введите корректный email';
        isValid = false;
    } else {
        document.getElementById('emailError').textContent = '';
    }
    
    // Проверка телефона
    if (!isValidPhone(phoneInput.value)) {
        document.getElementById('phoneError').textContent = 'Пожалуйста, введите корректный номер телефона';
        isValid = false;
    } else {
        document.getElementById('phoneError').textContent = '';
    }
    
    return isValid;
}

// Предпросмотр фотографии
photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'photo-preview';
            photoPreview.innerHTML = '';
            photoPreview.appendChild(img);
        }
        reader.readAsDataURL(file);
    }
});