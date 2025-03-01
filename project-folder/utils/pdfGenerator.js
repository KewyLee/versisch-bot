/**
 * pdfGenerator.js
 * 
 * Модуль для генерации PDF-документов с использованием jsPDF.
 * Содержит функции для создания различных типов PDF форм,
 * добавления текста, изображений и других элементов в документы.
 * 
 * @author Versisch Bot Team
 * @version 1.0.0
 */

const { jsPDF } = require('jspdf');
require('jspdf-autotable'); // Подключаем дополнение для работы с таблицами
const fs = require('fs');
const path = require('path');

/**
 * Создает PDF-документ на основе данных формы и изображения подписи
 * @param {Object} formData - Данные формы от пользователя
 * @param {string} signatureData - Base64-строка с изображением подписи
 * @returns {Buffer} - Буфер с содержимым PDF-документа
 */
async function generatePdfFromData(formData, signatureData) {
  try {
    console.log('Начало создания PDF документа с использованием jsPDF');
    
    // Создаем новый PDF документ формата A4
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Добавляем заголовок документа
    doc.setFontSize(14);
    doc.text('Vollmacht für Vertriebspartner §34d GewO', 105, 20, { align: 'center' });
    doc.text('zurück an die BIG', 105, 27, { align: 'center' });
    
    // Добавляем разделы для данных
    addPersonalDataSection(doc, formData);
    addPartnerDataSection(doc);
    addAuthorizationSection(doc);
    addSignatureSection(doc, formData, signatureData);
    
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
 * Добавляет раздел с персональными данными клиента
 * @param {jsPDF} doc - Экземпляр PDF документа
 * @param {Object} formData - Данные формы от пользователя 
 */
function addPersonalDataSection(doc, formData) {
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
      
      addText(doc, 'Name:', 15, 50);
      addText(doc, lastName, 40, 50);
      
      addText(doc, 'Vorname:', 95, 50);
      addText(doc, firstName, 120, 50);
    } else {
      addText(doc, 'Name:', 15, 50);
      addText(doc, formData.fullName, 40, 50);
    }
  }
  
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
      addText(doc, 'Straße:', 15, 80);
      addText(doc, addressMatch[1].trim(), 40, 80);
      
      addText(doc, 'Hausnummer:', 95, 80);
      addText(doc, addressMatch[2], 135, 80);
      
      addText(doc, 'PLZ:', 15, 90);
      addText(doc, addressMatch[3], 40, 90);
      
      addText(doc, 'Ort:', 95, 90);
      addText(doc, addressMatch[4], 110, 90);
    } else {
      addText(doc, 'Adresse:', 15, 80);
      addText(doc, formData.insuranceAddress, 40, 80);
    }
  }
  
  addText(doc, 'Email:', 15, 100);
  addText(doc, formData.email || '', 40, 100);
  
  addText(doc, 'Telefon:', 95, 100);
  addText(doc, formData.phone || '', 125, 100);
}

/**
 * Добавляет раздел с данными партнера (предзаполненные)
 * @param {jsPDF} doc - Экземпляр PDF документа
 */
function addPartnerDataSection(doc) {
  // Раздел "Данные уполномоченного партнера по продажам"
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
 * Добавляет раздел с текстом доверенности
 * @param {jsPDF} doc - Экземпляр PDF документа
 */
function addAuthorizationSection(doc) {
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
  addCheckbox(doc, 15, 210, true);
  doc.text('Ich bin damit einverstanden, dass der o.g. Vertriebspartner meine Daten zum Zwecke der Antragsbearbeitung, Beratung sowie Vertragsverwaltung verarbeitet. Bei einem Widerruf der Vollmacht bearbeitet die BIG direkt leben in Zukunft sämtliche Anfragen und Mitteilungen zu dem Vertrag direkt mit mir.', 22, 212, { maxWidth: 170 });
}

/**
 * Добавляет раздел для подписи
 * @param {jsPDF} doc - Экземпляр PDF документа
 * @param {Object} formData - Данные формы от пользователя
 * @param {string} signatureData - Base64-строка с изображением подписи
 */
function addSignatureSection(doc, formData, signatureData) {
  // Место для подписи
  addText(doc, 'Ort:', 15, 240);
  addText(doc, formData.ort || 'Bergheim', 30, 240);
  
  addText(doc, 'Datum:', 75, 240);
  addText(doc, formData.datum || new Date().toLocaleDateString('de-DE'), 95, 240);
  
  // Добавляем подпись
  if (signatureData) {
    addSignature(doc, signatureData, 140, 230, 40, 15);
  }
  
  addText(doc, 'Unterschrift des Versicherungsnehmers', 140, 250);
}

/**
 * Вспомогательная функция для добавления текста
 * @param {jsPDF} doc - Экземпляр PDF документа
 * @param {string} text - Текст для добавления
 * @param {number} x - X-координата
 * @param {number} y - Y-координата
 * @param {Object} options - Дополнительные параметры
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
 * Добавляет чекбокс
 * @param {jsPDF} doc - Экземпляр PDF документа
 * @param {number} x - X-координата
 * @param {number} y - Y-координата
 * @param {boolean} checked - Отмечен ли чекбокс
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
 * Добавляет изображение подписи
 * @param {jsPDF} doc - Экземпляр PDF документа
 * @param {string} signatureData - Base64-строка с изображением подписи
 * @param {number} x - X-координата
 * @param {number} y - Y-координата
 * @param {number} width - Ширина изображения
 * @param {number} height - Высота изображения
 */
function addSignature(doc, signatureData, x, y, width, height) {
  if (!signatureData) return;
  
  try {
    const signatureBase64 = signatureData.replace(/^data:image\/png;base64,/, '');
    doc.addImage(signatureBase64, 'PNG', x, y, width, height);
    console.log('Подпись успешно добавлена в PDF');
  } catch (error) {
    console.warn(`Не удалось добавить подпись: ${error.message}`);
  }
}

module.exports = {
  generatePdfFromData
}; 