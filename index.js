'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// 本文件用于wechat API，基础文件，主要用于Token的处理和mixin机制
// var urllib = require('urllib')
var axios = require('axios');
var extend = require('util')._extend;
var middleware = require('./middleware');

var AccessToken = function AccessToken(accessToken, expireTime, others) {
  if (!(this instanceof AccessToken)) {
    return new AccessToken(accessToken, expireTime, others);
  }
  this.accessToken = accessToken;
  this.expireTime = expireTime;
  Object.assign(this, others);
};

/*!
 * 检查AccessToken是否有效，检查规则为当前时间和过期时间进行对比
 */
var validToken = function validToken(token) {
  return !!token && !!token.accessToken && new Date().getTime() < token.expireTime;
};

/**
 * 根据client_id、client_secret和kdt_id创建API的构造函数
 */

var API = function API(_ref, getToken, saveToken) {
  var client_id = _ref.client_id,
      client_secret = _ref.client_secret,
      authorize_type = _ref.authorize_type,
      payload = _ref.payload,
      tokenUrl = _ref.tokenUrl;

  this.client_id = client_id;
  this.client_secret = client_secret;
  this.tokenUrl = tokenUrl;
  this.authorize_type = authorize_type;
  this.payload = payload;

  this.getToken = getToken || function () {
    var token = this.store;
    return validToken(token) && token;
  };
  this.saveToken = saveToken || function (token) {
    this.store = token;
    if (process.env.NODE_ENV === 'production') {
      console.warn("Don't save token in memory, when cluster or multi-computer!");
    }
    return token;
  };
  // this.prefix = 'https://open.youzan.com/'
  this.prefix = 'https://open.youzanyun.com';
  this.defaults = {};
  axios.defaults.baseURL = this.prefix;
  axios.defaults.headers.post['User-Agent'] = 'YZY-Open-Client 1.0.0 - Node';
};

/**
 * 用于设置urllib的默认options
 *
 * Examples:
 * ```
 * api.setOpts({timeout: 15000});
 * ```
 * @param {Object} opts 默认选项
 */
API.prototype.setOpts = function (opts) {
  this.defaults = opts;
  extend(axios.defaults, opts);
};

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
API.prototype.request = function () {
  var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  var options = {};
  extend(options, this.defaults);
  for (var key in opts) {
    if (key !== 'headers') {
      options[key] = opts[key];
    } else {
      if (opts.headers) {
        options.headers = options.headers || {};
        extend(options.headers, opts.headers);
      }
    }
  }
  // console.log(options)

  return axios.request(options);
};

/*!
 * 根据创建API时传入的账号获取access token
 */
API.prototype.getAccessToken = async function (ifForce) {
  try {
    var token = await this.getToken();

    var client_id = this.client_id,
        client_secret = this.client_secret,
        authorize_type = this.authorize_type,
        payload = this.payload,
        tokenUrl = this.tokenUrl;

    var attr = {
      silent: 'grant_id',
      authorization_code: 'code',
      refresh_token: 'refresh_token'
    }[authorize_type];
    if (!token || ifForce) {
      console.log('get new AccessToken');

      var res;
      if (tokenUrl) {
        res = await axios.get(tokenUrl).then(function (res) {
          return res.data;
        });
      } else {
        var url = '/auth/token';

        res = await axios.create({
          headers: {
            'Content-type': 'application/json;charset=UTF-8'
          }
        }).post(url, _defineProperty({
          client_id: client_id,
          client_secret: client_secret,
          authorize_type: authorize_type
        }, attr, payload)).then(function (res) {
          return res.data;
        });
      }

      var _res = res,
          _res$data = _res.data,
          access_token = _res$data.access_token,
          expires = _res$data.expires,
          success = _res.success,
          code = _res.code,
          message = _res.message;


      if (success) {
        // 过期时间，因网络延迟等，将实际过期时间提前10秒，以防止临界点
        return token = this.saveToken(AccessToken(access_token, expires - 10 * 1000, res));
      }

      throw new Error(code, message);
    }
    return token;
  } catch (error) {
    console.warn('get AccessToken error:', error);
  }
};

/*!
 * 根据创建API时传入的账号获取access token
 */
API.prototype.refreshToken = function () {
  var _this = this;

  return this.getAccessToken(true).then(function (token) {
    return _this.saveToken(token);
  });
};

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
API.prototype.invoke = async function (apiName) {
  var _this2 = this;

  var opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var retryTimes = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 2;
  var _opt$version = opt.version,
      version = _opt$version === undefined ? '3.0.0' : _opt$version,
      _opt$responseType = opt.responseType,
      responseType = _opt$responseType === undefined ? 'json' : _opt$responseType,
      _opt$method = opt.method,
      method = _opt$method === undefined ? 'POST' : _opt$method;

  var args = arguments;
  var url = this.prefix;
  //   var service = apiName.substring(0, apiName.lastIndexOf('.'))
  //   var action = apiName.substring(apiName.lastIndexOf('.') + 1, apiName.length)
  var token = await this.getAccessToken();

  url += '/api/' + apiName + '/' + version + '?access_token=' + token.accessToken;

  // console.log('url, data', url, opt.data)
  return this.request(extend({ url: url, responseType: responseType, method: method }, opt)).then(function (res) {
    // var data = res.data
    var _res$data2 = res.data,
        gw_err_resp = _res$data2.gw_err_resp,
        data = _res$data2.data,
        response = _res$data2.response,
        error_response = _res$data2.error_response;

    var errorRes = gw_err_resp || error_response;
    // console.log(res.data);

    // 无效token重试
    if (errorRes) {
      var code = errorRes.code,
          msg = errorRes.msg,
          _errorRes$err_code = errorRes.err_code,
          err_code = _errorRes$err_code === undefined ? code : _errorRes$err_code,
          _errorRes$err_msg = errorRes.err_msg,
          err_msg = _errorRes$err_msg === undefined ? msg : _errorRes$err_msg;

      if ([4201, 4202, 4203].indexOf(err_code) >= 0 && --retryTimes >= 0) {
        console.log('retryTimes', retryTimes);
        Array.prototype.splice.call(args, 2, 1, retryTimes);
        return _this2.refreshToken().then(function () {
          return _this2.invoke.apply(_this2, _toConsumableArray(args));
        });
      } else {
        var error = new Error('yzsdk invoke error: ' + url + ', ' + JSON.stringify(opt) + ' - ' + err_code + ' - ' + err_msg);
        error.code = err_code;
        error.msg = err_msg;
        throw error;
      }
    }

    return data || response || gw_err_resp;
  });
};

/**
 * 用于支持对象合并。将对象合并到API.prototype上，使得能够支持扩展
 * Examples:
 * ```
 * // 媒体管理（上传、下载）
 * API.mixin(require('./lib/api_media'));
 * ```
 * @param {Object} obj 要合并的对象
 */
API.mixin = function (obj) {
  for (var key in obj) {
    if (API.prototype.hasOwnProperty(key)) {
      throw new Error("Don't allow override existed prototype method. method: " + key);
    }
    API.prototype[key] = obj[key];
  }
};

API.AccessToken = AccessToken;
API.middleware = middleware;

module.exports = API;