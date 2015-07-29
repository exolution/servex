/**
 * Created by godsong on 15-7-13.
 */
var Config=require('../../lib/Config');
exports.reload=function*(name){
    name=name?name+'.js':'';
    var dir=Path.join(Config.server.projectPath,Config.server.configDir,name);
    Config.loadConfig(dir);
    return 'ok';
};