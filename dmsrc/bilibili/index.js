const { Danmaku, BaseDanmakuWebSocketSource } = require('../common');
const BLiveClient = require('blivedmjs').BLiveClient.BLiveClient;
const BaseHandler = require('blivedmjs/src/handlers/base_handler.js');
const cron = require('node-cron');
const bilibiliConfig = require('../../dmsrc.config').bilibili;
const botConfig = require('../../bot.config');

const BATCH_RECONNECT_DELAY = 1000 * 10;

function delay(ms) {
    return new Promise((resolve) => setTimeout(() => resolve(), ms));
}

class DanmakuHandler extends BaseHandler {
    // 不处理系统通知消息
    _on_notice_msg(client, message) {
        // pass
    }
    // 只允许处理的command类型白名单
    static allowedCommands = [
        'DANMU_MSG',
        'SEND_GIFT',
        'GUARD_BUY',
        'SUPER_CHAT_MESSAGE',
        'INTERACT_WORD_V2',
        'LIKE_CLICK',
    ];

    // 总入口，白名单过滤，未处理类型不做任何输出
    handleCommand(command, client, message) {
        if (!DanmakuHandler.allowedCommands.includes(command)) {
            // 彻底静默，未处理类型不输出
            return;
        }
        const method = this[`_on_${command.toLowerCase()}`];
        if (typeof method === 'function') {
            method.call(this, client, message);
        }
    }
    constructor(source, roomId) {
        super();
        this.source = source;
        this.roomId = roomId;
    }

    on_client_start(client) {
        this.source.logger.debug(`[${this.roomId}] 客户端已启动`);
    }

    on_client_stop(client) {
        this.source.logger.debug(`[${this.roomId}] 客户端已停止`);
    }

    _on_heartbeat(client, message) {
        // 心跳包不处理
    }

    _on_danmaku(client, message) {
        try {
            // 移除冗长的原始弹幕消息日志
            // console.log("原始弹幕消息:", JSON.stringify(message, null, 2));

            const dmSenderUid = message.uid || 0;
            let dmSenderUsername = message.uname || '匿名用户';
            const dmSenderUrl = 'https://space.bilibili.com/' + dmSenderUid;
            const dmText = message.msg;
            const dmTimestamp = Math.floor(Date.now() / 1000);

            // 简化弹幕日志格式，只输出必要信息
            console.log(`弹幕: ${dmSenderUsername}: ${dmText}`);

            // 直接使用原始uid，不再用用户名哈希
            let enhancedUid = dmSenderUid;

            // 添加粉丝牌信息（如果有）
            let medalInfo = '';
            if (message.medal && message.medal.level > 0) {
                medalInfo = `[${message.medal.name}${message.medal.level}]`;
            }

            const danmaku = new Danmaku({
                sender: {
                    uid: enhancedUid,  // 只用真实UID，0就是0
                    username: dmSenderUsername,
                    url: dmSenderUrl,
                    medal: medalInfo
                },
                text: dmText,
                timestamp: dmTimestamp,
                roomId: this.roomId,
                type: 'danmaku'
            });
            this.source.sendDanmaku(danmaku);
        } catch (e) {
            this.source.logger.error(`Error processing bilibili danmaku for room ${this.roomId}: ${e.message}`, e);
        }
    }



    _on_gift(client, message) {
        try {
            const dmSenderUid = message.uid || message.userId || 0;
            let dmSenderUsername = message.uname || message.username || '匿名用户';
            const dmSenderUrl = 'https://space.bilibili.com/' + dmSenderUid;
            const dmText = `赠送 ${message.giftName}x${message.num} (${message.coinType === 'gold' ? '金瓜子' : '银瓜子'}x${message.totalCoin})`;
            const dmTimestamp = Math.floor(Date.now() / 1000);

            // 简化日志输出
            console.log(`礼物: ${dmSenderUsername} ${dmText}`);

            // 直接使用原始uid，不再用用户名哈希
            let enhancedUid = dmSenderUid;

            const danmaku = new Danmaku({
                sender: {
                    uid: enhancedUid,
                    username: dmSenderUsername,
                    url: dmSenderUrl
                },
                text: dmText,
                timestamp: dmTimestamp,
                roomId: this.roomId,
                type: 'gift'
            });
            this.source.sendDanmaku(danmaku);
        } catch (e) {
            this.source.logger.error(`Error processing bilibili gift for room ${this.roomId}: ${e.message}`, e);
        }
    }

    _on_buy_guard(client, message) {
        try {
            const guardLevelName = ['', '总督', '提督', '舰长'][message.guardLevel];
            const dmSenderUid = message.uid || message.userId;
            const dmSenderUsername = message.username;
            const dmSenderUrl = 'https://space.bilibili.com/' + dmSenderUid;
            const dmText = `开通了 ${guardLevelName}`;
            const dmTimestamp = Math.floor(Date.now() / 1000);

            // 简化日志输出
            console.log(`舰长: ${dmSenderUsername} ${dmText}`);

            const danmaku = new Danmaku({
                sender: {
                    uid: dmSenderUid,
                    username: dmSenderUsername,
                    url: dmSenderUrl
                },
                text: dmText,
                timestamp: dmTimestamp,
                roomId: this.roomId,
                type: 'guard'
            });
            this.source.sendDanmaku(danmaku);
        } catch (e) {
            this.source.logger.error(`Error processing bilibili guard for room ${this.roomId}: ${e.message}`, e);
        }
    }

    _on_super_chat(client, message) {
        try {
            const dmSenderUid = message.uid || 0;
            let dmSenderUsername = message.uname || '匿名用户';
            const dmSenderUrl = 'https://space.bilibili.com/' + dmSenderUid;
            const dmText = `醒目留言 ￥${message.price}: ${message.message}`;
            const dmTimestamp = Math.floor(Date.now() / 1000);

            // 简化日志输出
            console.log(`SC: ${dmSenderUsername} ￥${message.price}: ${message.message}`);

            // 对于无效用户ID进行处理
            let enhancedUid = dmSenderUid;

            const danmaku = new Danmaku({
                sender: {
                    uid: enhancedUid,
                    username: dmSenderUsername,
                    url: dmSenderUrl
                },
                text: dmText,
                timestamp: dmTimestamp,
                roomId: this.roomId,
                type: 'sc',
                price: message.price
            });
            this.source.sendDanmaku(danmaku);
        } catch (e) {
            this.source.logger.error(`Error processing bilibili super chat for room ${this.roomId}: ${e.message}`, e);
        }
    }

    _on_interact_word(client, message) {
        try {
            // 只处理进入直播间的消息
            if (message.msgType === 1) {
                const dmSenderUid = message.uid;
                const dmSenderUsername = message.uname;
                const dmSenderUrl = 'https://space.bilibili.com/' + dmSenderUid;
                
                // 添加粉丝牌信息（如果有）
                let medalInfo = '';
                if (message.fans_medal && message.fans_medal.medal_level > 0) {
                    medalInfo = `[${message.fans_medal.medal_name}${message.fans_medal.medal_level}]`;
                }
                
                const dmText = `进入直播间`;
                const dmTimestamp = Math.floor(Date.now() / 1000);

                // 简化日志输出 - 进入直播间的消息太多，完全不输出
                // console.log(`进入: ${dmSenderUsername} ${medalInfo}`);

                const danmaku = new Danmaku({
                    sender: {
                        uid: dmSenderUid,
                        username: dmSenderUsername,
                        url: dmSenderUrl,
                        medal: medalInfo
                    },
                    text: dmText,
                    timestamp: dmTimestamp,
                    roomId: this.roomId,
                    type: 'enter'
                });
                this.source.sendDanmaku(danmaku);
            }
        } catch (e) {
            this.source.logger.error(`Error processing bilibili interact for room ${this.roomId}: ${e.message}`, e);
        }
    }

    _on_like_click(client, message) {
        try {
            const dmSenderUid = message.uid;
            const dmSenderUsername = message.uname;
            const dmSenderUrl = 'https://space.bilibili.com/' + dmSenderUid;
            
            // 添加粉丝牌信息（如果有）
            let medalInfo = '';
            if (message.fans_medal && message.fans_medal.medal_level > 0) {
                medalInfo = `[${message.fans_medal.medal_name}${message.fans_medal.medal_level}]`;
            }
            
            const dmText = `为主播点赞了`;
            const dmTimestamp = Math.floor(Date.now() / 1000);

            // 简化日志输出 - 点赞消息太多，完全不输出
            // console.log(`点赞: ${dmSenderUsername}`);

            const danmaku = new Danmaku({
                sender: {
                    uid: dmSenderUid,
                    username: dmSenderUsername,
                    url: dmSenderUrl,
                    medal: medalInfo
                },
                text: dmText,
                timestamp: dmTimestamp,
                roomId: this.roomId,
                type: 'like'
            });
            this.source.sendDanmaku(danmaku);
        } catch (e) {
            this.source.logger.error(`Error processing bilibili like for room ${this.roomId}: ${e.message}`, e);
        }
    }


    
    // 处理系统消息，但不转发
/*     _on_sys_msg(client, message) {
        try {
            // 记录日志但不转发
            // this.source.logger.debug(`[${this.roomId}] 系统消息: ${message.msg || JSON.stringify(message)}`);
        } catch (e) {
            this.source.logger.error(`Error processing bilibili system message for room ${this.roomId}: ${e.message}`, e);
        }
    } */
}

class BilibiliDanmakuSource extends BaseDanmakuWebSocketSource {
    constructor(config) {
        super(config);
        this.liveList = {};
        this.bilibiliProtocol = config.bilibiliProtocol;
        
        // 精简SESSDATA调试日志
        console.log("初始化B站弹幕模块");
        
        // 使用直接从配置获取的SESSDATA
        let sessData = config.sessData || '';
        
        // 检查SESSDATA是否有效
        if (!sessData || sessData.length === 0) {
            console.log("警告: 配置中的SESSDATA为空");
            // 尝试直接从环境变量获取
            const envSessData = process.env.DMQ_BILIBILI_SESSDATA || '';
            if (envSessData && envSessData.length > 0) {
                console.log("使用环境变量中的SESSDATA");
                sessData = envSessData;
            } else {
                console.log("环境变量中也没有SESSDATA");
            }
        }
        
        // 解码SESSDATA（如果包含URL编码字符）
        if (sessData.includes('%')) {
            try {
                const decodedSessData = decodeURIComponent(sessData);
                sessData = decodedSessData;
            } catch (e) {
                console.error("解码SESSDATA失败:", e.message);
            }
        }

        this.sessData = sessData; // 保存处理后的SESSDATA
        
        // 日志记录SESSDATA状态（不显示具体值，保护隐私）
        if (this.sessData && this.sessData.length > 0) {
            this.logger.info('Bilibili Danmaku Source initialized with SESSDATA');
        } else {
            this.logger.warn('Bilibili Danmaku Source initialized WITHOUT SESSDATA - user information may be limited');
        }
        
        if (this.bilibiliProtocol !== 'ws' && this.bilibiliProtocol !== 'tcp') {
            this.logger.info('Bilibili Danmaku Source configuration didn\'t specify protocol type. Set to ws as default.');
            this.bilibiliProtocol = 'ws';
        }
        if (config.reconnectCron) {
            this.logger.info('Reconnect task schedule at "' + config.reconnectCron + '"');
            cron.schedule(config.reconnectCron, () => this.batchReconnect());
        }
    }

    isConnected(roomId) {
        const entity = this.liveList[roomId];
        // 需确保 client 已经启动且未断开，防止重复创建
        return entity && entity.live && entity.live._started && !entity.live._stopped;
    }

    createLive(roomId) {
        // 使用类中保存的sessData创建客户端
        console.log(`创建房间 ${roomId} 弹幕客户端`);
        
        try {
            // 创建liveOptions对象
            const liveOptions = { 
                sessData: this.sessData,
                platform: 'web'
            };
            
            // 创建客户端与处理器
            const live = new BLiveClient(roomId, liveOptions);
            const handler = new DanmakuHandler(this, roomId);
            
            // 设置处理器
            handler.on_client_start = (client) => {
                this.logger.debug(`Connected to live room: ${roomId}`);
                console.log(`房间 ${roomId} 客户端已启动`);
            };
            
            handler.on_client_stop = (client) => {
                this.logger.debug(`Disconnected from live room: ${roomId}`);
                console.log(`房间 ${roomId} 客户端已断开连接`);
                try {
                    // 触发重连逻辑（如果该房间仍在使用中）
                    this.onReconnect(roomId);
                } catch (e) {
                    this.logger.error(`on_client_stop trigger onReconnect failed for room ${roomId}: ${e && e.message}`);
                }
            };
            
            handler._on_error = (client, error) => {
                this.logger.error(`BilibiliDanmakuSource roomId=${roomId} error:`, error);
                console.error(`房间 ${roomId} 客户端错误:`, error);
                try {
                    // 出错时也尝试触发重连，交由指数退避处理
                    this.onReconnect(roomId);
                } catch (e) {
                    this.logger.error(`_on_error trigger onReconnect failed for room ${roomId}: ${e && e.message}`);
                }
            };
            
            live.set_handler(handler);
            live.start();
            
            return live;
        } catch (err) {
            console.error(`创建房间 ${roomId} 弹幕客户端出错:`, err);
            this.logger.error(`创建房间 ${roomId} 弹幕客户端出错:`, err);
            throw err;
        }
    }

    onJoin(roomId) {
        super.onJoin(roomId);
        if (this.isConnected(roomId)) {
            this.logger.debug(`[onJoin] 房间${roomId}已存在client，跳过创建`);
            this.liveList[roomId].counter++;
            return;
        }
        try {
            this.logger.debug(`[onJoin] 创建房间${roomId} client`);
            this.liveList[roomId] = {
                live: this.createLive(roomId),
                counter: 1
            };
        } catch (e) {
            this.logger.error(e);
        }
    }

    onLeave(roomId) {
        super.onLeave(roomId);
        if (!this.isConnected(roomId)) {
            return;
        }
        try {
            const entity = this.liveList[roomId];
            entity.counter--;
            if (entity.counter <= 0) {
                this.logger.debug(`Room ${roomId} is no longer used. Close now.`);
                entity.live.stop();
                delete this.liveList[roomId];
            }
        } catch (e) {
            this.logger.error(e);
        }
    }

    // 更优的断网重连机制：每个房间独立指数退避重连
    reconnectIntervals = {};
    reconnectTimers = {};

    onReconnect(roomId) {
        super.onReconnect(roomId);
        if (!this.liveList[roomId]) return;
        // 避免重复重连
        if (this.reconnectTimers[roomId]) return;
        this.tryReconnect(roomId);
    }

    tryReconnect(roomId) {
        const maxDelay = 60000; // 最大60秒
        if (!this.reconnectIntervals[roomId]) this.reconnectIntervals[roomId] = 1000;
        const delayMs = this.reconnectIntervals[roomId];
        // 检查是否已连接
        if (this.isConnected(roomId)) {
            this.reconnectIntervals[roomId] = 1000; // 重置
            if (this.reconnectTimers[roomId]) {
                clearTimeout(this.reconnectTimers[roomId]);
                delete this.reconnectTimers[roomId];
            }
            return;
        }
        this.logger.warn(`房间${roomId}断开，${delayMs/1000}s后重连`);
        this.reconnectTimers[roomId] = setTimeout(async () => {
            try {
                if (this.liveList[roomId] && this.liveList[roomId].live) {
                    this.liveList[roomId].live.stop();
                }
                this.liveList[roomId].live = this.createLive(roomId);
                this.reconnectIntervals[roomId] = 1000; // 重连成功重置
                clearTimeout(this.reconnectTimers[roomId]);
                delete this.reconnectTimers[roomId];
                this.logger.info(`房间${roomId}重连成功`);
            } catch (e) {
                this.logger.error(`重连房间${roomId}失败: ${e.message}`);
                // 指数退避
                this.reconnectIntervals[roomId] = Math.min(delayMs * 2, maxDelay);
                this.tryReconnect(roomId);
            }
        }, delayMs);
    }

    // 批量重连时直接触发所有房间的独立重连
    batchReconnect = async () => {
        this.logger.debug('Start batch reconnect task');
        for (let roomId of Object.keys(this.liveList)) {
            this.onReconnect(Number(roomId));
        }
    }
}

const roomId = process.argv[2];
// 统一服务模式
const src = new BilibiliDanmakuSource(bilibiliConfig);
src.listen();
src.logger.info('Bilibili Danmaku Source Server is listening at port ' + src.port);
