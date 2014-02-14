
/*
 * Karotz module
 */


var express      = require('express')(),
    server       = require('http').createServer(express),
    request      = require('request'),
    crypto       = require('crypto'),
    parseString  = require('xml2js').parseString,
    EventEmitter = require('events').EventEmitter,
    cronJob      = require('cron').CronJob,
    Repeat       = require('repeat');

var controller = new EventEmitter();


var app = {

    interactiveid : '',
    configId      : '',
    access        : {},

    status        : '', //"connected" or "disconnected"

    //number of successive tries to connect Karotz that haven't succed
    nbTry         : 0,  

};

var karotz = {
    isSleeping     : true,
    sleepTimes     : {},

    breathingLed : "FFFFFF",

    led : {
        type  : '', //light, fade, pulse
        color : '', //RGB color,
        period: 0, //period for 'pulse' and 'fade'
        pulse : 0, //pulse for 'pulse'
    }
}

var cron = [];

var refresh;

var myDate = new Date();





/*
    AUTHENTICATION
 */

/**
 * authentication method
 *
 * Get the interactiveid from the karotz server.
 * 
 * @param  {string}   apikey    The apikey of the app. See your app description on http://www.karotz.com/lab/app/dashboard
 * @param  {string}   installid The installid of the app. See your app description on http://www.karotz.com/my/object
 * @param  {string}   secret    The secret of the app. See your app description on http://www.karotz.com/lab/app/dashboard
 * @param  {bool}     permanent If true, the module authenticate the app every 14 min. (An installId is only valid 15 min)
 */
function authentication(apikey, installid, secret, permanent, next) {

    //Parameters

    var parameters = {
        apikey    : apikey,
        installid : installid,
        once      : Math.round(Math.random()*100),
        timestamp : Math.round(+new Date/1000),
    }

    var secret = secret;

    //The query

    var query = '';

    for (var key in parameters) {
        if (query != "")  query += "&";
        query += encodeURIComponent(key)+"="+encodeURIComponent(parameters[key]);
    }

    //The signature

    var signature = crypto.createHmac('sha1', secret).update(query).digest('base64');

    //The URL
    
    var url = 'http://api.karotz.com/api/karotz/start?'+query+"&signature="+encodeURIComponent(signature);


    request(url, function (error, response, body) {

        if(typeof body == 'undefined') {
            if(next) next("Error with " + url );
        } 
        else { 
            parseString(body, function (err, result) {

                if(
                    !err 
                    && result
                    && typeof result.VoosMsg.response == 'undefined' 
                    && typeof result.VoosMsg.interactiveMode != "undefined"
                    )
                { 
                    var interactiveMode = result.VoosMsg.interactiveMode[0];

                    app.interactiveid = interactiveMode.interactiveId[0];
                    app.configId      = interactiveMode.configId[0];
                    app.access        = interactiveMode.access;

                    app.status = 'connected';
                    app.nbTry  = 0;

                    controller.emit('connected', app);  

                    if(karotz.isSleeping) {
                        sleep();
                    }
                    else {

                        //We update the led as it was after authentication

                        var action = karotz.led.type || false;

                        switch(action) {
                            
                            case 'fade' :
                                var params = {
                                    color   : karotz.led.color,
                                    period  : karotz.led.period,
                                    timeout : karotz.led.timeout
                                }
                                break;

                            case 'pulse' :
                                var params = {
                                    color   : karotz.led.color,
                                    pulse   : karotz.led.pulse,
                                    period  : karotz.led.period,
                                    timeout : karotz.led.timeout
                                }
                                break;

                            case 'light' :
                                var params = {
                                    color : karotz.led.color
                                }
                                break;

                            default : break;
                        }

                        led(
                            'light',
                            {
                                color : '000000', //Off
                            },
                            function () {
                                if(action) 
                                    led(action, params);
                            }
                        );
                    }

                    if(next) next(app);
                }
                else
                {
                    //Can't connect Karotz

                    app.status        = 'disconnected';
                    app.configId      = '';
                    app.interactiveid = '';
                        
                    if(next) next("Error. Can't connect the rabbit.");
                }
            });
        }

        //If Karotz is not connected
        if(app.status != 'connected') {

            var limit = 3;

            app.nbTry++;

            if(app.nbTry < limit) {

                //We try to connect Karotz once again
                //It could be a network problem, etc.
                authentication(apikey, installid, secret, false);

            } 

            else if ( app.nbTry == limit) {

                //"@var limit" number of unsucced attemps to connectKarotz

                //Emit an event to alert that network or Karotz's servers seem to be broken
                //Maybe try to unplug Karotz a moment
                
                controller.emit('errWithServers', app);

                //The plugin will continue to try to connect Karotz every 14min
            }

        }

        //the module authenticate the app every 14 min
        if(permanent) {


            function interval() {

                controller.emit('loop');

                stop(false, function () {
                    authentication(apikey, installid, secret, false);
                });


            }

            refresh = Repeat(interval).every(14, 'minutes').start.in(14, 'minutes');
        }

    });
     
}

controller.authentication = function(apikey, installid, secret, permanent, next) {
    authentication(apikey, installid, secret, permanent, next); 
}


/**
 * stop method
 *
 * Stop the current running application on Karotz. Frees the rabbit.
 *
 * @param  {bool}  stopPermanent     Stop the reconnection of the app every 14 min.
 */
function stop (stopPermanent, next) {

    var url = "http://api.karotz.com/api/karotz/interactivemode?action=stop&interactiveid="+app.interactiveid

    request(url, function (error, response, body) {

        if(typeof body == 'undefined') {
            if(next) next("Error");
        } 
        else {
            parseString(body, function (err, result) {

                if(
                    !err
                    && result
                    && typeof result.VoosMsg.response != "undefined"
                    && result.VoosMsg.response[0].code[0] == "OK"
                    )
                {

                    app.status        = 'disconnected';
                    app.configId      = '';
                    app.interactiveid = '';

                    controller.emit('disconnected', app);

                    if(next) next(app);
                }
                else
                {
                    if(next) next("Error. No stop confirm received.");
                }
            });
        }

    });

    //Stop the interval of reconnection
    if(stopPermanent) {
        refresh.stop();
    }

}

controller.stop = function(stopPermanent, next) {
    stop(stopPermanent, next);  
}


/**
 * config method
 *
 * Set some Karotz's configuration
 * 
 * @param  {objet}    sleep        Time to Wake Up / Time to sleep
 * @param  {objet}    breathingLed The led when the app is online.
 */
function config(sleepTimes, breathingLed, next){

    if(breathingLed) karotz.breathingLed = breathingLed;

    if(cron != []) {
        for (var i = 0; i < cron.length; i++) {
            cron[i].stop();
        };
    }

    myDate = new Date();

    if(sleepTimes) 
    {
        karotz.sleepTimes = sleepTimes;

        var j = 0;

        for (var i = 0; i < sleepTimes.length; i++) {

            //If today
            if(i == myDate.getDay()) {

                var sleepDate = new Date();
                var wakeUpDate = new Date();
                sleepDate.setFullYear(myDate.getFullYear());
                sleepDate.setMonth(myDate.getMonth());
                sleepDate.setDate(myDate.getDate());
                sleepDate.setSeconds(0);
                sleepDate.setMilliseconds(0);
                wakeUpDate.setFullYear(myDate.getFullYear());
                wakeUpDate.setMonth(myDate.getMonth());
                wakeUpDate.setDate(myDate.getDate());
                wakeUpDate.setSeconds(0);
                wakeUpDate.setMilliseconds(0);

                sleepDate.setHours(sleepTimes[i][2]);
                sleepDate.setMinutes(sleepTimes[i][3]);

                wakeUpDate.setHours(sleepTimes[i][0]);
                wakeUpDate.setMinutes(sleepTimes[i][1]);


                if(wakeUpDate.getTime() < myDate.getTime() && myDate.getTime() < sleepDate.getTime()) {
                    if(karotz.isSleeping) {
                        wakeUp();
                    } else {
                        breath();
                    }
                } else {
                    if(!karotz.isSleeping) {
                        sleep();
                    }
                }

            }

            //Set Cron to Wake Up
            cron[j] = new cronJob(
                sleepTimes[i][1]+' '+ sleepTimes[i][0] +' * * '+(i),

                wakeUp, 
                null,
                true
            );
            j++;

            //Set Cron to Sleep
            cron[j] = new cronJob(
                sleepTimes[i][3]+' '+ sleepTimes[i][2] +' * * '+(i),

                sleep, 
                null,
                true
            );
            j++;
        };
    }

    if(breathingLed) karotz.breathingLed = breathingLed;

    if(next) next(karotz);
}

controller.config = function(sleepTimes, breathingLed, next) {
    config(sleepTimes, breathingLed, next); 
}


/**
 * sleep method
 *
 * Make the rabbit sleeping
 */
function sleep(next) {
    karotz.isSleeping = true;

    led(
        'light',
        {
            color : '000000', //Off
        },
        function (msg) {

            // ears(9, 10, false, false, function (msg) {
            //  if (next) next(karotz);
            // });
            // 
            // Make to mutch noise ^^'
        }
    );

    controller.emit('sleep', karotz);

    if(next) next("sleep");

}

controller.sleep = function(next) {
    sleep(next);
}



/**
 * wakeUp method
 *
 * WakeUp the Rabbit
 */
function wakeUp(next) {
    karotz.isSleeping = false;

    breath();

    controller.emit('wakeUp', karotz);  

    if(next) next("wakeUp");

}

controller.wakeUp = function(next) {
    wakeUp(next);   
}


/**
 * breath method
 *
 * Make the rabbit breath
 */
function breath(next) {

    //console.log('breath ' + karotz.breathingLed);

    if(karotz.isSleeping) {
        led(
            'light',
            {
                color: '000000'
            }
        );
    }
    else {
        led(
            'light',
            {
                color : '000000', //Off
            },
            function (msg) {
                led(
                    'pulse',
                    {
                        color   : karotz.breathingLed,
                        period  : 1500, //period of the pulse
                        pulse   : 16*60*1000, //duration of the blinking
                        timeout : false
                    },
                    function (msg) {
                        // ears(false, false, false, true, function (msg) {
                        //  if (next) next(karotz);
                        // });
                    }
                );
            }
        );
    }

    if(next) next();
    
}

controller.breath = function(next) {
    breath(next);  
}


/**
 * callback function
 *
 * Listen at the url given.
 *
 * Could be use to listen at the callback url of the Karotz's app
 * @see http://dev.karotz.com/dev/register_app.html#descriptor-xml 
 * 
 * @param  {string}   url  
 * @param  {int}      port 
 */
function callback(url, port, next){

    server.listen(port);

    express.get(url, function (req, res) {

        controller.emit('callback', req, res);

        res.send(200);

    });

    if(next) next();

}

controller.callback = function(url, port, next) {
    callback(url, port, next);  
}



/*
    EARS
 */

/**
 * ears method
 *
 * Control the ears.
 * 
 * @param  {int}      left     Position of the ear.
 * @param  {int}      right    Position of the ear.
 * @param  {bool}     relative Move is relative to current position, must be true or false
 * @param  {bool}     reset    Reset position, must be true or false
 */
function ears (left, right, relative, reset, next) {

    //Params

    if(reset) {

        var params = {
            reset         : true,
            interactiveid : app.interactiveid
        };

    } else {

        var params = {
            left          : left,
            right         : right,
            relative      : relative,
            interactiveid : app.interactiveid
        };

    }

    //The query

    var query = '';

    for (var key in params) {
        if(params[key]) {
            if (query != "")  query += "&";
            query += encodeURIComponent(key)+"="+encodeURIComponent(params[key]);
        }
    }

    //Url
    
    var url = 'http://api.karotz.com/api/karotz/ears?'+query;


    request(url, function (error, response, body) {

        if(typeof body == 'undefined') {
            if(next) next("Error");
        } 
        else {
            parseString(body, function (err, result) {

                if(
                    !err
                    && result
                    && typeof result.VoosMsg.response != "undefined"
                    && result.VoosMsg.response[0].code[0] == "OK"
                    )
                {

                    if(next) next("Move");
                }
                else
                {
                    if(next) next("Error");
                }
            });
        }

    });

}

controller.ears = function(left, right, relative, reset, next) {
    ears(left, right, relative, reset, next);   
}


/*
    LED
 */

// karotz.led(
//  'pulse',
//  {
//      color : 'FE78CC',
//      period: 500, //period of the pulse
//      pulse : 8000 //duration of the blinking
//  },
//  function(msg) {
//      console.log(msg);
//  } 
// );


// karotz.led(
//  'fade',
//  {
//      color : 'FE78CC',
//      period: 8000, //duration of the fade-in
//  },
//  function(msg) {
//      console.log(msg);
//  } 
// );
 
 
// karotz.led(
//  'light',
//  {
//      color : '000000', //Off
//  },
//  function(msg) {
//      console.log(msg);
//  } 
// );


/**
 * led method
 *
 * Control the led
 * 
 * @param  {string}   action Could be : pulse, fade, light.
 * @param  {string}   object Objet containing the params according to http://dev.karotz.com/api/#Led
 * 
    object = {
        color   : "FFFFFF", //The color of the led
        
        //For pulse : the period of the pulse
        //For fade : the duraction of the fade-in
        period  : 100, 

        //For pulse : the duration of the blinking
        pulse   : 1000,

        //OPTIONAL
        //For fade and pulse : false = no timeout to maintain the color after the end of the blink / the fade
        timeout : false
    
    }
 */
function led (action, objet, next) {

    //Params

    var params = {
        action : action
    };

    for (var attrname in objet) { 
        params[attrname] = objet[attrname]; 
    }

    params.interactiveid = app.interactiveid;

    //The query

    var query = '';

    for (var key in params) {
        if(params[key]) {
            if (query != "")  query += "&";
            query += encodeURIComponent(key)+"="+encodeURIComponent(params[key]);
        }
    }


    karotz.led = {
        type    : params.action,
        color   : params.color,
        period  : ((typeof params.period != undefined) ? params.period : null),
        pulse   : ((typeof params.pulse != undefined) ? params.pulse : null),
        timeout : ((typeof params.timeout != undefined) ? params.timeout : true)
    };

    //console.log(query);

    //Url
    var url = 'http://api.karotz.com/api/karotz/led?'+query;

    request(url, function (error, response, body) {

        if(typeof body == 'undefined') {
            if(next) next("Error");
        } 
        else {
            parseString(body, function (err, result) {

                if(
                    !err
                    && result
                    && typeof result.VoosMsg.response != "undefined"
                    && result.VoosMsg.response[0].code[0] == "OK"
                    )
                {

                    if(next) next("Led set");

                    //If it's ok for a timeout
                    if(karotz.led.timeout) {

                        //We update the state after the end of the pulse / the fade
                        if(action == 'fade') {
                            setTimeout(function() {
                                karotz.led = {
                                    type  : 'light',
                                    color : params.color,
                                    period: 0,
                                    pulse : 0,
                                };
                            }, params.period);
                        } else if(action == 'pulse') {
                            setTimeout(function() {
                                karotz.led = {
                                    type  : 'light',
                                    color : params.color,
                                    period: 0,
                                    pulse : 0,
                                };
                            }, params.pulse);
                        }
                    }

                }
                else
                {
                    if(next) next("Error");
                }
            });
        }

    });

}

controller.led = function(action, params, next) {
    led(action, params, next);  
}


/*
    TTS
 */
/**
 * tts method
 *
 * Text To Speech
 * 
 * @param  {string}   action 'speak' or 'stop'
 * @param  {[type]}   lang   Lang : EN, FR, ...
 * @param  {[type]}   text   The text to speech
 */
function tts(action, lang, text, next) {

    if(!lang) lang = "EN";

    if(action != "stop") {
        var params = {
            action        : 'speak',
            lang          : lang,
            text          : text,
            interactiveid : app.interactiveid
        };
    } else {
        var params = {
            action        : 'stop',
            interactiveid : app.interactiveid
        };
    }

    //The query

    var query = '';

    for (var key in params) {
        if(params[key]) {
            if (query != "")  query += "&";
            query += encodeURIComponent(key)+"="+encodeURIComponent(params[key]);
        }
    }

    //Url
    
    var url = 'http://api.karotz.com/api/karotz/tts?'+query;

    request(url, function (error, response, body) {

        if(typeof body == 'undefined') {
            if(next) next("Error");
        } 
        else {
            parseString(body, function (err, result) {

                if(
                    !err
                    && result
                    && typeof result.VoosMsg.response != "undefined"
                    && result.VoosMsg.response[0].code[0] == "OK"
                    )
                {

                    if(next) next("Speaking");
                }
                else
                {
                    if(next) next("Error");
                }
            });
        }
    });

}

controller.tts = function(action, lang, text, next) {
    tts(action, lang, text, next);  
}


/*
    MULTIMEDIA
 */

/**
 * multimedia method
 *
 * Play and manage songs.
 *
 * @see http://dev.karotz.com/api/#Multimedia
 * 
 * @param  {string}   action The action to do : play, pause, resume, stop, previous, next, record (may not work), allsong, folder, artist, genre, playlist. 
 * @param  {string}   url    If action is "play", url of the song, if action is record, url to post the record. 
 */
function multimedia(action, url, next) {

    if(action == "play") {
        var params = {
            action        : 'play',
            url           : url ,
            interactiveid : app.interactiveid
        }
    } else {
        var params = {
            action        : action,
            interactiveid : app.interactiveid
        }       
    }

    //The query

    var query = '';

    for (var key in params) {
        if(params[key]) {
            if (query != "")  query += "&";
            query += encodeURIComponent(key)+"="+encodeURIComponent(params[key]);
        }
    }

    //Url
    
    var url = 'http://api.karotz.com/api/karotz/multimedia?'+query;

    request(url, function (error, response, body) {

        if(typeof body == 'undefined') {
            if(next) next("Error");
        } 
        else {
            parseString(body, function (err, result) {

                var msg = "Error";

                if(!err)
                {
                    if(result && typeof result.VoosMsg.response != "undefined"
                        && result.VoosMsg.response[0].code[0] == "OK"
                        )
                    {
                        msg = "OK"; //Action done
                    } 
                    else if (
                        typeof result.VoosMsg.response == "undefined"
                    )
                    {
                        msg = result.VoosMsg; //return list of songs/playlists/folders
                    }

                    if(next) next(msg);
                }
                else
                {
                    if(next) next("Error");
                }
            });
        }

    });

}

controller.multimedia = function(action, url, next) {
    multimedia(action, url, next);
}


/*
    WEBCAM
 */

/**
 * webcam method
 *
 * Take a picture / a video (MJPEG stream).
 *
 * For a video : can be displayed in a html page with 
 * <img src="http://api.karotz.com/api/karotz/webcam?action=video&interactiveid=1234567890 />
 * 
 * @param  {string}   action  photo | video
 * @param  {[type]}   url     If action is photo, the url the post the picture.
 */
function webcam(action, url, next) {

    var params = {
        action        : action,
        url           : url,
        interactiveid : app.interactiveid
    }       

    //The query

    var query = '';

    for (var key in params) {
        if(params[key]) {
            if (query != "")  query += "&";
            query += encodeURIComponent(key)+"="+encodeURIComponent(params[key]);
        }
    }

    //Url
    
    var url = 'http://api.karotz.com/api/karotz/webcam?'+query;

    request(url, function (error, response, body) {

        if(typeof body == 'undefined') {
            if(next) next("Error");
        } 
        else {
            parseString(body, function (err, result) {

                if(
                    !err 
                    && result
                    && typeof result.VoosMsg.response != "undefined"
                    && result.VoosMsg.response[0].code[0] == "OK"
                    )
                {

                    if(next) next("OK");
                }
                else
                {
                    if(next) next("Error");
                }
            });
        }

    });
}

controller.webcam = function(action, url, next) {
    webcam(action, url, next);
}

/*
    CONFIG
 */

/**
 * config method
 *
 * Return config infos
 * 
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
function configuration(next) {

    var params = {
        interactiveid : app.interactiveid
    }

    //The query

    var query = '';

    for (var key in params) {
        if(params[key]) {
            if (query != "")  query += "&";
            query += encodeURIComponent(key)+"="+encodeURIComponent(params[key]);
        }
    }

    //Url
    
    var url = 'http://api.karotz.com/api/karotz/config?'+query;

    request(url, function (error, response, body) {

        if(typeof body == 'undefined') {
            if(next) next("Error");
        } 
        else {
            parseString(body, function (err, result) {

                if(
                    !err
                    && result
                    && typeof result.ConfigResponse != "undefined"
                    )
                {
                    if(next) next(result.ConfigResponse); //return config
                }
                else
                {
                    if(next) next("Error");
                }
            });
        }

    }); 


}

controller.configuration = function(next) {
    configuration(next);
}


//Exports the module

module.exports = controller;