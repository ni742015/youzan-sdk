# Youzan SDK

有赞SDK，包含token生成及管理功能（如token失效会自动刷新）以及消息中间件。


## Requirement

- NODE >= 4.3.0

## Installation

```
npm install yz-sdk
```

## Usage

### API使用示例
1. 基础示例

```js
const Api = require('yz-sdk')
const config = {
    client_id: 'XXXX',
    client_secret: 'XXXX',
    kdt_id: 'XXXX'
}

const api = new Api(config)

api.getAccessToken(console.log)

// 获取订单
api
	.invoke('youzan.trades.sold.get', {
		version: '4.0.0',
		data: { page_no: 1, page_size: 5, status: 'TRADE_SUCCESS' }
	})
	.then(res => {
		console.log('youzan.trades.sold.get', res)
	})
```

2. 多进程
当多进程时，token需要全局维护，以下为保存token的接口：

```js
const Api = require('yz-sdk')
const config = {
    client_id: 'XXXX',
    client_secret: 'XXXX',
    kdt_id: 'XXXX'
}

const api = new Api(config, async function () {
  // 传入一个获取全局token的方法
  var txt = await fs.readFile('access_token.txt', 'utf8');
  return JSON.parse(txt);
}, async function (token) {
  // 请将token存储到全局，跨进程、跨机器级别的全局，比如写到数据库、redis等
  // 这样才能在cluster模式及多机情况下使用，以下为写入到文件的示例
  await fs.writeFile('access_token.txt', JSON.stringify(token));
})

api.getAccessToken(console.log)
```

### Middleware使用示例

```
const {middleware} = require('yz-sdk')
middleware({...config, url_perfix: 'yzpush'}, async function (res, message) {
	console.log(res, message)
})
```

## Help

Email: 421225824@qq.com

## License

MIT