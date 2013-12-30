(function(window, document) {

	function Cursor() {
		this.el = createElement('span', 'cursor');
	}

	Cursor.prototype = {
		writeChar: function(c) {
			var node = document.createTextNode(c);
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
			el.className = 'jsconsole-' + cls;
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
		return node && node.nodeType === 3;
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
		this.height = options.height;
		this.commands = options.commands || {};

		if (!('prompt' in options) || options.prompt) {
			var prompt = createElement('span', 'prompt');
			prompt.appendChild(document.createTextNode(options.prompt || '$ '));
			this.prompt = prompt;
		}

		this.render();
	}

	Console.prototype = {
		render: function() {
			this.container = createElement('div', 'container');
			if (this.height) {
				this.container.style.height = typeof(this.height) === 'number' ? this.height + 'px' : this.height;
			}
			this.newLine();
			this.el.appendChild(this.container);
		},

		write: function(text) {
			for (var i = 0; i < text.length; i++) {
				this.cursor.writeChar(text.charAt(i));
			}

			this.emit('write', text);
		},

		clear: function() {
			for (var i = 0; i < this.lines.length; i++) {
				this.lines[i].el.parentNode.removeChild(this.lines[i].el);
			}
			this.lines = [];

			this.newLine();
		},

		newLine: function() {
			var line = createElement('div', 'line');
			if (this.prompt) {
				line.appendChild(this.prompt.cloneNode(true));
			}
			var commandArea = createElement('span', 'command-area');
			commandArea.appendChild(this.cursor.el);
			line.appendChild(commandArea);
			this.container.appendChild(line);
			this.lines.push({ el: line, command: commandArea });
		},

		getCurrentText: function() {
			return [].slice.call(this.lines.slice(-1)[0].command.childNodes)
				.filter(isTextNode)
				.map(function(node) { return node.nodeValue; })
				.join('');
		},

		execute: function() {
			var line = this.getCurrentText(),
				command = line.split(' ')[0],
				args = line.substring(command.length + 1).trim(),
				action = this.commands[command] || this.commands['no command'],
				self = this;

			if (command && action) {
				action.call(this, command, args, function(result, options) {
					options = options || {};
					if (result) {
						self.write('\n' + result);
					}

					if (!options.noNewLine) {
						self.newLine();
					}

					self.emit('execute', command, args);
				});
			} else {
				this.newLine();
			}
		},

		handleKeyUp: function(e) {
			console.log('keyup: %d', e.keyCode);
		},

		handleKeyDown: function(e) {
			console.log('keydown: %d', e.keyCode);
		},
		handleKeyPress: function(e) {
			console.log('keypress: %d %d ctrl: %b, alt: %b, shift: %b', e.charCode, e.keyCode, e.ctrlKey, e.altKey, e.shiftKey);

			if (e.altKey) {
				return;
			}

			function prevent() {
				e.preventDefault();
				return true;
			}

			if (e.keyCode) {
				//a non-alphabetical character
				switch (e.keyCode) {
					case 13: prevent() && this.execute(); break;
					case 8: prevent() && this.cursor.backspace(); break;
					case 46: prevent() && this.cursor.del(); break;
					case 37: prevent() && this.cursor['prev' + (e.ctrlKey ? 'Word' : 'Char')](); break;
					case 39: prevent() && this.cursor['next' + (e.ctrlKey ? 'Word' : 'Char')](); break;
					case 36: prevent() && this.cursor.beginning(); break;
					case 35: prevent() && this.cursor.end(); break;
				}

				return;
			}

			if (e.altKey || e.metaKey) {
				return;
			}

			if (e.ctrlKey && (e.charCode === 67 || e.charCode === 99)) {
				//ctrl+C
				prevent();
				this.write('^C');
				this.newLine();
				return;
			}

			if (e.ctrlKey) {
				return;
			}

			if (e.charCode >= 32 && e.charCode <= 126) {
				prevent();
				this.write(String.fromCharCode(e.charCode));
			}
		},

		start: function(scope) {
			scope = scope || document;
			var press = this.handleKeyPress.bind(this);

			scope.addEventListener('keypress', press, false);

			this._stop = function() {
				scope.removeEventListener('keypress', press, false);
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