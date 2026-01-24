import winston from 'winston';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Logs klasörünü oluştur
const logsDir = join(__dirname, '../../logs');
if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
}

// Custom format
const customFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Meta bilgileri ekle
    if (Object.keys(meta).length > 0 && meta.service === undefined) {
        msg += ` ${JSON.stringify(meta)}`;
    }
    
    return msg;
});

// Logger oluştur
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat()
    ),
    defaultMeta: { service: 'flux-ticket' },
    transports: [
        // Error logları
        new winston.transports.File({ 
            filename: join(logsDir, 'error.log'), 
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Tüm loglar
        new winston.transports.File({ 
            filename: join(logsDir, 'combined.log'),
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});

// Development/Production modunda console'a yazdır
if (process.env.NODE_ENV !== 'test') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            customFormat
        ),
    }));
}

// Unhandled rejection ve exception logging
logger.exceptions.handle(
    new winston.transports.File({ 
        filename: join(logsDir, 'exceptions.log'),
        maxsize: 5242880,
        maxFiles: 3,
    })
);

logger.rejections.handle(
    new winston.transports.File({ 
        filename: join(logsDir, 'rejections.log'),
        maxsize: 5242880,
        maxFiles: 3,
    })
);

export default logger;
