import winston from 'winston';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const customFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(meta).length > 0 && meta.service === undefined) {
        msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'flux-ticket' },
    transports: [
        new winston.transports.File({ 
            filename: join(__dirname, '../../logs/error.log'), 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: join(__dirname, '../../logs/combined.log') 
        }),
    ],
});

// Development modunda console'a da yazdır
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            customFormat
        ),
    }));
} else {
    // Production'da da console'a yazdır (Render logs için)
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            customFormat
        ),
    }));
}

export default logger;
