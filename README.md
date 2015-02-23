# JSConsole

This is a little script that will make a console-type
terminal-ish thing in your browser. It requires nothing
except the DOM. It probably kind of works on IE9+. It definitely
works on Firefox and Chrome.

Try out the [demo](https://tmont.github.io/jsconsole).

## Usage

Load up`jsconsole.js` or `jsconsole.min.js`. You will
also need `jsconsole.css`. Tweak to your heart's content.

Then with some HTML like this:

```xml
<div id="oh-hai"></div>
```

Do this:

```javascript
var myConsole = new JSConsole('oh-hai');
myConsole.start();

//if you want to stop it
myConsole.stop();
```

