/**
 * Created by godsong on 15-4-24.
 */
var ServeStatic = require('serve-static');
var Config = require('../Config');
var Promise = require('../Promise');
var Path = require('path');
var ReadyStream = require('../ReadyStream');
var Fs = require('fs');
var serveStatic = ServeStatic(Path.resolve(Config.get('servex').projectPath, Config.get('servex').assetsDir))
exports.filter = function*(request, response, next, context) {
    console.log('find staticFile')
    //Fs.createReadStream('./assets/css/base.css').pipe(context.readyStream);
    serveStatic(request, context.readyStream, function(err) {
     context.readyStream._response._headers = undefined;
     context.readyStream.statusCode = err ? err.status : 404;
     context.readyStream.end(err ? err.msg : 'Not Found');
     });

}