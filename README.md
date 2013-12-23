Karotz NodeJS Plugin
======================

A NodeJS Plugin to control your rabbit !

Introduction
-------------

First of all, you need to install the plugin by using npm :

    $ npm install karotz

To use the plugin, you need :

1. [An account on the Karotz Platform](http://www.karotz.com/register).
2. [To create a new app](http://www.karotz.com/lab/home). See [this](http://dev.karotz.com/dev/register_app.html) for help. Be carefull of the accesses you give to the app.
3. Write the API key and the Secret key of the app somewhere.
4. Load the app in your rabbit (Click the "Test!" button) and save the install ID.

Then, load the plugin :

```javascript
var karotz  = require('karotz');

var installid = '12345',
	apikey    = '12345',
	secret    = '12345';
```

### karotz.authentification(apikey, installid, secret, permanent, next)

You first need to authentificate your app to the Karotz Server. By doing this, the plugin receive an interactiveID from the Karotz Server.
An interactiveID is only valid 15min. So if you need to control your rabbit for a long time, set the `permanent` params at `true` for the plugin to ask for a new interactiveID every 14min.

Morevover, the plugin remember the last state of the led.

```javascript

var karotz  = require('./karotz');

var installid = '12345',
	apikey    = '12345',
	secret    = '12345';

karotz.authentication(apikey, installid, secret, true, function(app){

	/**
	 * Output object {
	 *		interactiveid : 'INTERACTIVEID',
	 *		configId      : 'CONFIGID',
	 *		access        : {...}, //all the accesses of the app
	 *		status        : 'connected' //'connected' or 'disconnected'
	 *	}
	 */

	console.log(app);

}

```

Parameters :

- `apikey` : the apikey of your app
- `installid` : the installid of your app
- `secret` : the secret key of your app
- `permanent` (boolean) : keep the connection alive or not ? If true, the plugin will ask for a new interactiveID every 14min.
- `next` : the function to execute after the connection.






### karotz.stop(stopPermanent, next)

Disconnect the Karotz.
If you need to make other action with the Karotz after, you must re-authentificate the rabbit.


```javascript
karotz.authentication(apikey, installid, secret, false, function(app){

	//Some stuff

	karotz.stop(false, function(app){
		console.log(app);
	});
}
```

Parameters :

- `stoPermanent` : stop the loop of authentification
- `next` : the function to execute after the connection.






### karotz.sleep(next)

Make the rabbit sleeping (just led off and horizontal ears).

```javascript
...

karotz.sleep(function(karotz) {
	console.log(karotz);
});
```





### karotz.wakeup(next)

Wakeup the rabbit (he starts breathing).

```javascript
...

karotz.wakeUp(function(karotz) {
	console.log(karotz);
});
```





### karotz.config(sleepTimes, breathingLed, next)

Configure wake-up/sleep times and breathingLed.

```javascript
...

var sleep = [
	['08', '00', '21', '00'], //Sunday
	['08', '00', '21', '00'], //Monday
	['08', '00', '21', '00'], //etc.
	['08', '00', '21', '00'],
	['08', '00', '21', '00'],
	['08', '00', '21', '00'],
	['08', '00', '21', '00'],
];

var breathingLed = "2222FF";

karotz.authentication(apikey, installid, secret, false, function(app){

	karotz.config(sleepTimes, breathingLed, function(karotz) {

		/** Output object {
		 *	isSleeping     : false,
		 *	sleepTimes     : {},
		 *	breathingLed : "FFFFFF",
		 * }
		 */

		console.log(karotz);
	}):
}

```






### karotz.callback(path, port, next)

*Experimental*

Listen at the given path.
Could be use to listen at the callback url of the Karotz's app.
See [dev.karotz.com](http://dev.karotz.com/dev/register_app.html#descriptor-xml)

Use it with `karotz.multimedia()` and `karotz.webcam()`.

You must listen to the `callback` event.

```javascript
...

var path = 'photo';
var port : 1234;

//It will listen at http://myNodeJSServerIp:1234/photo
karotz.callback(path, port, function(){
	//something
});

//Event fired on callback
karotz.on('callback', function(req, res) {
	console.log("Request", req);
	console.log("Response", res);
})


```

Parameters :

- `url` (string) : the url to listen
- `port` (int) : the port
- `next` : the function to chaine







Let's play !
--------------




### karotz.ears(left, right, relative, reset, next)

Control the ears !

Each ear have 16 positions to make a loop.


```javascript
...

/*
 * Make something like that :
 *
 *			|
 *			|	___
 *			 / \
 *			| ° |
 *			| _ |
 *			_	_
 *
 */

var right : 8;
var left : 0;

karotz.ears(left, right, false, false, function(msg) {
	console.log(msg); //Output 'Move' or 'Error'
})

```

```javascript
...

//reset to top

karotz.ears(false, false, false, true, function(msg) {
	console.log(msg);
})

```

Parameters :

- `left` (int) : the left ear
- `right` (int) : the right ear
- `relative` (boolean) : is move is relative to current position ?
- `reset` : reset the ears
- `next` : function to chain





### karotz.led(action, object, next)

Control the led !

* Light

```javascript
...

//Led just change color

karotz.led(
	'light',
	{
		color : 'ffffff', //hexa RGB color
	},
	function(msg) {
		console.log(msg);
	}
);
```

* Fade

```javascript
...

//Will fade from red to orange in 10 sec

karotz.led(
	'light',
	{
		color : 'ff0000', //hexa RGB color, red
	},
	function(msg) {
		karotz.led(
			'fade',
			{
				color : 'E0540B', //hexa RGB color, orange
				period: 10000, //duration of the fade-in (ms)
			},
			function(msg) {
				console.log(msg);
			}
		);
	}
);



```


* Pulse


```javascript
...

//Will blink red/white during 10 sec, then light red

karotz.led(
	'light',
	{
		color : 'FF0000', //hexa RGB color, red
	},
	function(msg) {
		karotz.led(
			'pulse',
			{
				color : 'ffffff', //hexa RGB color, white
				period: 500, //period of the pulse (ms)
				pulse : 10000 //duration of the blinking (ms)
			},
			function(msg) {
				console.log(msg);
			}
		);
	}
);


```

* Off

```javascript
...

karotz.led(
	'light',
	{
		color : '000000', //hexa RGB color
	},
	function(msg) {
		console.log(msg);
	}
);
```


Parameters :

- `action` (string) : action to do (pulse, fade or light)
- `object` (object) : Objet containing the params according to http://dev.karotz.com/api/#Led
- `next` : function to chain





### karotz.tts(action, lang, text, next)

And your Karotz speaks !


```javascript
...

//Say "I want a carrot"

karotz.tts('speak', 'EN', "I want a carrot !", function(msg) {
	console.log(msg); //Output 'Speaking' or 'Error'
});
```

```javascript
...

//Stop speaking

karotz.tts('stop', function(msg) {
	console.log(msg);
});
```

Parameters :

- `action` (string) : action to do (speak or stop)
- `lang` (string) : lang (EN, FR, ...)
- `text` (string) : the text to speech
- `next` : function to chain





### karotz.multimedia(action, url, next)

Play and manage songs.

```javascript
karotz.multimedia('play', 'http://somesite/somemp3.mp3', function(msg){
	console.log(msg); //Output 'OK', 'Error'
});
```

Parameters :

- `action` (string) : action to do (play, pause, resume, stop, previous, next, record (may not work), allsong, folder, artist, genre, playlist)
- `url` (string) : If action is "play", url of the song or path in the USB. If action is record, url to post the record (see karotz.callback() ).
- `next` : function to chain




### karotz.webcam(action, url, next)


Take a picture / a video (MJPEG stream).

For a video : can be displayed in a html page with `<img src="http://api.karotz.com/api/karotz/webcam?action=video&interactiveid=1234567890 />`

- `action` (string) : action to do (photo or video)
- `url` (string) : if action is photo, the url the post the picture. (see karotz.callback() )
- `next` : function to chain





### karotz.configuration(next)

Return some Karotz config.

```javascript
karotz.configuration(function(config) {
	console.log(config); //'Error' or config object
})
```

Parameters :

- `next` : function to chain



Events
---------


You could listen to some events :

- `loop` : emit when the plugin re-authentificate the Karotz in permanent mode
- 'errWithServers' : the rabbit is unreachable (try to unplug it a moment)
- `connected`
- `disconnected`
- `callback` : the server received a callback
- `sleep`
- `wakeup`


````javascript
karotz.on('connected', function(app) {
	console.log("Karotz connected !");
});

karotz.on('disconnected', function(app) {
	console.log("Karotz disconnected !");
});

karotz.on('callback', function(req, res) {
	console.log("Callback :");
	console.log(req);
	console.log(res);
});

karotz.on('sleep', function(karotz) {
	console.log("Karotz is sleeping.");
});

karotz.on('wakeUp', function(karotz) {
	console.log("Karotz is awake.");
});


````

