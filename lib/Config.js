/**
 * Created by godsong on 15-4-8.
 */

var Fs = require('fs');
var Utils = require('./Utils');
var Path = require('path');
var _configuration = {};
var Config={};
Config.loadConfig = function(path) {
    if(/\.js$/.test(path)) {
        var fileList = [path];
    }
    else {
        fileList = Utils.getAllFiles(path, 'js|json')
    }
    fileList.forEach(function(fileName) {
        try {
            var file = Fs.readFileSync(fileName);
        } catch(e) {
            return;
        }
        var name = Path.basename(fileName, Path.extname(fileName)).toLowerCase();
        _configuration[name] = eval('(' + file.toString().replace(/^[^{]*|;*\s*$/g, '') + ')');
        Object.defineProperty(Config,name,{
            get:function(){
                return _configuration[name];
            },
            enumerable:true
        })

    });
};
Config.get = function(name) {
    return _configuration[name.toLowerCase()];
};
Config.set = function(name, value) {
    _configuration[name] = value;
    if(!Config.hasOwnProperty(name)) {
        Object.defineProperty(Config, name, {
            get        : function() {
                return _configuration[name];
            },
            enumerable : true
        });
    }
};
module.exports=Config;