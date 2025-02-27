// index.js - Основной файл приложения с использованием переменных окружения
require('dotenv').config(); // Загружаем переменные окружения из .env файла
const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');
const { PDFDocument } = require('pdf-lib');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Функция для создания шаблона PDF, если он не существует
async function createTemplatePdfIfNotExists(templatePath) {
  if (!fs.existsSync(templatePath)) {
    console.log(`Шаблон PDF не найден по пути: ${templatePath}, создаем новый шаблон...`);
    
    try {
      // Создаем новый PDF документ
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4 размер
      
      // Добавляем текст на страницу
      const { width, height } = page.getSize();
      page.drawText('Шаблон формы для заполнения', { x: 100, y: height - 100, size: 16 });
      page.drawText('Имя, Фамилия: ___________________', { x: 100, y: height - 150, size: 12 });
      page.drawText('Фамилия при рождении: ___________________', { x: 100, y: height - 180, size: 12 });
      page.drawText('Дата рождения: ___________________', { x: 100, y: height - 210, size: 12 });
      page.drawText('Родной город: ___________________', { x: 100, y: height - 240, size: 12 });
      page.drawText('Адрес: ___________________', { x: 100, y: height - 270, size: 12 });
      page.drawText('Email: ___________________', { x: 100, y: height - 300, size: 12 });
      page.drawText('Телефон: ___________________', { x: 100, y: height - 330, size: 12 });
      page.drawText('Подпись:', { x: 100, y: height - 380, size: 12 });
      
      // Создаем прямоугольник для подписи
      page.drawRectangle({
        x: 100,
        y: height - 480,
        width: 200,
        height: 80,
        borderColor: { r: 0, g: 0, b: 0 },
        borderWidth: 1,
      });
      
      // Сохраняем PDF
      const pdfBytes = await pdfDoc.save();
      
      // Создаем директорию, если она не существует
      const dir = path.dirname(templatePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Записываем файл
      fs.writeFileSync(templatePath, pdfBytes);
      console.log(`Шаблон PDF успешно создан по пути: ${templatePath}`);
      return true;
    } catch (error) {
      console.error(`Ошибка при создании шаблона PDF: ${error.message}`);
      return false;
    }
  }
  return true;
}

// Получаем конфигурацию из переменных окружения
const config = {
  botToken: process.env.BOT_TOKEN || '7557471395:AAFNHZlMynXghYKmr16XWOWVfUpgAqP_Sh8', // Токен Telegram бота
  adminChatId: process.env.ADMIN_CHAT_ID || '6085514487', // ID чата администратора
  templatePdfPath: process.env.PDF_TEMPLATE_PATH || './template.pdf', // Путь к шаблону PDF
  webappUrl: process.env.WEBAPP_URL || 'https://versisch-fda933ace75b.herokuapp.com', // URL веб-приложения
};

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
        [{ text: 'Заполнить форму', web_app: { url: config.webappUrl } }]
      ]
    }
  });
});

// API для сохранения данных формы
app.post('/api/submit-form', upload.single('photo'), async (req, res) => {
  try {
    console.log('Получен запрос на отправку формы');
    
    if (!req.body.formData) {
      return res.status(400).json({ success: false, message: 'Отсутствуют данные формы' });
    }
    
    const formData = JSON.parse(req.body.formData);
    const signatureData = req.body.signature;
    
    console.log('Данные формы:', formData);
    
    // Путь к загруженной фотографии
    const photoPath = req.file ? req.file.path : null;
    console.log('Путь к фото:', photoPath);
    
    // Заполняем PDF данными пользователя
    const filledPdfBuffer = await fillPdfWithData(formData, signatureData);
    
    // Сохраняем заполненный PDF
    const pdfPath = `${filledFormsDir}/${Date.now()}_filled.pdf`;
    fs.writeFileSync(pdfPath, filledPdfBuffer);
    console.log('PDF сохранен по пути:', pdfPath);
    
    // Отправляем данные и документы администратору
    await sendDataToAdmin(formData, pdfPath, photoPath);
    
    res.json({ success: true, message: 'Данные успешно отправлены' });
  } catch (error) {
    console.error('Error processing form submission:', error);
    res.status(500).json({ success: false, message: 'Произошла ошибка при отправке данных: ' + error.message });
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
      // Создаем шаблон PDF
      const templateCreated = await createTemplatePdfIfNotExists(config.templatePdfPath);
      if (!templateCreated) {
        throw new Error(`Не удалось создать шаблон PDF`);
      }
    }
  }
  
  // Загружаем шаблон PDF
  const pdfBytes = fs.readFileSync(config.templatePdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  
  // Получаем размеры страницы
  const { width, height } = firstPage.getSize();
  console.log(`Размеры PDF: ширина=${width}, высота=${height}`);
  
  // Добавляем текстовые данные на страницу
  const fontSize = 12;
  const textOptions = { size: fontSize };
  
  // Определяем координаты полей на основе вашего PDF-шаблона
  // Эти значения могут потребовать корректировки в зависимости от вашего шаблона
  const fieldPositions = {
    fullName: { x: 200, y: height - 150 },
    birthSurname: { x: 200, y: height - 180 },
    birthDate: { x: 200, y: height - 210 },
    hometown: { x: 200, y: height - 240 },
    insuranceAddress: { x: 200, y: height - 270 },
    email: { x: 200, y: height - 300 },
    phone: { x: 200, y: height - 330 },
    signature: { x: 100, y: 100, width: 200, height: 80 } // Подпись внизу документа
  };
  
  console.log('Заполнение полей PDF данными из формы');
  
  // Заполняем поля данными
  if (formData.fullName) {
    firstPage.drawText(formData.fullName, { x: fieldPositions.fullName.x, y: fieldPositions.fullName.y, ...textOptions });
    console.log(`Заполнено поле fullName: ${formData.fullName}`);
  }
  
  if (formData.birthSurname) {
    firstPage.drawText(formData.birthSurname, { x: fieldPositions.birthSurname.x, y: fieldPositions.birthSurname.y, ...textOptions });
    console.log(`Заполнено поле birthSurname: ${formData.birthSurname}`);
  }
  
  if (formData.birthDate) {
    firstPage.drawText(formData.birthDate, { x: fieldPositions.birthDate.x, y: fieldPositions.birthDate.y, ...textOptions });
    console.log(`Заполнено поле birthDate: ${formData.birthDate}`);
  }
  
  if (formData.hometown) {
    firstPage.drawText(formData.hometown, { x: fieldPositions.hometown.x, y: fieldPositions.hometown.y, ...textOptions });
    console.log(`Заполнено поле hometown: ${formData.hometown}`);
  }
  
  // Заполняем адрес только если он указан
  if (formData.insuranceAddress && formData.insuranceAddress.trim() !== '') {
    firstPage.drawText(formData.insuranceAddress, { x: fieldPositions.insuranceAddress.x, y: fieldPositions.insuranceAddress.y, ...textOptions });
    console.log(`Заполнено поле insuranceAddress: ${formData.insuranceAddress}`);
  } else {
    console.log('Поле insuranceAddress не заполнено, так как оно пустое');
  }
  
  if (formData.email) {
    firstPage.drawText(formData.email, { x: fieldPositions.email.x, y: fieldPositions.email.y, ...textOptions });
    console.log(`Заполнено поле email: ${formData.email}`);
  }
  
  if (formData.phone) {
    firstPage.drawText(formData.phone, { x: fieldPositions.phone.x, y: fieldPositions.phone.y, ...textOptions });
    console.log(`Заполнено поле phone: ${formData.phone}`);
  }
  
  // Добавляем подпись, если она есть
  if (signatureData) {
    try {
      console.log('Добавление подписи в PDF');
      
      // Удаляем префикс data:image/png;base64, если он есть
      const signatureBase64 = signatureData.replace(/^data:image\/png;base64,/, '');
      
      // Преобразуем данные подписи base64 в изображение
      const signatureImageBytes = Buffer.from(signatureBase64, 'base64');
      const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
      
      // Добавляем изображение подписи в PDF в нижней части документа
      firstPage.drawImage(signatureImage, {
        x: fieldPositions.signature.x,
        y: fieldPositions.signature.y,
        width: fieldPositions.signature.width,
        height: fieldPositions.signature.height,
      });
      
      console.log('Подпись успешно добавлена в PDF');
    } catch (error) {
      console.warn(`Не удалось добавить подпись: ${error.message}`);
    }
  }
  
  // Сохраняем PDF
  console.log('Сохранение заполненного PDF');
  return await pdfDoc.save();
}

// Функция для отправки данных администратору
async function sendDataToAdmin(formData, pdfPath, photoPath) {
  try {
    // Формируем сообщение с данными формы
    let message = 'Новая заявка:\n\n';
    Object.keys(formData).forEach(key => {
      message += `${key}: ${formData[key] || 'Не указано'}\n`;
    });
    
    console.log('Отправка сообщения администратору:', config.adminChatId);
    
    // Отправляем сообщение администратору
    await bot.telegram.sendMessage(config.adminChatId, message);
    
    // Отправляем фото, если оно есть
    if (photoPath && fs.existsSync(photoPath)) {
      console.log('Отправка фото администратору');
      await bot.telegram.sendPhoto(config.adminChatId, { source: fs.createReadStream(photoPath) });
    }
    
    // Отправляем заполненный PDF
    if (fs.existsSync(pdfPath)) {
      console.log('Отправка PDF администратору');
      await bot.telegram.sendDocument(config.adminChatId, { source: fs.createReadStream(pdfPath) });
    }
    
    console.log('Данные успешно отправлены администратору');
  } catch (error) {
    console.error('Ошибка при отправке данных администратору:', error);
    throw error;
  }
}

// Добавляем маршрут для проверки работоспособности
app.get('/', (req, res) => {
  res.send('Сервер работает! Для использования приложения откройте его через Telegram бота.');
});

// Добавляем маршрут для получения PDF-шаблона
app.get('/api/get-template-pdf', (req, res) => {
  try {
    console.log('Запрос на получение PDF-шаблона');
    
    // Проверяем существование шаблона PDF
    const templatePath = path.join(__dirname, 'BIG_Vermittlervollmacht§34d.pdf');
    
    if (!fs.existsSync(templatePath)) {
      console.error(`Шаблон PDF не найден по пути: ${templatePath}`);
      return res.status(404).send('PDF шаблон не найден');
    }
    
    // Устанавливаем заголовки для файла
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=template.pdf');
    
    // Отправляем файл клиенту
    const fileStream = fs.createReadStream(templatePath);
    fileStream.pipe(res);
    
    console.log('PDF-шаблон успешно отправлен клиенту');
  } catch (error) {
    console.error('Ошибка при отправке PDF-шаблона:', error);
    res.status(500).send('Ошибка при загрузке PDF-шаблона');
  }
});

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  
  // Создаем шаблон PDF при запуске, если его нет
  await createTemplatePdfIfNotExists(config.templatePdfPath);
});

// Запускаем бота
bot.launch().then(() => {
  console.log('Бот успешно запущен');
}).catch(error => {
  console.error(`Ошибка при запуске бота: ${error.message}`);
});

// Обработка завершения процесса
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));