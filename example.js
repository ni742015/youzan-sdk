// api
const Api = require('./index.js')
const config = {
    client_id: 'XXXX',
    client_secret: 'XXXX',
    kdt_id: 'XXXX'
}

const api = new Api(config)

api.getAccessToken(console.log)

api
	.invoke('youzan.trades.sold.get', {
		version: '4.0.0',
		data: { page_no: 1, page_size: 5, status: 'TRADE_SUCCESS' }
	})
	.then(res => {
		console.log('youzan.trades.sold.get', res)
	})


// middleware
const middleware = require('./middleware')
middleware({...config, url_perfix: 'yzpush'}, async function (res, message) {
	console.log(res, message)
})