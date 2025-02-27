// index.js - Основной файл приложения с использованием переменных окружения
require('dotenv').config(); // Загружаем переменные окружения из .env файла
const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');
const { PDFDocument } = require('pdf-lib');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Получаем конфигурацию из переменных окружения
const config = {
  botToken: process.env.BOT_TOKEN, // Токен Telegram бота
  adminChatId: process.env.ADMIN_CHAT_ID, // ID чата администратора
  templatePdfPath: process.env.PDF_TEMPLATE_PATH || './template.pdf', // Путь к шаблону PDF
};

// Проверка наличия обязательных переменных
if (!config.botToken || !config.adminChatId) {
  console.error('Ошибка: Не заданы обязательные переменные окружения BOT_TOKEN и/или ADMIN_CHAT_ID');
  process.exit(1);
}

// Настройка Express
const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Проверяем существование директории для загрузок
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

// Проверяем существование директории для заполненных форм
const filledFormsDir = './filled_forms';
if (!fs.existsSync(filledFormsDir)) {
  fs.mkdirSync(filledFormsDir, { recursive: true });
}

// Инициализация бота Telegram
const bot = new Telegraf(config.botToken);

// Обработчик команды /start
bot.start((ctx) => {
  ctx.reply('Добро пожаловать! Для заполнения формы нажмите на кнопку ниже:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Заполнить форму', web_app: { url: process.env.WEBAPP_URL || 'https://your-mini-app-url.com' } }]
      ]
    }
  });
});

// API для сохранения данных формы
app.post('/api/submit-form', upload.single('photo'), async (req, res) => {
  try {
    const formData = JSON.parse(req.body.formData);
    const signatureData = req.body.signature;
    
    // Путь к загруженной фотографии
    const photoPath = req.file ? req.file.path : null;
    
    // Заполняем PDF данными пользователя
    const filledPdfBuffer = await fillPdfWithData(formData, signatureData);
    
    // Сохраняем заполненный PDF
    const pdfPath = `${filledFormsDir}/${Date.now()}_filled.pdf`;
    fs.writeFileSync(pdfPath, filledPdfBuffer);
    
    // Отправляем данные и документы администратору
    await sendDataToAdmin(formData, pdfPath, photoPath);
    
    res.json({ success: true, message: 'Данные успешно отправлены' });
  } catch (error) {
    console.error('Error processing form submission:', error);
    res.status(500).json({ success: false, message: 'Произошла ошибка при отправке данных' });
  }
});

// Функция для заполнения PDF данными
async function fillPdfWithData(formData, signatureData) {
  // Проверяем существование шаблона PDF
  if (!fs.existsSync(config.templatePdfPath)) {
    console.error(`Шаблон PDF не найден по пути: ${config.templatePdfPath}`);
    // Используем путь относительно текущей директории
    const alternativePath = path.join(__dirname, 'template.pdf');
    if (fs.existsSync(alternativePath)) {
      console.log(`Используем альтернативный путь к шаблону: ${alternativePath}`);
      config.templatePdfPath = alternativePath;
    } else {
      throw new Error(`Шаблон PDF не найден ни по основному, ни по альтернативному пути`);
    }
  }
  
  // Загружаем шаблон PDF
  const pdfBytes = fs.readFileSync(config.templatePdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  
  // Получаем размеры страницы
  const { width, height } = firstPage.getSize();
  
  // Добавляем текстовые данные на страницу
  const fontSize = 12;
  const textOptions = { size: fontSize };
  
  // Заполняем поля данными
  if (formData.fullName) {
    firstPage.drawText(formData.fullName, { x: 200, y: height - 150, ...textOptions });
  }
  
  if (formData.birthSurname) {
    firstPage.drawText(formData.birthSurname, { x: 200, y: height - 180, ...textOptions });
  }
  
  if (formData.birthDate) {
    firstPage.drawText(formData.birthDate, { x: 200, y: height - 210, ...textOptions });
  }
  
  if (formData.hometown) {
    firstPage.drawText(formData.hometown, { x: 200, y: height - 240, ...textOptions });
  }
  
  if (formData.insuranceAddress) {
    firstPage.drawText(formData.insuranceAddress, { x: 200, y: height - 270, ...textOptions });
  }
  
  if (formData.email) {
    firstPage.drawText(formData.email, { x: 200, y: height - 300, ...textOptions });
  }
  
  if (formData.phone) {
    firstPage.drawText(formData.phone, { x: 200, y: height - 330, ...textOptions });
  }
  
  // Добавляем подпись, если она есть
  if (signatureData) {
    try {
      // Удаляем префикс data:image/png;base64, если он есть
      const signatureBase64 = signatureData.replace(/^data:image\/png;base64,/, '');
      
      // Преобразуем данные подписи base64 в изображение
      const signatureImageBytes = Buffer.from(signatureBase64, 'base64');
      const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
      
      // Добавляем изображение подписи в PDF
      const signatureWidth = 200;
      const signatureHeight = 80;
      firstPage.drawImage(signatureImage, {
        x: 100,
        y: height - 480, // Позиция подписи
        width: signatureWidth,
        height: signatureHeight,
      });
    } catch (error) {
      console.warn(`Не удалось добавить подпись: ${error.message}`);
    }
  }
  
  // Сохраняем PDF
  return await pdfDoc.save();
}

// Функция для отправки данных администратору
async function sendDataToAdmin(formData, pdfPath, photoPath) {
  // Формируем сообщение с данными формы
  let message = 'Новая заявка:\n\n';
  Object.keys(formData).forEach(key => {
    message += `${key}: ${formData[key] || 'Не указано'}\n`;
  });
  
  // Отправляем сообщение администратору
  await bot.telegram.sendMessage(config.adminChatId, message);
  
  // Отправляем фото, если оно есть
  if (photoPath && fs.existsSync(photoPath)) {
    await bot.telegram.sendPhoto(config.adminChatId, { source: fs.createReadStream(photoPath) });
  }
  
  // Отправляем заполненный PDF
  if (fs.existsSync(pdfPath)) {
    await bot.telegram.sendDocument(config.adminChatId, { source: fs.createReadStream(pdfPath) });
  }
}

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

// Запускаем бота
bot.launch().then(() => {
  console.log('Бот успешно запущен');
});

// Обработка завершения процесса
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));