// 本文件用于wechat API，基础文件，主要用于Token的处理和mixin机制
var urllib = require('urllib')
var extend = require('util')._extend
var middleware = require('./middleware')

var AccessToken = function(accessToken, expireTime) {
	if (!(this instanceof AccessToken)) {
		return new AccessToken(accessToken, expireTime)
	}
	this.accessToken = accessToken
	this.expireTime = expireTime
}

/*!
 * 检查AccessToken是否有效，检查规则为当前时间和过期时间进行对比
 */
var validToken = function(token) {
	return (
		!!token && !!token.accessToken && new Date().getTime() < token.expireTime
	)
}

/**
 * 根据client_id、client_secret和kdt_id创建API的构造函数
 */

var API = function({ client_id, client_secret, kdt_id }, getToken, saveToken) {
	this.client_id = client_id
	this.client_secret = client_secret
	this.kdt_id = kdt_id
	this.getToken =
		getToken ||
		function() {
			var token = this.store
			return validToken(token) && token
		}
	this.saveToken =
		saveToken ||
		function(token) {
			this.store = token
			if (process.env.NODE_ENV === 'production') {
				console.warn(
					'Don\'t save token in memory, when cluster or multi-computer!'
				)
			}
			return token
		}
	this.prefix = 'https://open.youzan.com/'
	this.defaults = {}
}

/**
 * 用于设置urllib的默认options
 *
 * Examples:
 * ```
 * api.setOpts({timeout: 15000});
 * ```
 * @param {Object} opts 默认选项
 */
API.prototype.setOpts = function(opts) {
	this.defaults = opts
}

/**
 * 设置urllib的hook
 *
 * Examples:
 * ```
 * api.setHook(function (options) {
 *   // options
 * });
 * ```
 * @param {Function} beforeRequest 需要封装的方法
 */
API.prototype.request = function(url, opts = {}) {
	var options = {}
	extend(options, this.defaults)
	for (var key in opts) {
		if (key !== 'headers') {
			options[key] = opts[key]
		} else {
			if (opts.headers) {
				options.headers = options.headers || {}
				extend(options.headers, opts.headers)
			}
		}
	}
	return urllib.request(url, options)
}

/*!
 * 根据创建API时传入的账号获取access token
 */
API.prototype.getAccessToken = async function(ifForce) {
	var token = await this.getToken()
	if(!token || ifForce) {
		var url =
			this.prefix +
			'oauth/token?grant_type=silent&client_id=' +
			this.client_id +
			'&client_secret=' +
			this.client_secret +
			'&kdt_id=' +
			this.kdt_id

		var data = await this.request(url, { dataType: 'json' }).then(res => res.data)

		// 过期时间，因网络延迟等，将实际过期时间提前10秒，以防止临界点
		var expireTime = new Date().getTime() + (data.expires_in - 10) * 1000
		token = this.saveToken(AccessToken(data.access_token, expireTime))
	}
	return token
}

/*!
 * 根据创建API时传入的账号获取access token
 */
API.prototype.refreshToken = function() {
	return this.getAccessToken(true).then(token => this.saveToken(token))
}

/**
 * 获取最新的token
 *
 * Examples:
 * ```
 * api.getLatestToken(callback);
 * ```
 * Callback:
 *
 * - `err`, 获取access token出现异常时的异常对象
 * - `token`, 获取的token
 *
 * @param {Function} method 需要封装的方法
 * @param {Array} args 方法需要的参数
 */
API.prototype.invoke = async function(apiName, opt = {}) {
	var {version = '3.0.0', dataType = 'json'} = opt
	var args = arguments
	var url = this.prefix
	var service = apiName.substring(0, apiName.lastIndexOf('.'))
	var action = apiName.substring(apiName.lastIndexOf('.') + 1, apiName.length)
	var token = await this.getAccessToken()

	url +=
		'api/oauthentry/' +
		service +
		'/' +
		version +
		'/' +
		action +
		'?access_token='
		+ token.accessToken

	console.log('url, data', url, opt.data)
	return this.request(url, extend({dataType}, opt)).then(res => {
		var data = res.data
		var {error_response} = data
	
		// 无效token重试
		if(error_response) {
			if ([40009, 40010].indexOf(error_response.code) >= 0) {
				// console.log('error_response', data.error_response.code);
				return this.refreshToken().then(() => this.invoke(...args))
			} else {
				throw new Error(`yzsdk invoke error: ${error_response.code} - ${error_response.msg}`)
			}
		}

		return data.response || data.error_response
	}).catch(console.warn)
}

/**
 * 用于支持对象合并。将对象合并到API.prototype上，使得能够支持扩展
 * Examples:
 * ```
 * // 媒体管理（上传、下载）
 * API.mixin(require('./lib/api_media'));
 * ```
 * @param {Object} obj 要合并的对象
 */
API.mixin = function(obj) {
	for (var key in obj) {
		if (API.prototype.hasOwnProperty(key)) {
			throw new Error(
				'Don\'t allow override existed prototype method. method: ' + key
			)
		}
		API.prototype[key] = obj[key]
	}
}

API.AccessToken = AccessToken
API.middleware = middleware

module.exports = API
