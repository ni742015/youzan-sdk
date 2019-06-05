'use strict';

var crypto = require('crypto');

module.exports = function (_ref, cb) {
	var client_id = _ref.client_id,
	    client_secret = _ref.client_secret,
	    _ref$url_perfix = _ref.url_perfix,
	    url_perfix = _ref$url_perfix === undefined ? 'yzpush' : _ref$url_perfix;

	return async function (ctx, next) {
		console.log('ctx.url', ctx.url, ctx.url.lastIndexOf(url_perfix));
		if (ctx.url.split('/').pop() === url_perfix) {
			// body结构
			// mode	number	1-自用型/工具型；0-签名模式消息
			// id	String	业务消息的标识: 如 订单消息为订单编号,会员卡消息为会员卡id标识
			// client_id	String	对应开发者后台的client_id
			// type	enum	消息业务类型：TRADE_ORDER_STATE-订单状态事件，TRADE_ORDER_REFUND-退款事件，TRADE_ORDER_EXPRESS-物流事件，ITEM_STATE-商品状态事件，ITEM_INFO-商品基础信息事件，POINTS-积分，SCRM_CARD-会员卡（商家侧），SCRM_CUSTOMER_CARD-会员卡（用户侧），TRADE-交易V1，ITEM-商品V1
			// status	String	消息状态，对应消息业务类型。如TRADE_ORDER_STATE-订单状态事件，对应有等待买家付款（WAIT_BUYER_PAY）、等待卖家发货（WAIT_SELLER_SEND_GOODS）等多种状态，详细可参考 消息结构里的描述
			// msg	String	经过UrlEncode（UTF-8）编码的消息对象，具体参数请看本页中各业务消息结构文档
			// kdt_id	number	店铺ID
			// sign	String	防伪签名 ：MD5(client_id+msg+client_secrect) ; MD5 方法可通过搜索引擎搜索得到或者可参考 MD5
			// version	long	一般为时间戳，由具体消息业务决定，不能只根据version判断消息唯一性
			// test	boolean	false-非测试消息，true- 测试消息 ；PUSH服务会定期通过发送测试消息检查开发者服务是否正常
			// send_count	number	重发的次数
			// msg_id	String	消息唯一标识，目前只有V3版消息会收到

			var _ctx$request$body = ctx.request.body,
			    test = _ctx$request$body.test,
			    mode = _ctx$request$body.mode,
			    msg = _ctx$request$body.msg,
			    sign = _ctx$request$body.sign;

			// 执行逻辑
			// 1. 判断消息是否测试  —> 解析 test
			// 2. 判断消息推送的模式 —> 解析 mode
			// 3. 判断消息是否伪造 —> 解析 sign
			// 4. 判断消息版本  —> 解析 version
			// 5. 判断消息的业务 —> 解析 type
			// 6. 处理消息体 —> 解码 msg ，反序列化消息结构体
			// 7. 返回接收成功标识 {"code":0,"msg":"success"}

			if (!(test || mode === 0)) {
				var md5 = crypto.createHash('md5');
				var msgSign = md5.update(client_id + msg + client_secret).digest('hex');
				if (sign === msgSign) {
					var message = decodeURI(msg);
					console.log('message', message);

					if (message.indexOf('{') === 0) {
						message = JSON.parse(message);
					}

					cb && (await cb(ctx.request.body, message));
				}
			}

			ctx.body = { code: 0, msg: 'success' };
			await next();
		} else {
			await next();
		}
	};
};