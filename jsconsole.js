(function(window, document) {

	var prefix = 'jsconsole-';

	function Cursor() {
		this.el = createElement('span', 'cursor');
	}

	Cursor.prototype = {
		writeChar: function(c, color) {
			var node;
			if (color) {
				node = createElement('span', 'char');
				node.style.color = color;
			}
			var text = document.createTextNode(c);
			node ? node.appendChild(text) : (node = text);
			this.el.parentNode.insertBefore(node, this.el);
		},

		del: function() {
			removeText(this.el.nextSibling);
		},

		backspace: function() {
			removeText(this.el.previousSibling);
		},

		moveToWord: function(verb) {
			var node = this.el[verb + 'Sibling'],
				target = null;
			do {
				if (!isTextNode(node)) {
					break;
				}

				if (node.nodeValue === ' ') {
					if (target) {
						break;
					}
				} else {
					target = verb === 'next' ? node.nextSibling : node;
				}
			} while (node = node[verb + 'Sibling']);

			if (target|| verb === 'next') {
				this.el.parentNode.insertBefore(this.el, target);
			}
		},

		moveToChar: function(verb) {
			var node = this.el[verb + 'Sibling'];
			if (!isTextNode(node)) {
				return;
			}
			if (verb === 'next') {
				node = node.nextSibling;
			}

			this.el.parentNode.insertBefore(this.el, node);
		},

		prevChar: function() {
			this.moveToChar('previous');
		},

		prevWord: function() {
			this.moveToWord('previous');
		},

		nextChar: function() {
			this.moveToChar('next');
		},

		nextWord: function() {
			this.moveToWord('next');
		},

		beginning: function() {
			this.el.parentNode.insertBefore(this.el, this.el.parentNode.firstChild);
		},

		end: function() {
			this.el.parentNode.insertBefore(this.el, null);
		}
	};

	function createElement(tag, cls) {
		var el = document.createElement(tag);
		if (cls) {
			el.className = prefix + cls;
		}

		return el;
	}

	function remove(node) {
		node && node.parentNode && node.parentNode.removeChild(node);
	}

	function removeText(node) {
		isTextNode(node) && remove(node);
	}

	function isTextNode(node) {
		return node && (node.nodeType === 3 || node.className === prefix + 'char');
	}

	function Console(element, options) {
		options = options || {};
		this.el = typeof(element) === 'string' ? document.getElementById(element) : element;
		this.cursor = new Cursor();
		this._stop = null;
		this.container = null;
		this.lines = [];
		this.prompt = null;
		this.listeners = {};
		this.fullScreen = !!options.fullScreen;
		this.transform = options.transform;
		this.inPlace = !!options.inPlace;
		this.setCommands(options.commands);

		if (!('prompt' in options) || options.prompt) {
			var prompt = createElement('span', 'prompt');
			prompt.appendChild(document.createTextNode(options.prompt || '$ '));
			this.prompt = prompt;
		}

		this.render();
	}

	Console.prototype = {
		render: function() {
			var containerClass = 'container';
			if (this.inPlace) {
				this.container = this.el;
				this.container.className += ' ' + prefix + containerClass;
			} else {
				this.container = createElement('div', containerClass);
			}
			if (this.fullScreen) {
				this.toggleFullScreen(true);
			}
			this.newLine();
			if (!this.inPlace) {
				this.el.appendChild(this.container);
			}
		},

		setBanner: function(text) {
			this.clear({ noPrompt: true });
			this.write(text);
			this.newLine();
		},

		setCommands: function(commands) {
			this.commands = commands || {};
		},

		setCommand: function(name, thunk) {
			this.commands[name] = thunk;
		},

		removeCommand: function(name) {
			delete this.commands[name];
		},

		write: function(text, color) {
			if (this.transform) {
				var transformed = this.transform(text, color);
				text = transformed.text;
				color = transformed.color;
			}

			for (var i = 0; i < text.length; i++) {
				this.cursor.writeChar(text.charAt(i), color);
			}

			this.scrollToCursor();
			this.emit('write', text, color);
		},

		clear: function(options) {
			options = options || {};
			for (var i = 0; i < this.lines.length; i++) {
				this.lines[i].el.parentNode.removeChild(this.lines[i].el);
			}
			this.lines = [];

			if (!options.noNewLine) {
				this.newLine(options);
			}
		},

		toggleFullScreen: function(fullScreen) {
			var cls = this.container.className,
				name = prefix + 'fullscreen',
				regex = new RegExp('\\b' + name + '\\b');

			if (typeof(fullScreen) !== 'undefined') {
				this.container.className = fullScreen ? cls += ' ' + name : cls.replace(regex, '');
			} else {
				this.container.className = !regex.test(cls) ? cls += ' ' + name : cls.replace(regex, '');
			}
		},

		scrollToCursor: function() {
			this.container.scrollTop = this.container.scrollHeight;
		},

		newLine: function(options) {
			options = options || {};
			var line = createElement('div', 'line');
			if (this.prompt && !options.noPrompt) {
				line.appendChild(this.prompt.cloneNode(true));
			}
			var commandArea = createElement('span', 'command-area');
			commandArea.appendChild(this.cursor.el);
			line.appendChild(commandArea);
			this.container.appendChild(line);
			this.lines.push({ el: line, command: commandArea });
			this.scrollToCursor();
		},

		getCurrentText: function() {
			return [].slice.call(this.lines.slice(-1)[0].command.childNodes)
				.filter(isTextNode)
				.map(function(node) {
					return node.nodeType === 3 ? node.nodeValue : node.firstChild.nodeValue;
				})
				.join('');
		},

		execute: function() {
			var line = this.getCurrentText(),
				command = line.split(' ')[0],
				args = line.substring(command.length + 1).trim(),
				action = this.commands[command] || this.commands['no command'],
				self = this;

			if (command && action) {
				action.call(this, function(result, options) {
					options = options || {};
					if (result) {
						self.write('\n' + result);
					}

					if (!options.noNewLine) {
						self.newLine();
					}

					self.emit('execute', args, command);
				}, args, command);
			} else {
				this.newLine();
			}
		},

		handleKeyUp: function(e) {
			var code = e.keyCode;
			//have to manually do this cuz chrome is garbage
			var codes = {
				8: 1, //backspace
				13: 1, //enter
				//27: 1, //escape
				//33: 1, //page up
				//34: 1, //page down
				35: 1, //end
				36: 1, //home
				37: 1, //left
				//38: 1, //up
				39: 1, //right
				//40: 1, //down
				46: 1  //delete
			};

			if (!codes[code]) {
				return;
			}

			this.handleKeyCode(e);
		},

		handleKeyPress: function(e) {
			var keys = {
				8: 1
			};

			if (keys[e.keyCode]) {
				//prevent firefox from doing the default
				e.preventDefault();
				return;
			}

			if (!e.charCode) {
				//let keyup handle it
				return;
			}

			this.handleKeyCode(e);
		},

		handleKeyCode: function(e) {
			var charCode = e.charCode,
				alt = e.altKey,
				ctrl = e.ctrlKey;

			if (alt) {
				return;
			}

			function prevent() {
				e.preventDefault();
				return true;
			}

			if (charCode) {
				if (e.metaKey) {
					return;
				}

				if (ctrl && (charCode === 67 || charCode === 99)) {
					//ctrl+C
					prevent();
					this.write('^C');
					this.newLine();
					return;
				}

				if (ctrl) {
					return;
				}

				if (charCode >= 32 && charCode <= 126) {
					prevent();
					this.write(String.fromCharCode(charCode));
				}

				return;
			}

			switch (e.keyCode) {
				case 13: prevent() && this.execute(); return;
				case 8: prevent() && this.cursor.backspace(); return;
				case 46: prevent() && this.cursor.del(); return;
				case 37: prevent() && this.cursor['prev' + (ctrl ? 'Word' : 'Char')](); return;
				case 39: prevent() && this.cursor['next' + (ctrl ? 'Word' : 'Char')](); return;
				case 36: prevent() && this.cursor.beginning(); return;
				case 35: prevent() && this.cursor.end(); return;
			}
		},

		start: function(scope) {
			scope = scope || document;
			var press = this.handleKeyPress.bind(this),
				up = this.handleKeyUp.bind(this);

			scope.addEventListener('keypress', press, false);
			scope.addEventListener('keyup', up, false);

			this._stop = function() {
				scope.removeEventListener('keypress', press, false);
				scope.removeEventListener('keyup', up, false);
			};
		},

		stop: function() {
			this._stop && this._stop();
		},

		on: function(event, listener) {
			if (!this.listeners[event]) {
				this.listeners[event] = [];
			}

			this.listeners[event].push(listener);
		},

		emit: function(event) {
			var listeners = this.listeners[event] || [],
				args = [].slice.call(arguments, 1);
			for (var i = 0; i < listeners.length; i++) {
				listeners[i].apply(this, args);
			}
		}
	};

	window.JSConsole = Console;

}(window, document));