/**
 * Created by godsong on 15-3-5.
 */
var util = require('util');
var Http = require('http');
var Url = require('url');
var Path = require('path');
var Fs = require('fs');
var _ArrayProto = [];
var Promise = require('./Promise');
var Utils = module.exports;
var QueryString=require('querystring');
var projectPath = Path.dirname(require.main.filename);
var crypto = require('crypto');
Utils.__proto__ = util;
Utils.clone = function clone(dest, src, deep) {
    if(Utils.isArray(src)) {
        if(!Utils.isArray(dest)) {
            dest.__proto__ = _ArrayProto;
        }
        for(var i = 0; i < src.length; i++) {
            var obj = src[i];
            if(deep && typeof obj === 'object') {
                dest.push(clone({}, obj, deep));
            }
            else {
                dest.push(obj);
            }
        }
    }
    else {
        for(var key in src) {
            if(src.hasOwnProperty(key)) {
                obj = src[key];
                if(deep && typeof obj === 'object') {
                    dest[key] = clone({}, obj, deep);
                }
                else {
                    dest[key] = obj;
                }
            }
        }
    }
    return dest;
};
Utils.merge = function merge(a, b) {
    var dest = {};
    for(var i = 0; i < arguments.length; i++) {
        if(typeof arguments[i] === 'object') {
            for(var k in arguments[i]) {
                if(arguments[i].hasOwnProperty(k)) {
                    dest[k] = arguments[i][k];
                }
            }
        }
    }
    return dest;
};
Utils.localGet = function(url, headers) {
    var urlObj = Url.parse(url);
    headers = Utils.clone({}, headers, true);
    delete headers['accept-encoding'];
    headers['Host'] = '127.0.0.1';
    var p = new Promise();
    var req = Http.request({
        host    : urlObj.hostname,
        method  : 'get',
        path    : urlObj.path,
        port    : urlObj.port || 80,
        headers : headers
    }, function(res) {
        var body = '';
        res.on('data', function(chunk) {
            body += chunk.toString();
        });
        res.on('end', function() {
            if(res.statusCode == 200) {
                p.resolve(body);
            }
            else {
                p.reject(res.statusCode);
            }
        });
    });

    req.on('error', function(err) {
        var e = new Error('Connect Error for request for ' + url);
        e.name = 'Http Request Error';
        p.reject(e);
    });
    req.end();
    return p;
};
Utils.lowerCaseFirst = function(s) {
    return s[0].toLowerCase() + s.slice(1);
};
Utils.getAllJsFiles=function (dir){
    return this.getAllFiles(dir,'js',/^\./);
}
Utils.getAllFiles = function getAllFile(dir, ext,exclude) {
    var result = [];
    exclude=exclude||/^$/;
    if(ext){
        var re_ext = new RegExp('^\\.(' + ext + ')$');
    }
    else{
        re_ext=/.*/;
    }
    try {
        var files = Fs.readdirSync(dir);
    }
    catch(e) {
        files = [];
    }
    for(var i = 0; i < files.length; i++) {
        var extname = Path.extname(files[i]);
        if(exclude.test(files[i])){
            continue;
        }
        if(extname === ''&&Fs.statSync((Path.join(dir, files[i]))).isDirectory()) {
            result.push.apply(result, getAllFile(Path.join(dir, files[i])));
        }
        else if(re_ext.test(extname)) {
            result.push(Path.join(dir, files[i]));
        }
    }
    return result;
};

Utils.dealAsyncGenerator = function dealAsyncGenerator(generator, state, promise) {
    //执行generator
    if(state.done) {//所有的yield完成
        promise.resolve(state.value);//抛出结果
        return true;
    }
    else {
        if(state.value && state.value.then) {//其中一个yield 且yield出thenable(promise)
            var resolveError = function(reason) {
                promise.reject(reason);
            }
            state.value.then(function then(data) {
                //等待上个yield出来的promise完成时 恢复执行代码至下一个yield
                var nextState = generator.next(data);
                dealAsyncGenerator(generator, nextState, promise)
            }, resolveError).catch(resolveError);
        }
        else if(typeof state.value === 'function') {
            try {
                var ret = state.value();
            } catch(err) {
                return promise.reject(err);
            }
            if(ret && ret.then) {
                resolveError = function(reason) {
                    promise.reject(reason);
                }
                ret.then(function then(data) {
                    //等待上个yield出来的promise完成时 恢复执行代码至下一个yield
                    var nextState = generator.next(data);
                    dealAsyncGenerator(generator, nextState, promise)
                }, resolveError).catch(resolveError);
            }
            else {
                try {
                    var nextState = generator.next(ret);
                } catch(err) {
                    return promise.reject(err);
                }
                dealAsyncGenerator(generator, nextState, promise)
            }
        }
        else {//其中一个yield 且yield出普通值 立即恢复执行代码至下一个yield
            try {
                nextState = generator.next(state.value);
            } catch(err) {
                return promise.reject(err);
            }
            dealAsyncGenerator(generator, nextState, promise)
        }
    }
};
//执行目标函数
//该函数可能是包含yield的generator 异步函数
Utils.executeAsyncGeneratorFunc = function executeAsyncGeneratorFunc(fn, thisArgs, args, afterPromise) {
    try {
        var ret = fn.apply(thisArgs, args);//执行目标函数
    } catch(e) {
        return afterPromise.reject(e);
    }
    if(ret && ret.toString() === '[object Generator]') {//如果返回generator
        try {
            var next = ret.next();
        } catch(e) {
            return afterPromise.reject(e);
        }
        Utils.dealAsyncGenerator(ret, next, afterPromise);
    }
    else if(ret instanceof Promise) {//如果返回promise
        ret.then(function(value) {
            afterPromise.resolve(value);
        }, function(reason) {
            afterPromise.reject(reason);
        });
    }
    else {//如果返回普通值
        afterPromise.resolve(ret);
    }
};
Utils.mkdirSync = function mkdirSync(path) {
    var parentDir = Path.join(path, '..');
    if(Fs.existsSync(parentDir)) {
        Fs.mkdirSync(path);
    }
    else {
        mkdirSync(parentDir);
        Fs.mkdirSync(path);
    }
};
var re_needEscape = /\^|\$|\*|\.|\?|\+|\\|\{|\}|\(|\)|\[|\]|\|/;
var Encoder = Utils.Encoder = function Encoder(charset, escape, short) {
    this.charset = escape + '' + charset;
    this.escape = escape;
    this.shortly = short !== false ? 1 : 2;
    this.prefix = short !== false ? '' : '0';
    if(charset.length > 9 && this.shortly == 1) {
        throw new Error('The length of [charset] must not more than 9 unless the [short] be set to false')
    }
    this.encodeRE = new RegExp(this.charset.split('').map(function(c) {
        return re_needEscape.test(c) ? '\\' + c : c;
    }).join('|'), 'g');
    this.decodeRE = new RegExp(this.escape.replace(re_needEscape, '\\$&') + '(\\d{' + this.shortly + '})', 'g');
};
Encoder.prototype = {
    decode : function(str) {
        return str.replace(this.decodeRE, function(m, idx) {
            return this.charset[+idx];
        }.bind(this));
    },
    encode : function(str) {
        return str.replace(this.encodeRE, function(m) {
            var idx = this.charset.indexOf(m);
            return this.escape + (idx > 9 ? idx : this.prefix + idx);
        }.bind(this))
    }
};
Utils.FileNameEncoder = new Utils.Encoder('\\/:*?"<>|', '※');
global.sleep = function(time) {
    var p = new Promise();
    console.time('real sleep')
    setTimeout(function() {
        console.timeEnd('real sleep')
        p.resolve();
    }, time);
    return p;
};
function noop() {
}
Utils.resolveInvokeChain = function resolveInvokeChain(request, response, invokeContext, invokeChain, currentIndex, errHandler) {
    var currentInvoker = invokeContext.currentInvoker = invokeChain[currentIndex];
    if(currentInvoker.isAction) {

        var ret = currentInvoker.run(request, response, invokeContext);
    }
    else {
        ret = currentInvoker.run(request, response, function() {
            return currentIndex + 1 < invokeChain.length ?resolveInvokeChain(request, response, invokeContext, invokeChain, currentIndex + 1, errHandler):null;
        } , invokeContext);
    }
    return ret.catch(errHandler);
}

Utils.getJSON=function(url, data,resolver) {
    var urlObj = Url.parse(url);
    var p = new Promise();
    var dataStr=QueryString.stringify(data)
    var request = Http.request({
        host    : urlObj.hostname,
        method  : 'post',
        path    : urlObj.path,
        port    : urlObj.port || 80,
        headers: {
            "Content-Type": 'application/x-www-form-urlencoded',
            "Content-Length": dataStr.length
        }
    }, function(res) {
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            if(res.statusCode == 200) {

                try {
                    var result = JSON.parse(body)
                } catch(e) {
                    result = body;
                }
                resolver && (result = resolver(result));
                p.resolve(result);
            }
            else {
                //p.reject(res.statusCode);
                p.resolve(body);
                //console.log(body);
            }
        });
    });
    this.promise = p;
    request.on('error', function(err) {
        var e = new Error('Connect Error for request for ' + url);
        e.name = 'Http Request Error';
        p.reject(e);
    });
    request.write(dataStr + "\n");
    request.end();
    return p;
};
var slice=Array.prototype.slice;
global.lg=function lg(){
    if(lg.debug) {
        var args = slice.call(arguments).map(function(e){
            return Utils.clone(e);
        });
        var stack=new Error().stack.split('\n')[2];
        var m=stack.match(/\(.+\)/);
        args.push(m[0].replace(projectPath,''));
        console.log.apply(console, args);
    }
}
global.lg.trace=function(){
    if(lg.debug) {
        var args = slice.call(arguments);
        console.trace.apply(console, args);
    }
}
Utils.encode=function(text){
    var cipher = crypto.createCipher('aes-256-cbc','hitour10086');
    var crypted = cipher.update(text,'utf8','hex')
    crypted += cipher.final('hex');
    return crypted;
}
Utils.decode=function(code){
    var decipher = crypto.createDecipher('aes-256-cbc','hitour10086');
    var dec = decipher.update(code,'hex','utf8');
    dec += decipher.final('utf8');
    return dec;
}
Utils.locator=function(path){
    return Path.join(projectPath,path);
}
Utils.cookie={
    add:function(name,value,time,path,httpOnly){
        var cookie=name+'='+value;
        var now=new Date();
        now.setTime(now.getTime()+time*1000);
        cookie+=';Expires='+ now.toGMTString();
        cookie+=';Path='+path||'/';
        if(httpOnly){
            cookie+=';HttpOnly'
        }
        return cookie;
    },
    del:function(name,path){
        return name + '=; Path='+(path||'/')+';Expires=Thu, 01 Jan 1970 00:00:01 GMT';
    }
}