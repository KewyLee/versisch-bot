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

// Функция для заполнения PDF данными с оптимизированным кодом
async function fillPdfWithData(formData, signatureData) {
  try {
    console.log('Начало заполнения PDF данными по шаблону');
    console.log('Путь к шаблону PDF:', config.templatePdfPath);
    
    // Проверяем существование PDF шаблона
    if (!fs.existsSync(config.templatePdfPath)) {
      console.error(`Шаблон PDF не найден по пути: ${config.templatePdfPath}`);
      throw new Error(`Шаблон PDF не найден. Убедитесь, что файл BIG_Vermittlervollmacht.pdf добавлен в проект.`);
    }
    
    console.log('Шаблон PDF найден, приступаем к заполнению');
    
    // Загружаем шаблон PDF
    const pdfBytes = fs.readFileSync(config.templatePdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    if (pages.length === 0) {
      throw new Error('PDF документ не содержит страниц');
    }
    
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    console.log(`Размеры PDF: ширина=${width}, высота=${height}`);
    
    // Настраиваем шрифт и опции текста
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;
    const textOptions = { 
      size: fontSize,
      font: helveticaFont,
      color: rgb(0, 0, 0)
    };
    
    // Определяем координаты полей в зависимости от типа формы
    let fieldPositions;
    
    if (formData.isVollmachtForm) {
      // Координаты для формы доверенности BIG
      fieldPositions = {
        lastName: { x: 47, y: height - 211 },           // Фамилия
        firstName: { x: 141, y: height - 211 },         // Имя
        birthDate: { x: 283, y: height - 211 },         // Дата рождения
        birthSurname: { x: 141, y: height - 231 },      // Фамилия при рождении
        hometown: { x: 283, y: height - 231 },          // Место рождения
        street: { x: 47, y: height - 254 },             // Улица
        houseNumber: { x: 222, y: height - 254 },       // Номер дома
        zipCode: { x: 47, y: height - 274 },            // Индекс
        city: { x: 95, y: height - 274 },               // Город
        email: { x: 141, y: height - 293 },             // Email
        phone: { x: 300, y: height - 293 },             // Телефон
        ort: { x: 33, y: height - 403 },                // Место
        datum: { x: 200, y: height - 403 },             // Дата
        checkBox: { x: 33, y: height - 387 },           // Чекбокс
        signature: { x: 180, y: height - 403, width: 120, height: 40 } // Подпись
      };
    } else {
      // Координаты для стандартной формы
      fieldPositions = {
        fullName: { x: 123, y: height - 183 },          // Имя Фамилия
        birthSurname: { x: 123, y: height - 203 },      // Фамилия при рождении
        birthDate: { x: 266, y: height - 183 },         // Дата рождения
        hometown: { x: 307, y: height - 203 },          // Место рождения
        insuranceAddress: { x: 123, y: height - 225 },  // Адрес
        email: { x: 123, y: height - 265 },             // Email
        phone: { x: 307, y: height - 265 },             // Телефон
        signature: { x: 93, y: height - 412, width: 120, height: 45 } // Подпись
      };
    }
    
    // Сначала пытаемся использовать AcroForm поля если они есть
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    console.log(`Найдено ${fields.length} полей формы в PDF:`);
    
    // Выводим названия всех найденных полей для отладки
    fields.forEach(field => {
      console.log(`- Поле формы: ${field.getName()}, тип: ${field.constructor.name}`);
    });
    
    if (fields.length > 0) {
      console.log('Используем заполнение через AcroForm поля...');
      
      // Вспомогательные функции для заполнения полей формы
      const fillTextField = (fieldName, value) => {
        try {
          if (!value) return;
          const field = form.getTextField(fieldName);
          if (field) {
            field.setText(value);
            console.log(`Поле формы заполнено: ${fieldName} = ${value}`);
          }
        } catch (error) {
          console.warn(`Не удалось заполнить поле ${fieldName}: ${error.message}`);
        }
      };
      
      const fillCheckBox = (fieldName, checked) => {
        try {
          const field = form.getCheckBox(fieldName);
          if (field) {
            if (checked) field.check();
            else field.uncheck();
            console.log(`Чекбокс ${fieldName} установлен в ${checked}`);
          }
        } catch (error) {
          console.warn(`Не удалось заполнить чекбокс ${fieldName}: ${error.message}`);
        }
      };
      
      try {
        // Обрабатываем имя и фамилию
        if (formData.fullName) {
          const nameParts = formData.fullName.split(' ');
          if (nameParts.length > 1) {
            const lastName = nameParts[0];
            const firstName = nameParts.slice(1).join(' ');
            fillTextField('Name', lastName);
            fillTextField('Vorname', firstName);
          } else {
            fillTextField('Name', formData.fullName);
          }
        }
        
        // Заполняем основные поля
        fillTextField('Geburtsdatum', formData.birthDate);
        fillTextField('Geburtsname', formData.birthSurname);
        fillTextField('Geburtsort', formData.hometown);
        
        // Обработка адреса
        if (formData.insuranceAddress) {
          const addressMatch = formData.insuranceAddress.match(/^(.*?)(\d+[a-zA-Z]?),?\s*(\d+)\s*(.*)$/);
          if (addressMatch) {
            fillTextField('Strasse', addressMatch[1].trim());
            fillTextField('Hausnummer', addressMatch[2]);
            fillTextField('PLZ', addressMatch[3]);
            fillTextField('Ort', addressMatch[4]);
          } else {
            fillTextField('Strasse', formData.insuranceAddress);
          }
        }
        
        // Заполняем контактные данные
        fillTextField('Email', formData.email);
        fillTextField('Telefon', formData.phone);
        
        // Заполняем место и дату
        fillTextField('Ort_Unterschrift', formData.ort || 'Bergheim');
        fillTextField('Datum', formData.datum || new Date().toLocaleDateString('de-DE'));
        
        // Отмечаем чекбокс согласия
        fillCheckBox('Einwilligung', true);
        
        console.log('AcroForm поля успешно заполнены');
      } catch (formError) {
        console.warn(`Ошибка при заполнении AcroForm полей: ${formError.message}`);
        console.log('Переключаемся на заполнение по координатам...');
        
        // Если не удалось заполнить через AcroForm, используем координатный метод
        await fillPdfByCoordinates();
      }
    } else {
      console.log('AcroForm поля не найдены, используем заполнение по координатам...');
      await fillPdfByCoordinates();
    }
    
    // Функция для заполнения PDF по координатам
    async function fillPdfByCoordinates() {
      if (formData.isVollmachtForm) {
        // Обрабатываем имя и фамилию
        if (formData.fullName) {
          const nameParts = formData.fullName.split(' ');
          if (nameParts.length > 1) {
            const lastName = nameParts[0];
            const firstName = nameParts.slice(1).join(' ');
            firstPage.drawText(lastName, { x: fieldPositions.lastName.x, y: fieldPositions.lastName.y, ...textOptions });
            firstPage.drawText(firstName, { x: fieldPositions.firstName.x, y: fieldPositions.firstName.y, ...textOptions });
          } else {
            firstPage.drawText(formData.fullName, { x: fieldPositions.lastName.x, y: fieldPositions.lastName.y, ...textOptions });
          }
        }
        
        // Заполняем основные поля
        if (formData.birthDate) {
          firstPage.drawText(formData.birthDate, { x: fieldPositions.birthDate.x, y: fieldPositions.birthDate.y, ...textOptions });
        }
        if (formData.birthSurname) {
          firstPage.drawText(formData.birthSurname, { x: fieldPositions.birthSurname.x, y: fieldPositions.birthSurname.y, ...textOptions });
        }
        if (formData.hometown) {
          firstPage.drawText(formData.hometown, { x: fieldPositions.hometown.x, y: fieldPositions.hometown.y, ...textOptions });
        }
        
        // Обработка адреса
        if (formData.insuranceAddress) {
          const addressMatch = formData.insuranceAddress.match(/^(.*?)(\d+[a-zA-Z]?),?\s*(\d+)\s*(.*)$/);
          if (addressMatch) {
            firstPage.drawText(addressMatch[1].trim(), { x: fieldPositions.street.x, y: fieldPositions.street.y, ...textOptions });
            firstPage.drawText(addressMatch[2], { x: fieldPositions.houseNumber.x, y: fieldPositions.houseNumber.y, ...textOptions });
            firstPage.drawText(addressMatch[3], { x: fieldPositions.zipCode.x, y: fieldPositions.zipCode.y, ...textOptions });
            firstPage.drawText(addressMatch[4], { x: fieldPositions.city.x, y: fieldPositions.city.y, ...textOptions });
          } else {
            firstPage.drawText(formData.insuranceAddress, { x: fieldPositions.street.x, y: fieldPositions.street.y, ...textOptions });
          }
        }
        
        // Заполняем контактные данные
        if (formData.email) {
          firstPage.drawText(formData.email, { x: fieldPositions.email.x, y: fieldPositions.email.y, ...textOptions });
        }
        if (formData.phone) {
          firstPage.drawText(formData.phone, { x: fieldPositions.phone.x, y: fieldPositions.phone.y, ...textOptions });
        }
        
        // Заполняем место и дату
        firstPage.drawText(formData.ort || 'Bergheim', { x: fieldPositions.ort.x, y: fieldPositions.ort.y, ...textOptions });
        firstPage.drawText(formData.datum || new Date().toLocaleDateString('de-DE'), { x: fieldPositions.datum.x, y: fieldPositions.datum.y, ...textOptions });
        
        // Ставим отметку в чекбоксе
        firstPage.drawText('X', {
          x: fieldPositions.checkBox.x, 
          y: fieldPositions.checkBox.y,
          size: 14,
          font: helveticaFont,
          color: rgb(0, 0, 0)
        });
      } else {
        // Заполняем поля для стандартной формы
        if (formData.fullName) {
          firstPage.drawText(formData.fullName, { x: fieldPositions.fullName.x, y: fieldPositions.fullName.y, ...textOptions });
        }
        if (formData.birthSurname) {
          firstPage.drawText(formData.birthSurname, { x: fieldPositions.birthSurname.x, y: fieldPositions.birthSurname.y, ...textOptions });
        }
        if (formData.birthDate) {
          firstPage.drawText(formData.birthDate, { x: fieldPositions.birthDate.x, y: fieldPositions.birthDate.y, ...textOptions });
        }
        if (formData.hometown) {
          firstPage.drawText(formData.hometown, { x: fieldPositions.hometown.x, y: fieldPositions.hometown.y, ...textOptions });
        }
        if (formData.insuranceAddress && formData.insuranceAddress.trim() !== '') {
          firstPage.drawText(formData.insuranceAddress, { x: fieldPositions.insuranceAddress.x, y: fieldPositions.insuranceAddress.y, ...textOptions });
        }
        if (formData.email) {
          firstPage.drawText(formData.email, { x: fieldPositions.email.x, y: fieldPositions.email.y, ...textOptions });
        }
        if (formData.phone) {
          firstPage.drawText(formData.phone, { x: fieldPositions.phone.x, y: fieldPositions.phone.y, ...textOptions });
        }
      }
    }
    
    // Добавляем подпись, если она есть
    if (signatureData) {
      try {
        console.log('Добавление подписи в PDF');
        const signatureBase64 = signatureData.replace(/^data:image\/png;base64,/, '');
        const signatureImageBytes = Buffer.from(signatureBase64, 'base64');
        const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
        
        // Получаем координаты подписи в зависимости от типа формы
        const sigPos = fieldPositions.signature;
        
        // Добавляем изображение подписи
        firstPage.drawImage(signatureImage, {
          x: sigPos.x,
          y: sigPos.y,
          width: sigPos.width,
          height: sigPos.height,
        });
        
        console.log('Подпись успешно добавлена в PDF');
      } catch (error) {
        console.warn(`Не удалось добавить подпись: ${error.message}`);
      }
    }
    
    // Если были AcroForm поля, сглаживаем их перед сохранением
    if (fields.length > 0) {
      form.flatten();
    }
    
    // Сохраняем результат
    console.log('Сохранение заполненного PDF');
    const pdfBuffer = await pdfDoc.save();
    return pdfBuffer;
    
  } catch (error) {
    console.error(`Ошибка при заполнении PDF: ${error.message}`);
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