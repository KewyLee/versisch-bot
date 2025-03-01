/**
 * PDF Generator Module
 * 
 * Этот модуль отвечает за создание и заполнение PDF-документов
 * с использованием библиотеки jsPDF. Он предоставляет необходимые функции
 * для генерации документов на основе данных пользователя.
 */

const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
require('jspdf-autotable'); // Подключаем дополнение для работы с таблицами

/**
 * Создает PDF-документ с данными пользователя
 * 
 * @param {Object} formData - Данные формы заполненные пользователем
 * @param {string} signatureData - Base64-данные подписи пользователя
 * @returns {Buffer} - Буфер с созданным PDF-документом
 */
async function fillPdfWithData(formData, signatureData) {
  try {
    console.log('Начало создания PDF документа с использованием jsPDF');
    
    // Создаем новый PDF документ формата A4
    const doc = new jsPDF({
      orientation: 'portrait', // Ориентация: портрет
      unit: 'mm',              // Единицы измерения: миллиметры
      format: 'a4'             // Формат страницы: A4
    });
    
    // Добавляем контент в документ
    addDocumentContent(doc, formData, signatureData);
    
    // Сохраняем PDF в буфер
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    console.log('PDF успешно создан с помощью jsPDF');
    
    return pdfBuffer;
    
  } catch (error) {
    console.error(`Ошибка при создании PDF с jsPDF: ${error.message}`);
    throw error;
  }
}

/**
 * Добавляет содержимое в PDF-документ
 * 
 * @param {jsPDF} doc - Экземпляр jsPDF документа
 * @param {Object} formData - Данные формы
 * @param {string} signatureData - Base64-данные подписи
 */
function addDocumentContent(doc, formData, signatureData) {
  // Добавляем заголовок документа
  doc.setFontSize(14);
  doc.text('Vollmacht für Vertriebspartner §34d GewO', 105, 20, { align: 'center' });
  doc.text('zurück an die BIG', 105, 27, { align: 'center' });
  
  // Секция 1: Личные данные застрахованного
  addPersonalDataSection(doc, formData);
  
  // Секция 2: Данные уполномоченного партнера
  addPartnerDataSection(doc);
  
  // Секция 3: Информация о доверенности
  addAuthorizationSection(doc);
  
  // Секция 4: Подпись и информация о месте/дате
  addSignatureSection(doc, formData, signatureData);
}

/**
 * Добавляет секцию с личными данными застрахованного
 * 
 * @param {jsPDF} doc - Экземпляр jsPDF документа
 * @param {Object} formData - Данные формы
 */
function addPersonalDataSection(doc, formData) {
  // Заголовок секции
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
      
      addText(doc, 'Name:', 15, 50);
      addText(doc, lastName, 40, 50);
      
      addText(doc, 'Vorname:', 95, 50);
      addText(doc, firstName, 120, 50);
    } else {
      addText(doc, 'Name:', 15, 50);
      addText(doc, formData.fullName, 40, 50);
    }
  }
  
  // Дата рождения, фамилия при рождении, место рождения
  addText(doc, 'Geburtsdatum:', 15, 60);
  addText(doc, formData.birthDate || '', 50, 60);
  
  addText(doc, 'Geburtsname:', 95, 60);
  addText(doc, formData.birthSurname || '', 135, 60);
  
  addText(doc, 'Geburtsort:', 15, 70);
  addText(doc, formData.hometown || '', 50, 70);
  
  // Обработка адреса
  if (formData.insuranceAddress) {
    const addressMatch = formData.insuranceAddress.match(/^(.*?)(\d+[a-zA-Z]?),?\s*(\d+)\s*(.*)$/);
    
    if (addressMatch) {
      // Если адрес удалось разбить на составляющие (улица, дом, индекс, город)
      addText(doc, 'Straße:', 15, 80);
      addText(doc, addressMatch[1].trim(), 40, 80);
      
      addText(doc, 'Hausnummer:', 95, 80);
      addText(doc, addressMatch[2], 135, 80);
      
      addText(doc, 'PLZ:', 15, 90);
      addText(doc, addressMatch[3], 40, 90);
      
      addText(doc, 'Ort:', 95, 90);
      addText(doc, addressMatch[4], 110, 90);
    } else {
      // Если адрес не удалось разбить, отображаем его целиком
      addText(doc, 'Adresse:', 15, 80);
      addText(doc, formData.insuranceAddress, 40, 80);
    }
  }
  
  // Контактные данные
  addText(doc, 'Email:', 15, 100);
  addText(doc, formData.email || '', 40, 100);
  
  addText(doc, 'Telefon:', 95, 100);
  addText(doc, formData.phone || '', 125, 100);
}

/**
 * Добавляет секцию с данными уполномоченного партнера
 * 
 * @param {jsPDF} doc - Экземпляр jsPDF документа
 */
function addPartnerDataSection(doc) {
  // Заголовок секции
  doc.setFontSize(12);
  doc.text('Persönliche Angaben des bevollmächtigten Vertriebspartners nach §34d GewO', 15, 120);
  
  // Линия под заголовком
  doc.line(15, 123, 195, 123);
  
  // Данные партнера (предзаполненные)
  addText(doc, 'Name:', 15, 130);
  addText(doc, 'Bergheim', 40, 130);
  
  addText(doc, 'Vorname:', 95, 130);
  addText(doc, 'Elmar', 125, 130);
  
  addText(doc, 'Firmenname:', 15, 140);
  addText(doc, 'Bergheim Versicherungsmakler GmbH', 50, 140);
  
  addText(doc, 'Straße:', 15, 150);
  addText(doc, 'Kreuzstr.', 40, 150);
  
  addText(doc, 'Hausnummer:', 95, 150);
  addText(doc, '19', 135, 150);
  
  addText(doc, 'PLZ:', 15, 160);
  addText(doc, '50189', 40, 160);
  
  addText(doc, 'Ort:', 95, 160);
  addText(doc, 'Elsdorf', 110, 160);
}

/**
 * Добавляет секцию с информацией о доверенности
 * 
 * @param {jsPDF} doc - Экземпляр jsPDF документа
 */
function addAuthorizationSection(doc) {
  // Заголовок секции
  doc.setFontSize(12);
  doc.text('Bevollmächtigung', 15, 180);
  
  // Линия под заголовком
  doc.line(15, 183, 195, 183);
  
  // Текст доверенности
  doc.setFontSize(10);
  const authorizationText = 'Hiermit bevollmächtige ich die o.g. Vertriebspartner der BIG direkt leben die für mich bestehenden Verträge bei der BIG direkt leben namens und im Auftrag für mich zu verwalten. Die Vollmacht für den Vertriebspartner kann jederzeit ohne Angabe von Gründen durch den Versicherungsnehmer widerrufen werden.';
  doc.text(authorizationText, 15, 190, { maxWidth: 180 });
  
  // Чекбокс согласия
  addCheckbox(doc, 15, 210, true);
  doc.text('Ich bin damit einverstanden, dass der o.g. Vertriebspartner meine Daten zum Zwecke der Antragsbearbeitung, Beratung sowie Vertragsverwaltung verarbeitet. Bei einem Widerruf der Vollmacht bearbeitet die BIG direkt leben in Zukunft sämtliche Anfragen und Mitteilungen zu dem Vertrag direkt mit mir.', 22, 212, { maxWidth: 170 });
}

/**
 * Добавляет секцию с подписью и информацией о месте/дате
 * 
 * @param {jsPDF} doc - Экземпляр jsPDF документа
 * @param {Object} formData - Данные формы
 * @param {string} signatureData - Base64-данные подписи
 */
function addSignatureSection(doc, formData, signatureData) {
  // Место и дата
  addText(doc, 'Ort:', 15, 240);
  addText(doc, formData.ort || 'Bergheim', 30, 240);
  
  addText(doc, 'Datum:', 75, 240);
  addText(doc, formData.datum || new Date().toLocaleDateString('de-DE'), 95, 240);
  
  // Добавляем подпись
  if (signatureData) {
    addSignatureImage(doc, signatureData, 140, 230, 40, 15);
  }
  
  addText(doc, 'Unterschrift des Versicherungsnehmers', 140, 250);
}

/**
 * Вспомогательная функция для добавления текста в PDF
 * 
 * @param {jsPDF} doc - Экземпляр jsPDF документа
 * @param {string} text - Текст для отображения
 * @param {number} x - Координата X
 * @param {number} y - Координата Y
 * @param {Object} options - Настройки текста
 */
function addText(doc, text, x, y, options = {}) {
  if (!text) return;
  
  const defaultOptions = {
    fontSize: 10,
    align: 'left'
  };
  
  const finalOptions = { ...defaultOptions, ...options };
  
  doc.setFontSize(finalOptions.fontSize);
  doc.text(text, x, y, { align: finalOptions.align });
}

/**
 * Вспомогательная функция для добавления чекбокса в PDF
 * 
 * @param {jsPDF} doc - Экземпляр jsPDF документа
 * @param {number} x - Координата X
 * @param {number} y - Координата Y
 * @param {boolean} checked - Состояние чекбокса (отмечен/не отмечен)
 * @param {number} size - Размер чекбокса
 */
function addCheckbox(doc, x, y, checked = true, size = 4) {
  doc.rect(x, y, size, size);
  if (checked) {
    doc.line(x, y, x + size, y + size);
    doc.line(x + size, y, x, y + size);
  }
}

/**
 * Вспомогательная функция для добавления изображения подписи
 * 
 * @param {jsPDF} doc - Экземпляр jsPDF документа
 * @param {string} signatureData - Base64-данные подписи
 * @param {number} x - Координата X
 * @param {number} y - Координата Y
 * @param {number} width - Ширина изображения
 * @param {number} height - Высота изображения
 */
function addSignatureImage(doc, signatureData, x, y, width, height) {
  try {
    const signatureBase64 = signatureData.replace(/^data:image\/png;base64,/, '');
    doc.addImage(signatureBase64, 'PNG', x, y, width, height);
    console.log('Подпись успешно добавлена в PDF');
  } catch (error) {
    console.warn(`Не удалось добавить подпись: ${error.message}`);
  }
}

// Экспортируем функции модуля
module.exports = {
  fillPdfWithData
}; 