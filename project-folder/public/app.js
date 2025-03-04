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
const pdfViewer = document.getElementById('pdfViewer');

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
let context = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Настройка холста для подписи
function setupSignatureCanvas() {
    // Получаем контекст
    context = signatureCanvas.getContext('2d');
    
    // Очищаем холст
    context.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    
    // Задаем стиль линии
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.strokeStyle = 'black';
    
    // Удаляем предыдущие обработчики, если они были
    signatureCanvas.removeEventListener('mousedown', startDrawing);
    signatureCanvas.removeEventListener('mousemove', draw);
    signatureCanvas.removeEventListener('mouseup', stopDrawing);
    signatureCanvas.removeEventListener('mouseout', stopDrawing);
    signatureCanvas.removeEventListener('touchstart', startDrawingTouch);
    signatureCanvas.removeEventListener('touchmove', drawTouch);
    signatureCanvas.removeEventListener('touchend', stopDrawing);
    
    // Добавляем обработчики событий для рисования
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
    e.preventDefault();
    isDrawing = true;
    const rect = signatureCanvas.getBoundingClientRect();
    const scaleX = signatureCanvas.width / rect.width;
    const scaleY = signatureCanvas.height / rect.height;
    lastX = (e.clientX - rect.left) * scaleX;
    lastY = (e.clientY - rect.top) * scaleY;
}

function startDrawingTouch(e) {
    e.preventDefault();
    isDrawing = true;
    const rect = signatureCanvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = signatureCanvas.width / rect.width;
    const scaleY = signatureCanvas.height / rect.height;
    lastX = (touch.clientX - rect.left) * scaleX;
    lastY = (touch.clientY - rect.top) * scaleY;
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    
    const rect = signatureCanvas.getBoundingClientRect();
    const scaleX = signatureCanvas.width / rect.width;
    const scaleY = signatureCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    context.beginPath();
    context.moveTo(lastX, lastY);
    context.lineTo(x, y);
    context.stroke();
    
    lastX = x;
    lastY = y;
}

function drawTouch(e) {
    if (!isDrawing) return;
    e.preventDefault();
    
    const rect = signatureCanvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = signatureCanvas.width / rect.width;
    const scaleY = signatureCanvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    context.beginPath();
    context.moveTo(lastX, lastY);
    context.lineTo(x, y);
    context.stroke();
    
    lastX = x;
    lastY = y;
}

function stopDrawing() {
    isDrawing = false;
}

function clearSignature() {
    if (context) {
        context.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    }
}

// Функция для получения данных подписи
function getSignatureData() {
    return signatureCanvas.toDataURL('image/png');
}

// Функция для отображения данных пользователя
function createAndShowPdf() {
    // Очищаем область просмотра
    pdfViewer.innerHTML = '';
    
    // Создаем элемент для отображения данных пользователя
    const pdfContent = document.createElement('div');
    pdfContent.className = 'pdf-content';
    pdfContent.innerHTML = `
        <h3>Подтверждение данных</h3>
        <p>Имя, Фамилия: ${fullNameInput.value}</p>
        <p>Фамилия при рождении: ${birthSurnameInput.value}</p>
        <p>Дата рождения: ${birthDateInput.value}</p>
        <p>Родной город: ${hometownInput.value}</p>
        <p>Email: ${emailInput.value}</p>
        <p>Телефон: ${phoneInput.value}</p>
        <div class="signature-agreement">
            <p>Оставляя подпись вы соглашаетесь на то, что вы подписываете доверенность на фирму Svechynskyy с целью перенимать вашу кореспонденции от компании BIG direct gesund и последующей передачи её вам</p>
        </div>
    `;
    
    // Добавляем созданный элемент на страницу
    pdfViewer.appendChild(pdfContent);
    
    console.log('Данные пользователя отображены для подтверждения');
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
    
    // Создаем и показываем PDF
    createAndShowPdf();
    
    // Настраиваем холст для подписи
    setupSignatureCanvas();
});

// Обработка подтверждения подписи
submitSignatureBtn.addEventListener('click', async () => {
    try {
        // Проверяем, что подпись не пустая
        if (!hasSignature()) {
            alert('Пожалуйста, поставьте подпись перед отправкой');
            return;
        }
        
        const signatureData = getSignatureData();
        
        // Показываем индикатор загрузки
        tg.MainButton.setText('Отправка...');
        tg.MainButton.show();
        tg.MainButton.disable();
        
        // Собираем данные формы
        const formData = new FormData(form);
        
        // Преобразуем данные формы в объект для отправки
        const formDataObj = {};
        for (const [key, value] of formData.entries()) {
            if (key !== 'photo') {
                formDataObj[key] = value;
            }
        }
        
        // Добавляем Telegram Chat ID пользователя, если доступен
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            formDataObj.telegramChatId = tg.initDataUnsafe.user.id.toString();
        }
        
        // Создаем новый FormData для отправки
        const dataToSend = new FormData();
        
        // Добавляем фото, если оно есть
        if (photoInput.files.length > 0) {
            dataToSend.append('photo', photoInput.files[0]);
        }
        
        // Добавляем данные формы как JSON
        dataToSend.append('formData', JSON.stringify(formDataObj));
        
        // Добавляем данные о подписи
        dataToSend.append('signature', signatureData);
        
        // Добавляем Telegram Chat ID как отдельное поле (для надежности)
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            dataToSend.append('telegramChatId', tg.initDataUnsafe.user.id.toString());
        }
        
        // Отправляем данные на сервер
        const response = await fetch('/api/submit-form', {
            method: 'POST',
            body: dataToSend
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Сервер вернул ошибку: ${response.status} ${errorText}`);
        }
        
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
        alert('Произошла ошибка при отправке данных: ' + error.message);
        tg.MainButton.hide();
    }
});

// Проверка наличия подписи
function hasSignature() {
    if (!context) return false;
    
    try {
        const pixelData = context.getImageData(0, 0, signatureCanvas.width, signatureCanvas.height).data;
        
        // Проверяем, есть ли непрозрачные пиксели (подпись)
        for (let i = 3; i < pixelData.length; i += 4) {
            if (pixelData[i] > 0) {
                return true;
            }
        }
    } catch (e) {
        console.error('Ошибка при проверке подписи:', e);
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

// Функция для отправки формы без подписи
async function submitFormWithoutSignature() {
    try {
        // Показываем индикатор загрузки
        tg.MainButton.setText('Отправка...');
        tg.MainButton.show();
        tg.MainButton.disable();
        
        // Собираем данные формы
        const formData = new FormData(form);
        
        // Преобразуем данные формы в объект для отправки
        const formDataObj = {};
        for (const [key, value] of formData.entries()) {
            if (key !== 'photo') {
                formDataObj[key] = value;
            }
        }
        
        // Добавляем Telegram Chat ID пользователя, если доступен
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            formDataObj.telegramChatId = tg.initDataUnsafe.user.id.toString();
        }
        
        // Создаем новый FormData для отправки
        const dataToSend = new FormData();
        
        // Добавляем фото, если оно есть
        if (photoInput.files.length > 0) {
            dataToSend.append('photo', photoInput.files[0]);
        }
        
        // Добавляем данные формы как JSON
        dataToSend.append('formData', JSON.stringify(formDataObj));
        
        // Добавляем Telegram Chat ID как отдельное поле (для надежности)
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            dataToSend.append('telegramChatId', tg.initDataUnsafe.user.id.toString());
        }
        
        // Отправляем данные на сервер
        const response = await fetch('/api/submit-form', {
            method: 'POST',
            body: dataToSend
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Сервер вернул ошибку: ${response.status} ${errorText}`);
        }
        
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
        alert('Произошла ошибка при отправке данных: ' + error.message);
        tg.MainButton.hide();
    }
}