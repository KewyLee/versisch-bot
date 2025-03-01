// index.js - Основной файл приложения с использованием переменных окружения
require('dotenv').config(); // Загружаем переменные окружения из .env файла
const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { jsPDF } = require('jspdf');
require('jspdf-autotable'); // Подключаем дополнение для работы с таблицами

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

// API для сохранения данных формы
app.post('/api/submit-form', upload.single('photo'), async (req, res) => {
  try {
    console.log('Получен запрос на отправку формы');
    
    if (!req.body.formData) {
      return res.status(400).json({ success: false, message: 'Отсутствуют данные формы' });
    }
    
    const formData = JSON.parse(req.body.formData);
    const signatureData = req.body.signature;
    
    // Получаем параметры пользователя из запроса
    // Сначала проверяем параметры запроса
    if (req.query) {
      if (req.query.username) {
        formData.telegramUsername = req.query.username;
      }
      if (req.query.userId) {
        formData.telegramChatId = req.query.userId;
      }
    }
    
    // Также проверяем параметры из тела запроса
    if (req.body.username) {
      formData.telegramUsername = req.body.username;
    }
    if (req.body.telegramChatId) {
      formData.telegramChatId = req.body.telegramChatId;
    }
    
    console.log('Данные формы:', formData);
    console.log('Данные Telegram:', { 
      username: formData.telegramUsername || 'не указан', 
      chatId: formData.telegramChatId || 'не указан' 
    });
    
    // Путь к загруженной фотографии
    const photoPath = req.file ? req.file.path : null;
    console.log('Путь к фото:', photoPath);
    
    // Заполняем PDF данными пользователя
    const filledPdfBuffer = await fillPdfWithData(formData, signatureData);
    
    // Сохраняем заполненный PDF с расширением .pdf
    const pdfFileName = `${Date.now()}_filled.pdf`;
    const pdfPath = `${filledFormsDir}/${pdfFileName}`;
    fs.writeFileSync(pdfPath, filledPdfBuffer);
    console.log('PDF сохранен по пути:', pdfPath);
    
    // Формируем ID чата пользователя, если есть в данных
    const userChatId = formData.telegramChatId || req.body.telegramChatId;
    
    // Отправляем данные и документы администратору
    await sendDataToAdmin(formData, pdfPath, photoPath);
    
    // Если есть ID чата пользователя, отправляем документ пользователю
    if (userChatId) {
      try {
        // Сначала отправляем сообщение о успешной отправке заявки
        let userMessage = "*Заявка отправлена!*\n";
        userMessage += "По всем вопросам связанным с оформлением связывайтесь в *вашей группе* с упоминанием Игоря([@helpgermany](https://t.me/helpgermany))\n\n";
        userMessage += "*Ваши данные:*\n\n";
        
        // Добавляем данные пользователя с русскими названиями полей
        const fieldNames = {
          fullName: 'Имя и фамилия',
          birthSurname: 'Фамилия при рождении',
          birthDate: 'Дата рождения',
          hometown: 'Место рождения',
          insuranceAddress: 'Адрес',
          maritalStatus: 'Семейное положение',
          email: 'Email',
          phone: 'Телефон'
        };
        
        // Добавляем данные формы с переводом названий полей
        Object.keys(formData).forEach(key => {
          // Не включаем ID чата в сообщение пользователю
          if (key !== 'telegramChatId' && formData[key]) {
            const fieldName = fieldNames[key] || key;
            userMessage += `${fieldName}: \`${formData[key]}\`\n`;
          }
        });
        
        // Отправляем сообщение с данными
        await bot.telegram.sendMessage(userChatId, userMessage, { parse_mode: 'Markdown' });
        
        // Отправляем фото, если оно есть
        if (photoPath && fs.existsSync(photoPath)) {
          await bot.telegram.sendPhoto(userChatId, { source: fs.createReadStream(photoPath) });
        }
        
        // Отправляем заполненный PDF с явным указанием типа документа
        await bot.telegram.sendDocument(userChatId, { 
          source: fs.createReadStream(pdfPath),
          filename: pdfFileName 
        });
        
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

// Функция для заполнения PDF данными с использованием jsPDF
async function fillPdfWithData(formData, signatureData) {
  try {
    console.log('Начало заполнения PDF данными с использованием jsPDF');
    
    // Создаем новый PDF документ формата A4
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Функция для добавления текста
    function addText(text, x, y, options = {}) {
      if (!text) return;
      
      const defaultOptions = {
        fontSize: 10,
        align: 'left'
      };
      
      const finalOptions = { ...defaultOptions, ...options };
      
      doc.setFontSize(finalOptions.fontSize);
      doc.text(text, x, y, { align: finalOptions.align });
    }
    
    // Функция для добавления чекбокса
    function addCheckbox(x, y, checked = true, size = 4) {
      doc.rect(x, y, size, size);
      if (checked) {
        doc.line(x, y, x + size, y + size);
        doc.line(x + size, y, x, y + size);
      }
    }
    
    // Функция для добавления подписи
    async function addSignature(signatureData, x, y, width, height) {
      if (!signatureData) return;
      
      try {
        const signatureBase64 = signatureData.replace(/^data:image\/png;base64,/, '');
        doc.addImage(signatureBase64, 'PNG', x, y, width, height);
        console.log('Подпись успешно добавлена в PDF');
      } catch (error) {
        console.warn(`Не удалось добавить подпись: ${error.message}`);
      }
    }
    
    // Добавляем заголовок документа
    doc.setFontSize(14);
    doc.text('Vollmacht für Vertriebspartner §34d GewO', 105, 20, { align: 'center' });
    doc.text('zurück an die BIG', 105, 27, { align: 'center' });
    
    // Раздел "Личные данные застрахованного"
    doc.setFontSize(12);
    doc.text('Persönliche Angaben des Versicherten', 15, 40);
    
    // Линия под заголовком
    doc.line(15, 43, 195, 43);
    
    // Данные клиента
    if (formData.fullName) {
      const nameParts = formData.fullName.split(' ');
      if (nameParts.length > 1) {
        const lastName = nameParts[0];
        const firstName = nameParts.slice(1).join(' ');
        
        addText('Name:', 15, 50);
        addText(lastName, 40, 50);
        
        addText('Vorname:', 95, 50);
        addText(firstName, 120, 50);
      } else {
        addText('Name:', 15, 50);
        addText(formData.fullName, 40, 50);
      }
    }
    
    addText('Geburtsdatum:', 15, 60);
    addText(formData.birthDate || '', 50, 60);
    
    addText('Geburtsname:', 95, 60);
    addText(formData.birthSurname || '', 135, 60);
    
    addText('Geburtsort:', 15, 70);
    addText(formData.hometown || '', 50, 70);
    
    // Обработка адреса
    if (formData.insuranceAddress) {
      const addressMatch = formData.insuranceAddress.match(/^(.*?)(\d+[a-zA-Z]?),?\s*(\d+)\s*(.*)$/);
      
      if (addressMatch) {
        addText('Straße:', 15, 80);
        addText(addressMatch[1].trim(), 40, 80);
        
        addText('Hausnummer:', 95, 80);
        addText(addressMatch[2], 135, 80);
        
        addText('PLZ:', 15, 90);
        addText(addressMatch[3], 40, 90);
        
        addText('Ort:', 95, 90);
        addText(addressMatch[4], 110, 90);
      } else {
        addText('Adresse:', 15, 80);
        addText(formData.insuranceAddress, 40, 80);
      }
    }
    
    addText('Email:', 15, 100);
    addText(formData.email || '', 40, 100);
    
    addText('Telefon:', 95, 100);
    addText(formData.phone || '', 125, 100);
    
    // Раздел "Данные уполномоченного партнера по продажам"
    doc.setFontSize(12);
    doc.text('Persönliche Angaben des bevollmächtigten Vertriebspartners nach §34d GewO', 15, 120);
    
    // Линия под заголовком
    doc.line(15, 123, 195, 123);
    
    // Данные партнера (предзаполненные)
    addText('Name:', 15, 130);
    addText('Bergheim', 40, 130);
    
    addText('Vorname:', 95, 130);
    addText('Elmar', 125, 130);
    
    addText('Firmenname:', 15, 140);
    addText('Bergheim Versicherungsmakler GmbH', 50, 140);
    
    addText('Straße:', 15, 150);
    addText('Kreuzstr.', 40, 150);
    
    addText('Hausnummer:', 95, 150);
    addText('19', 135, 150);
    
    addText('PLZ:', 15, 160);
    addText('50189', 40, 160);
    
    addText('Ort:', 95, 160);
    addText('Elsdorf', 110, 160);
    
    // Раздел "Доверенность"
    doc.setFontSize(12);
    doc.text('Bevollmächtigung', 15, 180);
    
    // Линия под заголовком
    doc.line(15, 183, 195, 183);
    
    // Текст доверенности
    doc.setFontSize(10);
    const authorizationText = 'Hiermit bevollmächtige ich die o.g. Vertriebspartner der BIG direkt leben die für mich bestehenden Verträge bei der BIG direkt leben namens und im Auftrag für mich zu verwalten. Die Vollmacht für den Vertriebspartner kann jederzeit ohne Angabe von Gründen durch den Versicherungsnehmer widerrufen werden.';
    doc.text(authorizationText, 15, 190, { maxWidth: 180 });
    
    // Чекбокс согласия
    addCheckbox(15, 210, true);
    doc.text('Ich bin damit einverstanden, dass der o.g. Vertriebspartner meine Daten zum Zwecke der Antragsbearbeitung, Beratung sowie Vertragsverwaltung verarbeitet. Bei einem Widerruf der Vollmacht bearbeitet die BIG direkt leben in Zukunft sämtliche Anfragen und Mitteilungen zu dem Vertrag direkt mit mir.', 22, 212, { maxWidth: 170 });
    
    // Место для подписи
    addText('Ort:', 15, 240);
    addText(formData.ort || 'Bergheim', 30, 240);
    
    addText('Datum:', 75, 240);
    addText(formData.datum || new Date().toLocaleDateString('de-DE'), 95, 240);
    
    // Добавляем подпись
    if (signatureData) {
      await addSignature(signatureData, 140, 230, 40, 15);
    }
    
    addText('Unterschrift des Versicherungsnehmers', 140, 250);
    
    // Сохраняем PDF в буфер
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    console.log('PDF успешно создан с помощью jsPDF');
    
    return pdfBuffer;
    
  } catch (error) {
    console.error(`Ошибка при создании PDF с jsPDF: ${error.message}`);
    throw error;
  }
}

// Функция для отправки данных администратору
async function sendDataToAdmin(formData, pdfPath, photoPath) {
  try {
    console.log('Отправка данных администратору:', config.adminChatId);
    
    // Получаем имя и фамилию пользователя и имя пользователя Telegram
    let userName = formData.fullName || 'Пользователь';
    let telegramUsername = formData.telegramUsername || '';

    // Формируем ссылку на пользователя в формате имя(имя клиента) с ссылкой на Telegram
    // Используем реальное имя клиента вместо шаблонного текста
    let userLinkText = `${userName}`;
    let userLink = '';
    
    if (telegramUsername && telegramUsername.trim() !== '') {
      // Убираем символ @ из имени пользователя, если он есть
      telegramUsername = telegramUsername.replace(/^@/, '');
      userLink = `${userLinkText}(https://t.me/${telegramUsername})`;
      
      // Отдельно добавляем username после основной ссылки
      userLink += ` - @${telegramUsername}`;
    } else if (formData.telegramChatId) {
      // Если нет имени пользователя, но есть ID чата, используем его
      userLink = `${userLinkText}(https://t.me/${formData.telegramChatId})`;
    } else {
      userLink = userLinkText;
    }
    
    // Формируем сообщение с данными для администратора
    let adminMessage = `*Новая заявка подана от ${userLink}*\n\n`;
    adminMessage += `*Данные:*\n\n`;
    
    // Добавляем данные пользователя с русскими названиями полей
    const fieldNames = {
      fullName: 'Имя и фамилия',
      birthSurname: 'Фамилия при рождении',
      birthDate: 'Дата рождения',
      hometown: 'Место рождения',
      insuranceAddress: 'Адрес',
      maritalStatus: 'Семейное положение',
      email: 'Email',
      phone: 'Телефон',
      telegramChatId: 'ID чата Telegram',
      telegramUsername: 'Имя пользователя Telegram'
    };
    
    // Добавляем все данные формы с форматированием для копирования
    Object.keys(formData).forEach(key => {
      if (formData[key] && key !== 'telegramUsername') { // Имя пользователя Telegram уже добавили в ссылку
        const fieldName = fieldNames[key] || key;
        adminMessage += `${fieldName}: \`${formData[key]}\`\n`;
      }
    });
    
    // Сначала отправляем фото, если оно есть
    if (photoPath && fs.existsSync(photoPath)) {
      console.log('Отправка фото администратору');
      await bot.telegram.sendPhoto(config.adminChatId, { source: fs.createReadStream(photoPath) });
    }
    
    // Отправляем сообщение с данными в формате Markdown для возможности копирования
    await bot.telegram.sendMessage(config.adminChatId, adminMessage, { parse_mode: 'Markdown' });
    
    // Отправляем заполненный PDF последним с явным указанием имени файла
    if (fs.existsSync(pdfPath)) {
      console.log('Отправка PDF администратору');
      await bot.telegram.sendDocument(config.adminChatId, { 
        source: fs.createReadStream(pdfPath),
        filename: path.basename(pdfPath)
      });
    }
    
    console.log('Данные успешно отправлены администратору');
  } catch (error) {
    console.error('Ошибка при отправке данных администратору:', error);
    throw error;
  }
}

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Путь к шаблону PDF: ${config.templatePdfPath}`);
  console.log(`Абсолютный путь к директории приложения: ${__dirname}`);
  
  // Проверка различных возможных мест расположения файла
  const possiblePaths = [
    config.templatePdfPath,
    path.join(__dirname, 'BIG_Vermittlervollmacht.pdf'),
    path.join(__dirname, '..', 'BIG_Vermittlervollmacht.pdf'),
    path.join(__dirname, '..', 'public', 'BIG_Vermittlervollmacht.pdf'),
    path.join(__dirname, 'public', 'BIG_Vermittlervollmacht.pdf'),
    './BIG_Vermittlervollmacht.pdf',
    '../BIG_Vermittlervollmacht.pdf',
    '/app/BIG_Vermittlervollmacht.pdf' // Для Heroku
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
    console.log(`Для Heroku рекомендуется использовать следующий путь: '/app/BIG_Vermittlervollmacht.pdf'`);
    console.log(`Это связано с тем, что в Heroku файлы обычно размещаются в директории /app`);
  } else {
    console.error('ОШИБКА: PDF файл BIG_Vermittlervollmacht.pdf не найден! Приложение не сможет функционировать без этого файла.');
    console.error('Пожалуйста, добавьте файл BIG_Vermittlervollmacht.pdf в одну из следующих директорий:');
    possiblePaths.forEach(path => console.error(`- ${path}`));
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