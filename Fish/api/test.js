// api/test.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8719063394:AAElsz2JI_Z7pBepZpZ20JNeDzr9F4v5Iic';
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8312652652';

    try {
        const axios = require('axios');
        
        // Проверяем бота
        const botInfo = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe`);
        
        // Отправляем тестовое сообщение
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: `🧪 Vercel сервер работает!\nВремя: ${new Date().toLocaleString('ru-RU')}`
        });

        return res.status(200).json({
            success: true,
            bot: botInfo.data.result,
            message: 'Тестовое сообщение отправлено'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
}