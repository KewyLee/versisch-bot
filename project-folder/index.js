// index.js - Основной файл приложения с использованием переменных окружения
require('dotenv').config(); // Загружаем переменные окружения из .env файла
const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Получаем конфигурацию из переменных окружения
const config = {
  botToken: process.env.BOT_TOKEN || '7557471395:AAFNHZlMynXghYKmr16XWOWVfUpgAqP_Sh8', // Токен Telegram бота
  adminChatId: process.env.ADMIN_CHAT_ID || '6085514487', // ID чата администратора
  templatePdfPath: process.env.PDF_TEMPLATE_PATH || path.join(__dirname, '..', 'BIG_Vermittlervollmacht.pdf'), // Путь к шаблону PDF
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
    
    // Формируем ID чата пользователя, если есть в данных
    const userChatId = formData.telegramChatId || req.body.telegramChatId;
    
    // Отправляем данные и документы администратору
    await sendDataToAdmin(formData, pdfPath, photoPath);
    
    // Если есть ID чата пользователя, отправляем документ пользователю
    if (userChatId) {
      try {
        // Сначала отправляем фото, если оно есть
        if (photoPath && fs.existsSync(photoPath)) {
          await bot.telegram.sendPhoto(userChatId, { source: fs.createReadStream(photoPath) });
        }
        
        // Формируем сообщение с данными
        let message = 'Данные в формате:\n\n';
        
        // Обрабатываем имя и фамилию отдельно
        if (formData.fullName) {
          const nameParts = formData.fullName.split(' ');
          if (nameParts.length >= 2) {
            message += `Имя: \`${nameParts[0]}\`\n`;
            message += `Фамилия: \`${nameParts.slice(1).join(' ')}\`\n`;
          } else {
            message += `Имя: \`${formData.fullName}\`\n`;
          }
        }
        
        // Добавляем остальные данные формы
        Object.keys(formData).forEach(key => {
          if (key !== 'fullName' && formData[key]) {
            message += `${key}: \`${formData[key]}\`\n`;
          }
        });
        
        // Отправляем сообщение с данными
        await bot.telegram.sendMessage(userChatId, message, { parse_mode: 'Markdown' });
        
        // Отправляем заполненный PDF
        await bot.telegram.sendDocument(userChatId, { source: fs.createReadStream(pdfPath) });
        
        console.log(`Документ успешно отправлен пользователю в чат: ${userChatId}`);
      } catch (chatError) {
        console.error(`Ошибка при отправке документа пользователю: ${chatError.message}`);
        // Продолжаем работу даже если не удалось отправить документ пользователю
      }
    }
    
    res.json({ success: true, message: 'Данные успешно отправлены' });
  } catch (error) {
    console.error('Error processing form submission:', error);
    res.status(500).json({ success: false, message: 'Произошла ошибка при отправке данных: ' + error.message });
  }
});

// Функция для заполнения PDF данными
async function fillPdfWithData(formData, signatureData) {
  try {
    console.log('Начало заполнения PDF данными');
    console.log('Путь к шаблону PDF:', config.templatePdfPath);
    
    // Проверяем существование PDF шаблона
    if (!fs.existsSync(config.templatePdfPath)) {
      console.error(`Шаблон PDF не найден по пути: ${config.templatePdfPath}`);
      console.log('Попытка создать временный базовый шаблон...');
      
      // Создаем временный базовый шаблон
      const tempPath = path.join(__dirname, 'temp_template.pdf');
      const created = await createBasicPdfTemplate(tempPath);
      
      if (created) {
        console.log(`Базовый PDF-шаблон успешно создан по пути: ${tempPath}`);
        config.templatePdfPath = tempPath;
        console.log(`Используем временный шаблон: ${config.templatePdfPath}`);
      } else {
        throw new Error(`Не удалось создать базовый PDF-шаблон для заполнения данными`);
      }
    }
    
    console.log('Шаблон PDF найден, приступаем к заполнению');
    
    // Загружаем шаблон PDF
    const pdfBytes = fs.readFileSync(config.templatePdfPath);
    console.log(`Размер шаблона PDF: ${pdfBytes.length} байт`);
    
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      
      if (pages.length === 0) {
        throw new Error('PDF документ не содержит страниц');
      }
      
      const firstPage = pages[0];
      
      // Получаем размеры страницы
      const { width, height } = firstPage.getSize();
      console.log(`Размеры PDF: ширина=${width}, высота=${height}`);
      
      // Добавляем текстовые данные на страницу
      const fontSize = 12;
      const textOptions = { size: fontSize };
      
      // Определяем координаты полей для Vermittlervollmacht PDF
      // Эти координаты нужно настроить под реальный PDF
      const fieldPositions = {
        fullName: { x: 120, y: height - 150 },      // Позиция для полного имени
        birthSurname: { x: 120, y: height - 180 },  // Позиция для фамилии при рождении
        birthDate: { x: 350, y: height - 210 },     // Позиция для даты рождения
        hometown: { x: 350, y: height - 240 },      // Позиция для родного города
        insuranceAddress: { x: 120, y: height - 270 }, // Позиция для адреса
        email: { x: 120, y: height - 300 },         // Позиция для email
        phone: { x: 350, y: height - 330 },         // Позиция для телефона
        signature: { x: 120, y: height - 580, width: 200, height: 60 } // Позиция для подписи над "Unterschrift des Versicherten"
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
          console.log('Добавление подписи в PDF над строкой "Unterschrift des Versicherten"');
          
          // Удаляем префикс data:image/png;base64, если он есть
          const signatureBase64 = signatureData.replace(/^data:image\/png;base64,/, '');
          console.log('Длина данных подписи:', signatureBase64.length);
          
          // Преобразуем данные подписи base64 в изображение
          const signatureImageBytes = Buffer.from(signatureBase64, 'base64');
          const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
          
          // Добавляем изображение подписи в PDF над строкой "Unterschrift des Versicherten"
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
    } catch (pdfError) {
      console.error(`Ошибка при обработке PDF: ${pdfError.message}`);
      throw new Error(`Ошибка при работе с PDF: ${pdfError.message}`);
    }
  } catch (error) {
    console.error(`Ошибка при заполнении PDF: ${error.message}`);
    throw error;
  }
}

// Функция для отправки данных администратору
async function sendDataToAdmin(formData, pdfPath, photoPath) {
  try {
    console.log('Отправка данных администратору:', config.adminChatId);
    
    // Сначала отправляем фото, если оно есть
    if (photoPath && fs.existsSync(photoPath)) {
      console.log('Отправка фото администратору');
      await bot.telegram.sendPhoto(config.adminChatId, { source: fs.createReadStream(photoPath) });
    }
    
    // Формируем сообщение с данными формы в нужном формате
    let message = 'Данные в формате:\n\n';
    
    // Обрабатываем имя и фамилию отдельно, если имя и фамилия вместе
    if (formData.fullName) {
      const nameParts = formData.fullName.split(' ');
      if (nameParts.length >= 2) {
        message += `Имя: \`${nameParts[0]}\`\n`;
        message += `Фамилия: \`${nameParts.slice(1).join(' ')}\`\n`;
      } else {
        message += `Имя: \`${formData.fullName}\`\n`;
      }
    }
    
    // Добавляем остальные данные формы с форматированием для копирования
    Object.keys(formData).forEach(key => {
      // Пропускаем fullName, так как мы уже обработали его выше
      if (key !== 'fullName' && formData[key]) {
        message += `${key}: \`${formData[key]}\`\n`;
      }
    });
    
    // Отправляем сообщение с данными в формате Markdown для возможности копирования
    await bot.telegram.sendMessage(config.adminChatId, message, { parse_mode: 'Markdown' });
    
    // Отправляем заполненный PDF последним
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

// Функция для создания базового PDF-шаблона, если основной не найден
async function createBasicPdfTemplate(outputPath) {
  try {
    console.log(`Создаю базовый PDF-шаблон по пути: ${outputPath}`);
    
    // Создаем новый PDF документ
    const pdfDoc = await PDFDocument.create();
    
    // Добавляем страницу формата A4
    const page = pdfDoc.addPage([595, 842]);
    
    // Получаем размеры страницы
    const { width, height } = page.getSize();
    
    // Загружаем стандартный шрифт
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Добавляем заголовок
    page.drawText('Vermittlervollmacht', {
      x: 50,
      y: height - 50,
      size: 24,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    // Добавляем поля для данных
    const fieldLabels = [
      { label: 'Name, Vorname:', y: height - 150 },
      { label: 'Geburtsname:', y: height - 180 },
      { label: 'Geburtsdatum:', y: height - 210 },
      { label: 'Geburtsort:', y: height - 240 },
      { label: 'Anschrift:', y: height - 270 },
      { label: 'E-Mail:', y: height - 300 },
      { label: 'Telefon:', y: height - 330 }
    ];
    
    // Рисуем метки полей
    fieldLabels.forEach(field => {
      page.drawText(field.label, {
        x: 50,
        y: field.y,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
    });
    
    // Добавляем место для подписи
    page.drawText('Unterschrift des Versicherten:', {
      x: 50,
      y: height - 550,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    // Рисуем линию для подписи
    page.drawLine({
      start: { x: 50, y: height - 580 },
      end: { x: 250, y: height - 580 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    
    // Сохраняем PDF
    const pdfBytes = await pdfDoc.save();
    
    // Создаем директорию, если она не существует
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Записываем файл
    fs.writeFileSync(outputPath, pdfBytes);
    console.log(`Базовый PDF-шаблон успешно создан по пути: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Ошибка при создании базового PDF-шаблона: ${error.message}`);
    return false;
  }
}

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Исходный путь к шаблону PDF: ${config.templatePdfPath}`);
  console.log(`Абсолютный путь к директории приложения: ${__dirname}`);
  
  // Проверка различных возможных мест расположения файла
  const possiblePaths = [
    config.templatePdfPath,
    path.join(__dirname, 'BIG_Vermittlervollmacht.pdf'),
    path.join(__dirname, '..', 'BIG_Vermittlervollmacht.pdf'),
    path.join(__dirname, '..', 'public', 'BIG_Vermittlervollmacht.pdf'),
    path.join(__dirname, 'public', 'BIG_Vermittlervollmacht.pdf'),
    './BIG_Vermittlervollmacht.pdf',
    '../BIG_Vermittlervollmacht.pdf'
  ];
  
  console.log('Проверка возможных путей к PDF файлу:');
  let pdfFound = false;
  
  for (const pdfPath of possiblePaths) {
    const exists = fs.existsSync(pdfPath);
    console.log(`- ${pdfPath}: ${exists ? 'СУЩЕСТВУЕТ' : 'НЕ СУЩЕСТВУЕТ'}`);
    
    if (exists && !pdfFound) {
      console.log(`PDF найден! Обновляем путь к шаблону: ${pdfPath}`);
      config.templatePdfPath = pdfPath;
      pdfFound = true;
    }
  }
  
  if (pdfFound) {
    console.log(`Итоговый путь к шаблону PDF: ${config.templatePdfPath}`);
  } else {
    console.error('PDF не найден ни по одному из проверенных путей!');
    console.log('Создаем базовый PDF-шаблон...');
    
    // Создаем временный базовый шаблон
    const tempPath = path.join(__dirname, 'temp_template.pdf');
    const created = await createBasicPdfTemplate(tempPath);
    
    if (created) {
      console.log(`Базовый PDF-шаблон успешно создан по пути: ${tempPath}`);
      config.templatePdfPath = tempPath;
      console.log(`Используем временный шаблон: ${config.templatePdfPath}`);
    } else {
      console.error('Не удалось создать базовый PDF-шаблон!');
    }
  }
  
  // Проверяем существование директорий
  if (!fs.existsSync(filledFormsDir)) {
    fs.mkdirSync(filledFormsDir, { recursive: true });
    console.log(`Создана директория для заполненных форм: ${filledFormsDir}`);
  }
  
  const uploadDir = './uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Создана директория для загрузок: ${uploadDir}`);
  }
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