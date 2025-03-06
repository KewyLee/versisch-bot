// index.js - Основной файл приложения с использованием переменных окружения
require('dotenv').config(); // Загружаем переменные окружения из .env файла
const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Импортируем функцию из нового модуля для генерации PDF
const { generatePdfFromData } = require('./utils/pdfGenerator');

// Получаем конфигурацию из переменных окружения
const config = {
  botToken: process.env.BOT_TOKEN || '7557471395:AAFNHZlMynXghYKmr16XWOWVfUpgAqP_Sh8', // Токен Telegram бота
  adminChatId: process.env.ADMIN_CHAT_ID || '6085514487', // ID чата администратора
  templatePdfPath: process.env.PDF_TEMPLATE_PATH || path.join(__dirname, 'BIG_Vermittlervollmacht.pdf'), // Путь к шаблону PDF
  webappUrl: process.env.WEBAPP_URL || 'https://versisch-fda933ace75b.herokuapp.com', // URL веб-приложения
};

/**
 * Разбирает адрес на компоненты: улица, номер дома, индекс, город
 * @param {string} address - Полный адрес
 * @returns {Object} - Объект с компонентами адреса
 */
function parseAddress(address) {
  if (!address || typeof address !== 'string') {
    return { street: '', houseNumber: '', zipCode: '', city: '' };
  }
  
  console.log(`Разбор адреса: ${address}`);
  
  // Попытка разбора адреса с использованием регулярного выражения
  // Формат: "Улица НомерДома, Индекс Город" или "Улица НомерДома Индекс Город"
  const addressRegex = /^(.*?)(\d+[a-zA-Z]?)(?:,?\s+)(\d{5})(?:\s+)(.*)$/;
  const match = address.match(addressRegex);
  
  if (match) {
    return {
      street: match[1].trim(),
      houseNumber: match[2],
      zipCode: match[3],
      city: match[4]
    };
  }
  
  // Если не удалось разобрать по регулярному выражению, пробуем другой подход
  // Проверяем, есть ли в адресе цифры (возможный номер дома)
  const houseNumberMatch = address.match(/(\d+[a-zA-Z]?)/);
  let street = address;
  let houseNumber = '';
  
  if (houseNumberMatch) {
    const parts = address.split(houseNumberMatch[0]);
    street = parts[0].trim();
    houseNumber = houseNumberMatch[0];
    
    // Проверяем, есть ли после номера дома еще текст (возможный индекс и город)
    if (parts[1]) {
      const cityParts = parts[1].trim().split(/\s+/);
      // Если первая часть похожа на индекс (5 цифр)
      if (cityParts[0] && /^\d{5}$/.test(cityParts[0])) {
        return {
          street: street,
          houseNumber: houseNumber,
          zipCode: cityParts[0],
          city: cityParts.slice(1).join(' ')
        };
      }
    }
  }
  
  // Если не удалось разобрать адрес, возвращаем только улицу
  console.log(`Не удалось полностью разобрать адрес. Используем как улицу: ${street}`);
  return {
    street: street,
    houseNumber: houseNumber,
    zipCode: '',
    city: ''
  };
}

// Проверка наличия обязательных переменных
if (!config.botToken || !config.adminChatId) {
  console.warn('Внимание: Не заданы переменные окружения BOT_TOKEN и/или ADMIN_CHAT_ID. Используются значения по умолчанию.');
}

// Настройка Express
const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Проверяем существование директорий для загрузок
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Проверяем существование директорий для заполненных форм
const filledFormsDir = './filled_forms';
if (!fs.existsSync(filledFormsDir)) {
  fs.mkdirSync(filledFormsDir, { recursive: true });
}

// Инициализация бота Telegram
const bot = new Telegraf(config.botToken);

// Обработчик команды /start
bot.start((ctx) => {
  // Сохраняем информацию о пользователе, который начал общение с ботом
  const userId = ctx.from.id;
  const userName = ctx.from.username || '';
  const firstName = ctx.from.first_name || '';
  const lastName = ctx.from.last_name || '';
  
  console.log(`Пользователь начал взаимодействие с ботом: ID ${userId}, username: @${userName}, имя: ${firstName} ${lastName}`);
  
  ctx.reply('Добро пожаловать! Для заполнения формы выберите тип:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Стандартная форма', web_app: { 
          url: `${config.webappUrl}?userId=${userId}&username=${userName}&name=${encodeURIComponent(firstName + ' ' + lastName)}` 
        } }],
        [{ text: 'Доверенность BIG', web_app: { 
          url: `${config.webappUrl}/vollmacht?userId=${userId}&username=${userName}&name=${encodeURIComponent(firstName + ' ' + lastName)}` 
        } }]
      ]
    }
  });
});

// Функция для отправки данных администратору
async function sendDataToAdmin(formData, pdfPath, photoPath) {
  try {
    console.log('Отправка данных администратору...');
    
    // Проверяем существование PDF файла
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF файл не найден: ${pdfPath}`);
    }
    
    // Формируем сообщение с данными пользователя
    let message = `🔔 *Новая заявка от пользователя*\n\n`;
    message += `👤 *Имя*: ${formData.firstName || ''} ${formData.lastName || ''}\n`;
    
    if (formData.insuranceNumber) {
      message += `📋 *Номер страховки*: ${formData.insuranceNumber}\n`;
    }
    
    if (formData.insuranceAddress) {
      message += `🏠 *Адрес*: ${formData.insuranceAddress}\n`;
    }
    
    if (formData.insuranceCompany) {
      message += `🏢 *Страховая компания*: ${formData.insuranceCompany}\n`;
    }
    
    if (formData.birthDate) {
      message += `🎂 *Дата рождения*: ${formData.birthDate}\n`;
    }
    
    // Получаем ID чата администратора из конфигурации
    const adminChatId = process.env.ADMIN_CHAT_ID;
    
    if (!adminChatId) {
      console.warn('ID чата администратора не указан в конфигурации');
      return false;
    }
    
    // Отправляем сообщение администратору
    await bot.telegram.sendMessage(adminChatId, message, { parse_mode: 'Markdown' });
    
    // Отправляем PDF файл
    console.log(`Отправка PDF файла: ${pdfPath}`);
    await bot.telegram.sendDocument(adminChatId, {
      source: fs.readFileSync(pdfPath),
      filename: path.basename(pdfPath)
    });
    
    // Отправляем фото подписи, если оно есть
    if (photoPath && fs.existsSync(photoPath)) {
      console.log(`Отправка фото подписи: ${photoPath}`);
      await bot.telegram.sendPhoto(adminChatId, {
        source: fs.readFileSync(photoPath)
      });
    }
    
    console.log('Данные успешно отправлены администратору');
    return true;
  } catch (error) {
    console.error('Ошибка при отправке данных администратору:', error);
    throw error;
  }
}

// API для сохранения данных формы
app.post('/api/submit-form', async (req, res) => {
  try {
    console.log('Получен запрос на сохранение данных формы');
    const formData = req.body;
    
    // Проверяем наличие обязательных полей
    if (!formData.firstName || !formData.lastName) {
      return res.status(400).json({ success: false, error: 'Не указаны обязательные поля' });
    }
    
    console.log('Данные формы:', formData);
    
    // Обрабатываем адрес, если он есть
    if (formData.insuranceAddress) {
      const addressComponents = parseAddress(formData.insuranceAddress);
      formData.addressComponents = addressComponents;
      console.log('Разобранный адрес:', addressComponents);
    }
    
    // Создаем PDF на основе данных формы
    console.log('Создание PDF...');
    let pdfPath;
    try {
      pdfPath = await generatePdfFromData(formData, formData.signatureData);
      console.log(`PDF успешно создан: ${pdfPath}`);
    } catch (error) {
      console.error('Ошибка при создании PDF:', error);
      return res.status(500).json({ success: false, error: `Ошибка при создании PDF: ${error.message}` });
    }
    
    // Сохраняем подпись как отдельное изображение, если она есть
    let photoPath = null;
    if (formData.signatureData) {
      try {
        // Удаляем префикс data:image/png;base64, если он есть
        const base64Data = formData.signatureData.replace(/^data:image\/png;base64,/, '');
        
        // Создаем директорию для подписей, если она не существует
        const signatureDir = path.join(__dirname, 'signatures');
        if (!fs.existsSync(signatureDir)) {
          fs.mkdirSync(signatureDir, { recursive: true });
        }
        
        // Сохраняем подпись как файл
        photoPath = path.join(signatureDir, `signature_${Date.now()}.png`);
        fs.writeFileSync(photoPath, Buffer.from(base64Data, 'base64'));
        console.log(`Подпись сохранена: ${photoPath}`);
      } catch (error) {
        console.error('Ошибка при сохранении подписи:', error);
        // Продолжаем выполнение даже при ошибке сохранения подписи
      }
    }
    
    // Отправляем данные администратору
    try {
      await sendDataToAdmin(formData, pdfPath, photoPath);
      console.log('Данные успешно отправлены администратору');
    } catch (error) {
      console.error('Ошибка при отправке данных администратору:', error);
      // Продолжаем выполнение даже при ошибке отправки
    }
    
    // Отправляем успешный ответ
    res.json({ success: true, message: 'Данные успешно сохранены' });
  } catch (error) {
    console.error('Ошибка при обработке запроса:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Маршрут для формы доверенности BIG
app.get('/vollmacht', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vollmacht.html'));
});

// Добавляем маршрут для проверки работоспособности
app.get('/', (req, res) => {
  res.send('Сервер работает! Для использования приложения откройте его через Telegram бота.');
});

// Добавляем маршрут для получения PDF-шаблона
app.get('/api/get-template-pdf', (req, res) => {
  try {
    console.log('Запрос на получение PDF-шаблона');
    console.log('Искомый путь к шаблону:', config.templatePdfPath);
    
    // Проверяем существование шаблона
    if (!fs.existsSync(config.templatePdfPath)) {
      console.error(`Шаблон PDF не найден по пути: ${config.templatePdfPath}`);
      return res.status(404).send('PDF шаблон не найден. Пожалуйста, убедитесь, что файл BIG_Vermittlervollmacht.pdf добавлен в проект.');
    }
    
    console.log('Шаблон PDF найден, отправляем его клиенту');
    // Устанавливаем заголовки для файла
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=template.pdf');
    
    // Отправляем файл клиенту
    const fileStream = fs.createReadStream(config.templatePdfPath);
    fileStream.pipe(res);
    
    console.log('PDF-шаблон успешно отправлен клиенту');
  } catch (error) {
    console.error('Ошибка при отправке PDF-шаблона:', error);
    res.status(500).send('Ошибка при загрузке PDF-шаблона');
  }
});

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`WebApp URL: ${config.webappUrl}`);
  console.log(`Шаблон PDF: ${config.templatePdfPath}`);
  
  // Запуск бота Telegram
  bot.launch()
    .then(() => console.log('Telegram бот запущен'))
    .catch(err => console.error('Ошибка запуска Telegram бота:', err));
  
  // Корректное завершение работы при сигнале остановки
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
});