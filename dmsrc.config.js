// 直接从.env文件读取环境变量，解决换行问题
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function getSessData() {
    // 1. 优先读取 .env 文件
    try {
        const envPath = path.resolve(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const envFile = fs.readFileSync(envPath, 'utf8');
            const envVars = dotenv.parse(envFile);
            if (envVars.DMQ_BILIBILI_SESSDATA) {
                let sessData = envVars.DMQ_BILIBILI_SESSDATA.trim();
                if (sessData.includes('%')) {
                    sessData = decodeURIComponent(sessData);
                }
                console.log(`dmsrc.config: 从.env文件直接解析SESSDATA, 长度: ${sessData.length}, 前缀: ${sessData.substring(0, 10)}...`);
                return sessData;
            }
        }
    } catch (e) {
        console.error('dmsrc.config: 读取.env文件失败:', e.message);
    }
    // 2. 其次读取环境变量 SESSDATA
    if (process.env.SESSDATA && process.env.SESSDATA.length > 0) {
        console.log(`dmsrc.config: 使用环境变量SESSDATA, 长度: ${process.env.SESSDATA.length}`);
        return process.env.SESSDATA;
    }
    // 3. 最后读取 process.env.DMQ_BILIBILI_SESSDATA
    if (process.env.DMQ_BILIBILI_SESSDATA && process.env.DMQ_BILIBILI_SESSDATA.length > 0) {
        console.log(`dmsrc.config: 使用环境变量DMQ_BILIBILI_SESSDATA, 长度: ${process.env.DMQ_BILIBILI_SESSDATA.length}`);
        return process.env.DMQ_BILIBILI_SESSDATA;
    }
    // 都没有则返回空字符串
    console.warn('dmsrc.config: 未找到SESSDATA');
    return '';
}

const sessData = getSessData();

module.exports = {
    bilibili: {
        /**
         * Bilibili 弹幕源 WebSocket 端口
         */
        port: 8001,
        /**
         * 弹幕源 WebSocket 的 HTTP Basic Auth 认证，留空（null 或 undefined）可以关闭认证
         */
        basicAuth: 'testPassword',
        /**
         * Bilibili 弹幕连接协议，ws 代表使用 WebSocket 协议，tcp 代表使用 TCP 协议。
         * 协议实现在 https://github.com/simon300000/bilibili-live-ws/blob/master/src/index.ts
         */
        bilibiliProtocol: 'ws',
        /**
         * Bilibili 弹幕房间自动重连计划，使用 CRON 格式
         * 避免长时间弹幕连接没有正确返回数据
         * 留空（null）可以关闭自动重连
         */
        reconnectCron: '0 0 3 * * *',
        /**
         * Bilibili 登录SESSDATA，用于获取完整的用户信息
         * 从环境变量DMQ_BILIBILI_SESSDATA读取
         */
        sessData: sessData,
        logsDir: './data/logs/bilibili-dm'
    },
    douyu: {
        /**
         * Douyu 弹幕源 WebSocket 端口
         */
        port: 8002,
        /**
         * 弹幕源 WebSocket 的 HTTP Basic Auth 认证，留空（null 或 undefined）可以关闭认证
         */
        basicAuth: null,
        /**
         * Douyu 弹幕房间自动重连计划，使用 CRON 格式
         * 避免长时间弹幕连接没有正确返回数据
         * 留空（null）可以关闭自动重连
         */
        reconnectCron: '0 0 3 * * *',
        logsDir: './data/logs/douyu-dm'
    },
    local: {
        port: 8003,
        basicAuth: null,
        logsDir: './data/logs/local-dm'
    }
};
