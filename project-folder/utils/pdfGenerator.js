/**
 * pdfGenerator.js
 * 
 * Модуль для заполнения PDF-форм данными пользователя.
 * Использует библиотеку pdf-lib для работы с существующим PDF-шаблоном.
 * 
 * @author Versisch Bot Team
 * @version 1.0.0
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

/**
 * Заполняет PDF-шаблон данными пользователя
 * @param {Object} formData - Данные формы от пользователя
 * @param {string} signatureData - Base64-строка с изображением подписи
 * @returns {Promise<Buffer>} - Промис с буфером заполненного PDF-документа
 */
async function generatePdfFromData(formData, signatureData) {
  try {
    console.log('Начало заполнения PDF-шаблона с использованием pdf-lib');
    
    // Путь к шаблону PDF
    const templatePath = process.env.PDF_TEMPLATE_PATH || 
                        path.join(__dirname, '..', 'BIG_Vermittlervollmacht.pdf');
    
    console.log(`Используется шаблон: ${templatePath}`);
    
    // Проверяем существование шаблона
    if (!fs.existsSync(templatePath)) {
      throw new Error(`PDF шаблон не найден по пути: ${templatePath}`);
    }
    
    // Чтение файла шаблона
    const templateBytes = fs.readFileSync(templatePath);
    
    // Загружаем PDF документ
    const pdfDoc = await PDFDocument.load(templateBytes);
    
    // Получаем поля формы
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    console.log(`PDF содержит ${fields.length} полей формы`);
    
    // Заполняем поля формы, если они есть
    if (fields.length > 0) {
      // Заполняем данные формы
      fillFormFields(form, formData);
    } else {
      // Если полей нет, добавляем данные как текст поверх PDF
      await addTextOverlay(pdfDoc, formData);
    }
    
    // Добавляем подпись, если она была предоставлена
    if (signatureData) {
      await addSignatureToDocument(pdfDoc, signatureData);
    }
    
    // Сохраняем изменения и получаем PDF в виде байтов
    const pdfBytes = await pdfDoc.save();
    
    console.log('PDF успешно заполнен с помощью pdf-lib');
    
    // Возвращаем буфер с PDF
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    console.error(`Ошибка при заполнении PDF с pdf-lib: ${error.message}`);
    throw error;
  }
}

/**
 * Заполняет поля формы данными
 * @param {PDFForm} form - Форма PDF документа
 * @param {Object} formData - Данные формы от пользователя
 */
function fillFormFields(form, formData) {
  // Логируем доступные поля для диагностики
  const fields = form.getFields();
  console.log('Доступные поля формы:');
  fields.forEach(field => {
    const name = field.getName();
    const type = field.constructor.name;
    console.log(`- ${name} (${type})`);
  });
  
  try {
    // Маппинг полей формы (необходимо адаптировать под конкретные имена полей в вашей форме)
    const formMapping = {
      // Персональные данные
      'Name': formData.fullName ? formData.fullName.split(' ')[0] : '',
      'Vorname': formData.fullName ? formData.fullName.split(' ').slice(1).join(' ') : '',
      'Geburtsdatum': formData.birthDate || '',
      'Geburtsname': formData.birthSurname || '',
      'Geburtsort': formData.hometown || '',
      
      // Адрес
      'Strasse': formData.insuranceAddress ? extractStreet(formData.insuranceAddress) : '',
      'Hausnummer': formData.insuranceAddress ? extractHouseNumber(formData.insuranceAddress) : '',
      'PLZ': formData.insuranceAddress ? extractZipCode(formData.insuranceAddress) : '',
      'Ort': formData.insuranceAddress ? extractCity(formData.insuranceAddress) : '',
      
      // Контактные данные
      'Email': formData.email || '',
      'Telefon': formData.phone || '',
      
      // Место и дата
      'Ort_Unterschrift': formData.ort || 'Bergheim',
      'Datum': formData.datum || new Date().toLocaleDateString('de-DE')
    };
    
    // Заполняем каждое поле
    Object.keys(formMapping).forEach(fieldName => {
      try {
        if (formMapping[fieldName] && fieldExists(form, fieldName)) {
          const field = form.getTextField(fieldName);
          field.setText(formMapping[fieldName]);
        }
      } catch (fieldError) {
        console.warn(`Не удалось заполнить поле ${fieldName}: ${fieldError.message}`);
      }
    });
    
    // Проверяем наличие чекбоксов и устанавливаем их
    try {
      if (fieldExists(form, 'Einverstaendnis')) {
        const checkbox = form.getCheckBox('Einverstaendnis');
        checkbox.check();
      }
    } catch (checkboxError) {
      console.warn(`Не удалось установить чекбокс: ${checkboxError.message}`);
    }
    
    // Сохраняем форму
    form.flatten();
    console.log('Поля формы успешно заполнены');
    
  } catch (error) {
    console.error(`Ошибка при заполнении полей формы: ${error.message}`);
    throw error;
  }
}

/**
 * Проверяет существование поля в форме
 * @param {PDFForm} form - Форма PDF документа
 * @param {string} fieldName - Имя поля для проверки
 * @returns {boolean} - true если поле существует
 */
function fieldExists(form, fieldName) {
  try {
    const fields = form.getFields();
    return fields.some(field => field.getName() === fieldName);
  } catch (error) {
    return false;
  }
}

/**
 * Добавляет текст поверх PDF, если форма не содержит полей
 * @param {PDFDocument} pdfDoc - PDF документ
 * @param {Object} formData - Данные формы от пользователя
 */
async function addTextOverlay(pdfDoc, formData) {
  try {
    // Загружаем шрифт
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Получаем первую страницу
    const page = pdfDoc.getPages()[0];
    
    // Размеры и позиции (необходимо адаптировать под конкретный PDF)
    const fontSize = 10;
    const lineHeight = fontSize * 1.5;
    let y = page.getHeight() - 150; // Начальная позиция Y
    
    // Добавляем персональные данные
    page.drawText('Persönliche Angaben des Versicherten:', {
      x: 50,
      y: y,
      size: fontSize + 2,
      font,
      color: rgb(0, 0, 0)
    });
    
    y -= lineHeight * 1.5;
    
    // Имя и фамилия
    if (formData.fullName) {
      const nameParts = formData.fullName.split(' ');
      const lastName = nameParts[0];
      const firstName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      page.drawText(`Name: ${lastName}`, {
        x: 50,
        y: y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0)
      });
      
      if (firstName) {
        page.drawText(`Vorname: ${firstName}`, {
          x: 250,
          y: y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0)
        });
      }
    }
    
    y -= lineHeight;
    
    // Дата рождения
    if (formData.birthDate) {
      page.drawText(`Geburtsdatum: ${formData.birthDate}`, {
        x: 50,
        y: y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0)
      });
    }
    
    // Фамилия при рождении
    if (formData.birthSurname) {
      page.drawText(`Geburtsname: ${formData.birthSurname}`, {
        x: 250,
        y: y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0)
      });
    }
    
    y -= lineHeight;
    
    // Место рождения
    if (formData.hometown) {
      page.drawText(`Geburtsort: ${formData.hometown}`, {
        x: 50,
        y: y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0)
      });
    }
    
    y -= lineHeight;
    
    // Адрес
    if (formData.insuranceAddress) {
      const addressParts = formData.insuranceAddress.split(',');
      
      if (addressParts.length > 1) {
        page.drawText(`Straße: ${addressParts[0]}`, {
          x: 50,
          y: y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0)
        });
        
        y -= lineHeight;
        
        page.drawText(`Ort: ${addressParts[1].trim()}`, {
          x: 50,
          y: y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0)
        });
      } else {
        page.drawText(`Adresse: ${formData.insuranceAddress}`, {
          x: 50,
          y: y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0)
        });
      }
    }
    
    y -= lineHeight;
    
    // Email и телефон
    if (formData.email) {
      page.drawText(`Email: ${formData.email}`, {
        x: 50,
        y: y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0)
      });
    }
    
    if (formData.phone) {
      page.drawText(`Telefon: ${formData.phone}`, {
        x: 250,
        y: y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0)
      });
    }
    
    // Добавляем место и дату в нижней части
    y = 100;
    
    page.drawText(`Ort: ${formData.ort || 'Bergheim'}`, {
      x: 50,
      y: y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0)
    });
    
    page.drawText(`Datum: ${formData.datum || new Date().toLocaleDateString('de-DE')}`, {
      x: 250,
      y: y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0)
    });
    
    console.log('Текст успешно добавлен поверх PDF');
  } catch (error) {
    console.error(`Ошибка при добавлении текста: ${error.message}`);
    throw error;
  }
}

/**
 * Добавляет подпись в документ
 * @param {PDFDocument} pdfDoc - PDF документ
 * @param {string} signatureData - Base64-строка с изображением подписи
 */
async function addSignatureToDocument(pdfDoc, signatureData) {
  try {
    // Удаляем префикс Data URL, если он есть
    const base64Data = signatureData.replace(/^data:image\/png;base64,/, '');
    
    // Преобразуем Base64 в Uint8Array
    const signatureBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Загружаем изображение подписи
    const signatureImage = await pdfDoc.embedPng(signatureBytes);
    
    // Получаем размеры изображения
    const signatureDims = signatureImage.scale(0.3); // Масштабируем изображение
    
    // Получаем первую страницу
    const page = pdfDoc.getPages()[0];
    
    // Добавляем подпись в правом нижнем углу
    page.drawImage(signatureImage, {
      x: page.getWidth() - signatureDims.width - 50,
      y: 100 - signatureDims.height / 2,
      width: signatureDims.width,
      height: signatureDims.height
    });
    
    console.log('Подпись успешно добавлена в PDF');
  } catch (error) {
    console.warn(`Не удалось добавить подпись: ${error.message}`);
    // Не прерываем выполнение при ошибке с подписью
  }
}

/**
 * Извлекает улицу из адреса
 * @param {string} address - Полный адрес
 * @returns {string} - Название улицы
 */
function extractStreet(address) {
  const match = address.match(/^(.*?)(\d+[a-zA-Z]?),?\s*(\d+)\s*(.*)$/);
  return match ? match[1].trim() : address;
}

/**
 * Извлекает номер дома из адреса
 * @param {string} address - Полный адрес
 * @returns {string} - Номер дома
 */
function extractHouseNumber(address) {
  const match = address.match(/^(.*?)(\d+[a-zA-Z]?),?\s*(\d+)\s*(.*)$/);
  return match ? match[2] : '';
}

/**
 * Извлекает почтовый индекс из адреса
 * @param {string} address - Полный адрес
 * @returns {string} - Почтовый индекс
 */
function extractZipCode(address) {
  const match = address.match(/^(.*?)(\d+[a-zA-Z]?),?\s*(\d+)\s*(.*)$/);
  return match ? match[3] : '';
}

/**
 * Извлекает город из адреса
 * @param {string} address - Полный адрес
 * @returns {string} - Название города
 */
function extractCity(address) {
  const match = address.match(/^(.*?)(\d+[a-zA-Z]?),?\s*(\d+)\s*(.*)$/);
  return match ? match[4] : '';
}

module.exports = {
  generatePdfFromData
}; 